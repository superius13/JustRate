import type { ImageSource } from 'expo-image';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Mirrors RELAYED_IMAGE_HOSTS in supabase/functions/catalog: TMDB is unreachable from Russia.
const RELAYED_HOSTS = ['image.tmdb.org'];

function host(url: string): string | null {
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Where to load a cover from: straight from the catalog, or through the `catalog` function. */
export function posterSource(url: string, accessToken: string | undefined): ImageSource {
  const h = host(url);
  if (!h || !RELAYED_HOSTS.includes(h) || !SUPABASE_URL || !accessToken) return { uri: url };
  return {
    uri: `${SUPABASE_URL}/functions/v1/catalog?poster=${encodeURIComponent(url.replace(/^http:/i, 'https:'))}`,
    headers: { Authorization: `Bearer ${accessToken}`, apikey: PUBLISHABLE_KEY },
    // The token changes every hour; the picture does not.
    cacheKey: url,
  };
}
