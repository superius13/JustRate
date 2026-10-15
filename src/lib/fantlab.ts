import type { CatalogItem } from '@/lib/catalog';

// Fantlab is the big Russian catalog of fiction, one entry per work with the year it was written.
// It only answers Russian addresses, so the phone asks it directly instead of our server.
const FANTLAB_URL = 'https://api.fantlab.ru';
const FANTLAB_TIMEOUT_MS = 2500;
const FANTLAB_LIMIT = 10;

// Work types worth rating; articles, reviews, scripts, magazines and the like are left out.
const BOOK_TYPES = new Set([
  'novel',
  'story',
  'shortstory',
  'microstory',
  'novelette',
  'poem',
  'poetry',
  'piece',
  'fairytale',
  'collection',
  'antology',
  'documental',
]);

type FantlabWork = {
  work_id?: unknown;
  rusname?: unknown;
  name?: unknown;
  name_eng?: unknown;
  all_autor_rusname?: unknown;
  autor_rusname?: unknown;
  year?: unknown;
  pic_edition_id?: unknown;
  pic_edition_id_auto?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toBook(work: FantlabWork): CatalogItem | null {
  if (typeof work.work_id !== 'number' || typeof work.name_eng !== 'string' || !BOOK_TYPES.has(work.name_eng)) {
    return null;
  }
  const rusName = text(work.rusname);
  const original = text(work.name);
  const name = rusName ?? original;
  if (!name) return null;
  const year = Number(work.year);
  const cover = Number(work.pic_edition_id) || Number(work.pic_edition_id_auto);
  return {
    source: 'fantlab',
    external_id: String(work.work_id),
    kind: 'book',
    name,
    original_name: original && original !== name ? original : null,
    year: Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null,
    creator: (text(work.all_autor_rusname) ?? text(work.autor_rusname))?.slice(0, 200) ?? null,
    poster_url: cover > 0 ? `https://fantlab.ru/images/editions/big/${cover}` : null,
  };
}

/** Books from Fantlab, best matches first. Throws when Fantlab cannot be reached (VPN, abroad). */
export async function searchFantlab(query: string): Promise<CatalogItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FANTLAB_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ q: query, page: '1' });
    const response = await fetch(`${FANTLAB_URL}/search-works?${params}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Fantlab ${response.status}`);
    const data = await response.json();
    const works: FantlabWork[] = Array.isArray(data?.matches) ? data.matches : [];
    return works
      .map(toBook)
      .filter((book): book is CatalogItem => book !== null)
      .slice(0, FANTLAB_LIMIT);
  } finally {
    clearTimeout(timer);
  }
}
