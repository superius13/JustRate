import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { searchFantlab } from '@/lib/fantlab';
import {
  createTitle,
  findCatalogTitle,
  searchSavedTitles,
  searchWords,
  type SavedTitle,
  type Title,
  type TitleKind,
} from '@/lib/library';
import { supabase } from '@/lib/supabase';

/**
 * A search result: from the `catalog` Edge Function (supabase/functions/catalog), or a title
 * someone in JustRate already saved (`saved`, with the title attached).
 */
export type CatalogItem = {
  source: 'kinopoisk' | 'google_books' | 'fantlab' | 'saved';
  external_id: string;
  kind: TitleKind;
  name: string;
  original_name: string | null;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
  title?: Title;
};

export type CatalogShelf = 'video' | 'book';

type CatalogErrorCode = 'not_deployed' | 'missing_key' | 'bad_key' | 'limit' | 'offline' | 'failed';

export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    /** Upstream status and message from the function, if it sent one. */
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

const MESSAGES: Record<CatalogErrorCode, string> = {
  not_deployed: 'Поиск ещё не подключён: в Supabase нет функции catalog.',
  missing_key: 'Поиск фильмов ещё не настроен: в Supabase не сохранён ключ ПоискКино.',
  bad_key: 'Ключ каталога не подходит. Проверь его в настройках Supabase.',
  limit: 'Запросы к каталогу на сегодня закончились. Попробуй завтра или добавь вручную.',
  offline: 'Нет связи с сервером. Проверь интернет.',
  failed: 'Каталог сейчас не отвечает. Попробуй ещё раз или добавь вручную.',
};

export function describeCatalogError(error: unknown): string {
  if (!(error instanceof CatalogError)) return MESSAGES.failed;
  return error.detail ? `${MESSAGES[error.code]}\nОтвет каталога: ${error.detail}` : MESSAGES[error.code];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('catalog', { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    if (response.status === 404) throw new CatalogError('not_deployed');
    const payload = await response.json().catch(() => null);
    const code = payload?.error;
    const detail = typeof payload?.detail === 'string' ? payload.detail : undefined;
    if (code === 'missing_key' || code === 'bad_key' || code === 'limit') throw new CatalogError(code, detail);
    throw new CatalogError('failed', detail ?? `HTTP ${response.status}`);
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new CatalogError('offline');
  }
  throw new CatalogError('failed');
}

const cache = new Map<string, CatalogItem[]>();

async function cached(key: string, load: () => Promise<CatalogItem[]>): Promise<CatalogItem[]> {
  const hit = cache.get(key);
  if (hit) return hit;
  const list = await load();
  cache.set(key, list);
  return list;
}

async function searchServer(shelf: CatalogShelf, query: string): Promise<CatalogItem[]> {
  const { results } = await invoke<{ results: CatalogItem[] }>({
    action: shelf === 'book' ? 'search_books' : 'search_movies',
    query,
  });
  return Array.isArray(results) ? results : [];
}

/** The same book from different places: its title plus the first author's surname. */
function bookKey(item: { name: string; creator: string | null }): string {
  const firstAuthor = (item.creator ?? '').split(',')[0];
  return `${searchWords(item.name).join(' ')}|${searchWords(firstAuthor).at(-1) ?? ''}`;
}

function savedItem(title: SavedTitle): CatalogItem {
  const { source, external_id, ...rest } = title;
  return {
    source: 'saved',
    external_id: title.id,
    kind: title.kind,
    name: title.name,
    original_name: title.original_name,
    year: title.year,
    creator: title.creator,
    poster_url: title.poster_url,
    title: rest,
  };
}

/**
 * Films, series and cartoons from PoiskKino. Books: first those already saved in JustRate,
 * then Fantlab, then Google Books, each book once. All three are asked at the same time.
 */
export async function searchCatalog(shelf: CatalogShelf, query: string): Promise<CatalogItem[]> {
  const trimmed = query.trim();
  const key = trimmed.toLocaleLowerCase('ru');
  if (shelf === 'video') return cached(`video:${key}`, () => searchServer('video', trimmed));

  // Saved books are read fresh every time, so a book added a minute ago is found.
  const [saved, fantlab, google] = await Promise.allSettled([
    searchSavedTitles('book', trimmed),
    cached(`fantlab:${key}`, () => searchFantlab(trimmed)),
    cached(`book:${key}`, () => searchServer('book', trimmed)),
  ]);
  const savedTitles = saved.status === 'fulfilled' ? saved.value : [];
  const found = [
    ...(fantlab.status === 'fulfilled' ? fantlab.value : []),
    ...(google.status === 'fulfilled' ? google.value : []),
  ];
  // Without any catalog answer, an empty list would wrongly read as "nothing found".
  if (savedTitles.length === 0 && found.length === 0 && google.status === 'rejected') throw google.reason;

  const results = savedTitles.map(savedItem);
  const seenIds = new Set(savedTitles.map((title) => `${title.source}:${title.external_id}`));
  const seenKeys = new Set(savedTitles.map(bookKey));
  for (const item of found) {
    const itemKey = bookKey(item);
    if (seenIds.has(`${item.source}:${item.external_id}`) || seenKeys.has(itemKey)) continue;
    seenKeys.add(itemKey);
    results.push(item);
  }
  return results;
}

/**
 * Returns the JustRate title for a search result, saving it first if nobody has added it yet,
 * so friends who pick the same film share one title.
 */
export async function ensureCatalogTitle(item: CatalogItem): Promise<Title> {
  if (item.title) return item.title;
  if (item.source === 'saved') throw new CatalogError('failed');
  const existing = await findCatalogTitle(item.source, item.external_id);
  if (existing) return existing;

  let creator = item.creator;
  let description: string | null = null;
  let posterUrl = item.poster_url;
  if (item.source === 'kinopoisk') {
    // The search list has no director and sometimes no poster; one extra request fills them in.
    try {
      const details = await invoke<{
        creator: string | null;
        description: string | null;
        poster_url?: string | null;
      }>({
        action: 'movie_details',
        id: Number(item.external_id),
      });
      creator = details.creator;
      description = details.description;
      posterUrl = posterUrl ?? details.poster_url ?? null;
    } catch {
      // Keep going without the director.
    }
  }

  try {
    return await createTitle({
      kind: item.kind,
      name: item.name,
      original_name: item.original_name,
      year: item.year,
      creator,
      poster_url: posterUrl,
      source: item.source,
      external_id: item.external_id,
      description,
    });
  } catch (error) {
    // Someone saved the same title a moment ago: use theirs.
    if ((error as { code?: string }).code === '23505') {
      const saved = await findCatalogTitle(item.source, item.external_id);
      if (saved) return saved;
    }
    throw error;
  }
}
