import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { supabase, type Profile } from '@/lib/supabase';

type AuthState = {
  /** True while the saved session or the user's profile is still loading. */
  loading: boolean;
  session: Session | null;
  /** Null while the user has not entered their name yet. */
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Fires once with the saved session (INITIAL_SESSION), then on every sign-in and sign-out.
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return;

      setLoading(true);
      // Supabase calls made inside this callback can deadlock, so defer them.
      setTimeout(() => {
        fetchProfile(next.user.id)
          .then((p) => active && setProfile(p))
          .catch(() => active && setProfile(null))
          .finally(() => active && setLoading(false));
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // With email confirmation on, Supabase hides taken emails by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      throw Object.assign(new Error('Email already registered'), { code: 'user_already_exists' });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const saveDisplayName = useCallback(
    async (name: string) => {
      const userId = session?.user.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: name })
        .select('id, display_name')
        .single();
      if (error) throw error;
      setProfile(data);
    },
    [session],
  );

  return (
    <AuthContext value={{ loading, session, profile, signIn, signUp, signOut, saveDisplayName }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
