// JustRate catalog search, run as a Supabase Edge Function so API keys stay in Supabase secrets.
// Films, series and cartoons come from PoiskKino (formerly kinopoisk.dev), books from Google Books
// (editions of one book merged). Fantlab, the Russian book catalog, only answers Russian addresses,
// so the app asks it directly (src/lib/fantlab.ts).
//
// POST { action: "search_movies", query }  → { results: CatalogItem[] }
// POST { action: "movie_details", id }     → { creator, description, poster_url }
// POST { action: "search_books", query }   → { results: CatalogItem[] }
// GET  ?poster=<image url>                  → the image itself, for hosts blocked in Russia (TMDB)
//
// Secrets: POISKKINO_API_KEY (required for films), GOOGLE_BOOKS_API_KEY (optional; without it
// Google's shared anonymous quota often runs out).

const POISKKINO_URL = 'https://api.poiskkino.dev/v1.5';
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
const SEARCH_LIMIT = 15;
// PoiskKino takes some posters from TMDB, which is unreachable from Russia; those are relayed.
const RELAYED_IMAGE_HOSTS = ['image.tmdb.org'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function relayPoster(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail('bad_request');
  }
  if (url.protocol !== 'https:' || !RELAYED_IMAGE_HOSTS.includes(url.hostname)) return fail('bad_request');
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return fail('upstream');
  }
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.startsWith('image/')) return fail('upstream');
  return new Response(response.body, {
    headers: { ...corsHeaders, 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000, immutable' },
  });
}

type Kind = 'movie' | 'series' | 'cartoon' | 'book';

type CatalogItem = {
  source: 'kinopoisk' | 'google_books';
  external_id: string;
  kind: Kind;
  name: string;
  original_name: string | null;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
};

type CatalogError = 'missing_key' | 'bad_key' | 'limit' | 'upstream' | 'bad_request';

// deno-lint-ignore no-explicit-any
type Json = any;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** `detail` is a short upstream status and message, shown in the app to help find setup mistakes. */
function fail(error: CatalogError, detail?: string) {
  if (detail) console.error(`catalog: ${error}: ${detail}`);
  return json(detail ? { error, detail } : { error }, error === 'bad_request' ? 400 : 502);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validYear(value: unknown): number | null {
  const year = typeof value === 'string' ? Number(value.slice(0, 4)) : value;
  return typeof year === 'number' && Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null;
}

type Upstream = { data: Json } | { error: CatalogError; detail: string };

async function getJson(url: string, headers: Record<string, string>, timeoutMs?: number): Promise<Upstream> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (e) {
    return { error: 'upstream', detail: `network: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200) };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message ?? parsed?.message ?? body;
    } catch {
      // Not JSON; keep the raw text.
    }
    const detail = `${response.status} ${String(message)}`.replace(/\s+/g, ' ').slice(0, 200);
    if (response.status === 401) return { error: 'bad_key', detail };
    // PoiskKino answers 403 when the daily limit is used up; Google answers 429 (and 403 for key problems).
    if (response.status === 429) return { error: 'limit', detail };
    if (response.status === 403) return { error: /quota|limit|лимит/i.test(detail) ? 'limit' : 'bad_key', detail };
    return { error: response.status === 400 ? 'bad_key' : 'upstream', detail };
  }
  try {
    return { data: await response.json() };
  } catch {
    return { error: 'upstream', detail: `${response.status} not JSON` };
  }
}

// --- Films, series, cartoons ---

function movieKind(type: unknown, isSeries: unknown): Kind {
  if (type === 'cartoon' || type === 'anime' || type === 'animated-series') return 'cartoon';
  if (type === 'tv-series' || type === 'tv-show' || isSeries === true) return 'series';
  return 'movie';
}

function toMovie(doc: Json): CatalogItem | null {
  const name = text(doc?.name) ?? text(doc?.alternativeName) ?? text(doc?.enName);
  if (typeof doc?.id !== 'number' || !name) return null;
  const original = text(doc.alternativeName) ?? text(doc.enName);
  return {
    source: 'kinopoisk',
    external_id: String(doc.id),
    kind: movieKind(doc.type, doc.isSeries),
    name,
    original_name: original && original !== name ? original : null,
    year: validYear(doc.year),
    creator: null,
    poster_url: text(doc.poster?.previewUrl) ?? text(doc.poster?.url),
  };
}

async function searchMovies(query: string) {
  const key = Deno.env.get('POISKKINO_API_KEY');
  if (!key) return fail('missing_key');
  const params = new URLSearchParams({ page: '1', limit: String(SEARCH_LIMIT), query });
  const result = await getJson(`${POISKKINO_URL}/movie/search?${params}`, { 'X-API-KEY': key });
  if ('error' in result) return fail(result.error, result.detail);
  const docs: Json[] = Array.isArray(result.data?.docs) ? result.data.docs : [];
  return json({ results: docs.map(toMovie).filter(Boolean) });
}

async function movieDetails(id: number) {
  const key = Deno.env.get('POISKKINO_API_KEY');
  if (!key) return fail('missing_key');
  const result = await getJson(`${POISKKINO_URL}/movie/${id}`, { 'X-API-KEY': key });
  if ('error' in result) return fail(result.error, result.detail);
  const persons: Json[] = Array.isArray(result.data?.persons) ? result.data.persons : [];
  const directors = persons
    .filter((p) => p?.enProfession === 'director')
    .map((p) => text(p.name) ?? text(p.enName))
    .filter(Boolean)
    .slice(0, 2);
  return json({
    creator: directors.length > 0 ? directors.join(', ').slice(0, 200) : null,
    description: text(result.data?.shortDescription) ?? text(result.data?.description),
    // Search results often miss the poster of a series; the full card usually has it.
    poster_url: text(result.data?.poster?.previewUrl) ?? text(result.data?.poster?.url),
  });
}

// --- Books ---

// Google may not hold up the answer for longer than this, retries included.
const BOOK_SEARCH_BUDGET_MS = 2500;

function words(value: string): string[] {
  return value
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The same book in different editions: its title plus the first author's surname. */
function bookKey(book: CatalogItem): string {
  const firstAuthor = (book.creator ?? '').split(',')[0];
  return `${words(book.name).join(' ')}|${words(firstAuthor).at(-1) ?? ''}`;
}

function toGoogleBook(item: Json): CatalogItem | null {
  const info = item?.volumeInfo;
  const name = text(info?.title);
  if (typeof item?.id !== 'string' || !name) return null;
  const authors: string[] = Array.isArray(info.authors) ? info.authors.filter((a: unknown) => text(a)) : [];
  const cover = text(info.imageLinks?.thumbnail) ?? text(info.imageLinks?.smallThumbnail);
  return {
    source: 'google_books',
    external_id: item.id,
    kind: 'book',
    name,
    original_name: null,
    year: validYear(info.publishedDate),
    creator: authors.length > 0 ? authors.slice(0, 3).join(', ').slice(0, 200) : null,
    // Google returns http links with a page-curl effect; ask for https and a plain cover.
    poster_url: cover ? cover.replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
  };
}

// Google matches the words anywhere in a book, so take more books than we show and sort them.
const GOOGLE_BOOKS_FETCH = 40;
// Google Books often answers 503 "backendFailed" for a moment; a retry after a short pause usually gets through.
const GOOGLE_RETRY_DELAYS_MS = [400, 800];

async function searchGoogleBooks(query: string): Promise<Upstream> {
  const params = new URLSearchParams({ q: query, maxResults: String(GOOGLE_BOOKS_FETCH), printType: 'books' });
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  if (key) params.set('key', key);
  const url = `${GOOGLE_BOOKS_URL}?${params}`;
  const deadline = Date.now() + BOOK_SEARCH_BUDGET_MS;
  let result = await getJson(url, {}, BOOK_SEARCH_BUDGET_MS);
  for (const delay of GOOGLE_RETRY_DELAYS_MS) {
    if (!('error' in result) || result.error !== 'upstream') break;
    // Skip a retry that could not finish in time.
    const left = deadline - Date.now() - delay;
    if (left < 300) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await getJson(url, {}, left);
  }
  return result;
}

/** Higher for books whose title (or author) holds what was typed, with a cover, and often rated. */
function bookScore(queryWords: string[], book: CatalogItem, ratingsCount: number): number {
  const title = words(book.name);
  const authors = words(book.creator ?? '');
  const titleText = title.join(' ');
  const queryText = queryWords.join(' ');
  let score = 0;
  if (titleText === queryText) score += 100;
  else if (titleText.startsWith(queryText)) score += 60;
  let matched = 0;
  for (const word of queryWords) {
    const inTitle = title.some((t) => t.startsWith(word));
    const inAuthor = !inTitle && authors.some((a) => a.startsWith(word));
    if (inTitle) score += 20;
    if (inAuthor) score += 15;
    if (inTitle || inAuthor) matched += 1;
  }
  if (matched === queryWords.length) score += 30;
  if (book.poster_url) score += 15;
  score += Math.min(Math.log10(ratingsCount + 1) * 5, 15);
  return score;
}

/** Google lists every edition; keep one row per book, sorted by how well it matches. */
function rankGoogleBooks(query: string, items: Json[]): CatalogItem[] {
  const queryWords = words(query);
  type Group = { book: CatalogItem; score: number; index: number; ratings: number };
  const groups = new Map<string, Group>();
  items.forEach((item, index) => {
    const book = toGoogleBook(item);
    if (!book) return;
    const count = Number(item?.volumeInfo?.ratingsCount);
    const ratings = Number.isFinite(count) ? count : 0;
    const key = bookKey(book);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { book, score: 0, index, ratings });
      return;
    }
    // The earliest year found is the closest to when the book was written.
    const year = group.book.year && book.year ? Math.min(group.book.year, book.year) : (group.book.year ?? book.year);
    group.book = { ...group.book, year, poster_url: group.book.poster_url ?? book.poster_url };
    group.ratings += ratings;
  });
  return [...groups.values()]
    .map((group) => ({ ...group, score: bookScore(queryWords, group.book, group.ratings) }))
    // Equal scores keep Google's own order.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((group) => group.book);
}

async function searchBooks(query: string) {
  const google = await searchGoogleBooks(query);
  if ('error' in google) return fail(google.error, google.detail);
  const items: Json[] = Array.isArray(google.data?.items) ? google.data.items : [];
  return json({ results: rankGoogleBooks(query, items).slice(0, SEARCH_LIMIT) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') {
    const poster = new URL(req.url).searchParams.get('poster');
    return poster ? relayPoster(poster) : fail('bad_request');
  }

  const body = await req.json().catch(() => ({}));
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 100) : '';

  switch (body?.action) {
    case 'search_movies':
      return query.length < 2 ? json({ results: [] }) : searchMovies(query);
    case 'search_books':
      return query.length < 2 ? json({ results: [] }) : searchBooks(query);
    case 'movie_details': {
      const id = Number(body.id);
      return Number.isInteger(id) && id > 0 ? movieDetails(id) : fail('bad_request');
    }
    default:
      return fail('bad_request');
  }
});
