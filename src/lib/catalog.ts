import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { createTitle, findCatalogTitle, type Title, type TitleKind } from '@/lib/library';
import { supabase } from '@/lib/supabase';

/** Search results from the `catalog` Edge Function (supabase/functions/catalog). */
export type CatalogItem = {
  source: 'kinopoisk' | 'google_books' | 'open_library';
  external_id: string;
  kind: TitleKind;
  name: string;
  original_name: string | null;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
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

export type CatalogSearch = {
  results: CatalogItem[];
  /** The books came from Open Library because Google Books was down. */
  fromFallback: boolean;
};

const cache = new Map<string, CatalogSearch>();

/** Films, series and cartoons from PoiskKino, or books from Google Books (Open Library as a fallback). */
export async function searchCatalog(shelf: CatalogShelf, query: string): Promise<CatalogSearch> {
  const trimmed = query.trim();
  const key = `${shelf}:${trimmed.toLocaleLowerCase('ru')}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { results, fallback } = await invoke<{ results: CatalogItem[]; fallback?: string }>({
    action: shelf === 'book' ? 'search_books' : 'search_movies',
    query: trimmed,
  });
  const search = { results: Array.isArray(results) ? results : [], fromFallback: Boolean(fallback) };
  cache.set(key, search);
  return search;
}

/**
 * Returns the JustRate title for a search result, saving it first if nobody has added it yet,
 * so friends who pick the same film share one title.
 */
export async function ensureCatalogTitle(item: CatalogItem): Promise<Title> {
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
