// JustRate catalog search, run as a Supabase Edge Function so API keys stay in Supabase secrets.
// Films, series and cartoons come from PoiskKino (formerly kinopoisk.dev), books from Google Books.
//
// POST { action: "search_movies", query }  → { results: CatalogItem[] }
// POST { action: "movie_details", id }     → { creator, description }
// POST { action: "search_books", query }   → { results: CatalogItem[] }
//
// Secrets: POISKKINO_API_KEY (required for films), GOOGLE_BOOKS_API_KEY (optional; without it
// Google's shared anonymous quota often runs out).

const POISKKINO_URL = 'https://api.poiskkino.dev/v1.5';
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
const SEARCH_LIMIT = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function fail(error: CatalogError) {
  return json({ error }, error === 'bad_request' ? 400 : 502);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validYear(value: unknown): number | null {
  const year = typeof value === 'string' ? Number(value.slice(0, 4)) : value;
  return typeof year === 'number' && Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null;
}

async function getJson(url: string, headers: Record<string, string>): Promise<{ data: Json } | { error: CatalogError }> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
  } catch {
    return { error: 'upstream' };
  }
  if (response.status === 401) return { error: 'bad_key' };
  // PoiskKino answers 403 when the daily limit is used up; Google answers 429.
  if (response.status === 403 || response.status === 429) return { error: 'limit' };
  if (!response.ok) return { error: response.status === 400 ? 'bad_key' : 'upstream' };
  return { data: await response.json() };
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
  if ('error' in result) return fail(result.error);
  const docs: Json[] = Array.isArray(result.data?.docs) ? result.data.docs : [];
  return json({ results: docs.map(toMovie).filter(Boolean) });
}

async function movieDetails(id: number) {
  const key = Deno.env.get('POISKKINO_API_KEY');
  if (!key) return fail('missing_key');
  const result = await getJson(`${POISKKINO_URL}/movie/${id}`, { 'X-API-KEY': key });
  if ('error' in result) return fail(result.error);
  const persons: Json[] = Array.isArray(result.data?.persons) ? result.data.persons : [];
  const directors = persons
    .filter((p) => p?.enProfession === 'director')
    .map((p) => text(p.name) ?? text(p.enName))
    .filter(Boolean)
    .slice(0, 2);
  return json({
    creator: directors.length > 0 ? directors.join(', ').slice(0, 200) : null,
    description: text(result.data?.shortDescription) ?? text(result.data?.description),
  });
}

// --- Books ---

function toBook(item: Json): CatalogItem | null {
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

async function searchBooks(query: string) {
  const params = new URLSearchParams({ q: query, maxResults: String(SEARCH_LIMIT), printType: 'books' });
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  if (key) params.set('key', key);
  const result = await getJson(`${GOOGLE_BOOKS_URL}?${params}`, {});
  if ('error' in result) return fail(result.error);
  const items: Json[] = Array.isArray(result.data?.items) ? result.data.items : [];
  return json({ results: items.map(toBook).filter(Boolean) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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
