// JustRate catalog search, run as a Supabase Edge Function so API keys stay in Supabase secrets.
// Films, series and cartoons come from PoiskKino (formerly kinopoisk.dev), books from Google Books,
// with Open Library as a fallback when Google is down.
//
// POST { action: "search_movies", query }  → { results: CatalogItem[] }
// POST { action: "movie_details", id }     → { creator, description, poster_url }
// POST { action: "search_books", query }   → { results: CatalogItem[], fallback? }
//   fallback is "open_library" when Google Books was down and the results came from Open Library.
// GET  ?poster=<image url>                  → the image itself, for hosts blocked in Russia (TMDB)
//
// Secrets: POISKKINO_API_KEY (required for films), GOOGLE_BOOKS_API_KEY (optional; without it
// Google's shared anonymous quota often runs out).

const POISKKINO_URL = 'https://api.poiskkino.dev/v1.5';
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_URL = 'https://openlibrary.org/search.json';
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
  source: 'kinopoisk' | 'google_books' | 'open_library';
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

async function getJson(url: string, headers: Record<string, string>): Promise<Upstream> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
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

async function searchGoogleBooks(query: string): Promise<Upstream> {
  const params = new URLSearchParams({ q: query, maxResults: String(SEARCH_LIMIT), printType: 'books' });
  const key = Deno.env.get('GOOGLE_BOOKS_API_KEY');
  if (key) params.set('key', key);
  const url = `${GOOGLE_BOOKS_URL}?${params}`;
  const first = await getJson(url, {});
  // Google Books often answers 503 "backendFailed" for a moment; one retry usually gets through.
  if ('error' in first && first.error === 'upstream') return getJson(url, {});
  return first;
}

function toOpenLibraryBook(doc: Json): CatalogItem | null {
  const name = text(doc?.title);
  const key = text(doc?.key);
  if (!name || !key) return null;
  const authors: string[] = Array.isArray(doc.author_name) ? doc.author_name.filter((a: unknown) => text(a)) : [];
  return {
    source: 'open_library',
    external_id: key.replace(/^\/works\//, ''),
    kind: 'book',
    name,
    original_name: null,
    year: validYear(doc.first_publish_year),
    creator: authors.length > 0 ? authors.slice(0, 3).join(', ').slice(0, 200) : null,
    poster_url: typeof doc.cover_i === 'number' ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  };
}

async function searchOpenLibrary(query: string): Promise<Upstream> {
  const params = new URLSearchParams({
    q: query,
    limit: String(SEARCH_LIMIT),
    fields: 'key,title,author_name,first_publish_year,cover_i',
  });
  return getJson(`${OPEN_LIBRARY_URL}?${params}`, { 'User-Agent': 'JustRate (personal book list)' });
}

async function searchBooks(query: string) {
  const google = await searchGoogleBooks(query);
  if (!('error' in google)) {
    const items: Json[] = Array.isArray(google.data?.items) ? google.data.items : [];
    return json({ results: items.map(toBook).filter(Boolean) });
  }
  // A wrong key needs fixing, so say so; outages and quota fall back to Open Library.
  if (google.error === 'bad_key') return fail(google.error, google.detail);
  console.error(`catalog: google books ${google.error}: ${google.detail}; using Open Library`);
  const openLibrary = await searchOpenLibrary(query);
  if ('error' in openLibrary) return fail(google.error, google.detail);
  const docs: Json[] = Array.isArray(openLibrary.data?.docs) ? openLibrary.data.docs : [];
  return json({ results: docs.map(toOpenLibraryBook).filter(Boolean), fallback: 'open_library' });
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
