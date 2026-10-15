import { supabase } from '@/lib/supabase';

export type TitleKind = 'movie' | 'series' | 'cartoon' | 'book';

export const KIND_LABELS: Record<TitleKind, string> = {
  movie: 'Фильм',
  series: 'Сериал',
  cartoon: 'Мультфильм',
  book: 'Книга',
};

/** Shelf filter tabs, in display order. */
export const SHELF_FILTERS: { value: TitleKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'movie', label: 'Фильмы' },
  { value: 'series', label: 'Сериалы' },
  { value: 'cartoon', label: 'Мульт' },
  { value: 'book', label: 'Книги' },
];

export function isTitleKind(value: unknown): value is TitleKind {
  return value === 'movie' || value === 'series' || value === 'cartoon' || value === 'book';
}

export type TitleSource = 'kinopoisk' | 'google_books' | 'open_library' | 'manual';

export type Title = {
  id: string;
  kind: TitleKind;
  name: string;
  original_name: string | null;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
};

/** A title typed in by hand on the add screen. */
export type TitleDraft = Pick<Title, 'kind' | 'name' | 'year' | 'creator'>;

export type Rating = {
  id: string;
  title_id: string;
  /** From 1 to 10 in steps of 0.5. */
  overall: number;
  criteria: Record<string, unknown>;
  review: string | null;
  watched_on: string | null;
  created_at: string;
  updated_at: string;
};

export type ShelfItem = Rating & { title: Title };

const TITLE_COLUMNS = 'id, kind, name, original_name, year, creator, poster_url';
const RATING_COLUMNS = 'id, title_id, overall, criteria, review, watched_on, created_at, updated_at';

export async function fetchShelf(userId: string): Promise<ShelfItem[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select(`${RATING_COLUMNS}, title:titles!inner(${TITLE_COLUMNS})`)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ShelfItem[]).map(normalizeRating);
}

/** The overall score is a Postgres numeric; make sure it is a plain number. */
function normalizeRating<T extends Rating>(rating: T): T {
  return { ...rating, overall: Number(rating.overall) };
}

export async function fetchTitle(titleId: string): Promise<Title | null> {
  const { data, error } = await supabase
    .from('titles')
    .select(TITLE_COLUMNS)
    .eq('id', titleId)
    .maybeSingle();
  if (error) throw error;
  return data as Title | null;
}

export async function fetchMyRating(userId: string, titleId: string): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select(RATING_COLUMNS)
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeRating(data as Rating) : null;
}

export async function createTitle(
  draft: Omit<Title, 'id'> & { source: TitleSource; external_id?: string | null; description?: string | null },
): Promise<Title> {
  const { data, error } = await supabase.from('titles').insert(draft).select(TITLE_COLUMNS).single();
  if (error) throw error;
  return data as Title;
}

/** The catalog title already saved by anyone in JustRate, if there is one. */
export async function findCatalogTitle(source: TitleSource, externalId: string): Promise<Title | null> {
  const { data, error } = await supabase
    .from('titles')
    .select(TITLE_COLUMNS)
    .eq('source', source)
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw error;
  return data as Title | null;
}

export type RatingInput = {
  overall: number;
  criteria: Record<string, number>;
  review: string | null;
  watched_on: string | null;
};

export async function saveRating(userId: string, titleId: string, input: RatingInput) {
  const { error } = await supabase
    .from('ratings')
    .upsert({ user_id: userId, title_id: titleId, ...input }, { onConflict: 'user_id,title_id' });
  if (error) throw error;
}

export async function deleteRating(userId: string, titleId: string) {
  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('user_id', userId)
    .eq('title_id', titleId);
  if (error) throw error;
}

const POSTER_COLORS = ['#3B4B63', '#7A5B3A', '#6B3A5A', '#3F6B55', '#8A6A3A', '#4E5A7A', '#6B4A3A'];

/** Stand-in cover colour until real posters arrive; stable for the same title. */
export function posterColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return POSTER_COLORS[Math.abs(hash) % POSTER_COLORS.length];
}

/** "Книга · Булгаков · 1967", skipping the parts that are empty. */
export function titleMeta(title: Pick<Title, 'kind' | 'year' | 'creator'>): string {
  return [KIND_LABELS[title.kind], title.creator, title.year].filter(Boolean).join(' · ');
}

/** 8.75 → "8,8", 9 → "9". */
export function formatScore(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

/** Watched dates are stored as the first day of a month: "2026-09-01". */
export type MonthValue = { year: number; month: number };

export function currentMonth(): MonthValue {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function parseMonth(date: string | null): MonthValue | null {
  const match = date?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

export function formatMonthValue(value: MonthValue): string {
  return `${value.year}-${String(value.month + 1).padStart(2, '0')}-01`;
}

export function monthLabel(value: MonthValue): string {
  return `${MONTHS[value.month]} ${value.year}`;
}

export function shiftMonth(value: MonthValue, delta: number): MonthValue {
  const total = value.year * 12 + value.month + delta;
  return { year: Math.floor(total / 12), month: total % 12 };
}

export function compareMonths(a: MonthValue, b: MonthValue): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}
