import 'react-native-url-polyfill/auto';
import '@/lib/local-storage';

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** False until the project's Supabase URL and key are filled in `.env`. */
export const isSupabaseConfigured = url.length > 0 && publishableKey.length > 0;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'http://localhost',
  isSupabaseConfigured ? publishableKey : 'not-configured',
  {
    auth: {
      // Undefined only while the web build pre-renders pages on the server.
      storage: typeof localStorage === 'undefined' ? undefined : localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export type Profile = {
  id: string;
  display_name: string;
};
