'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authConfigured, supabase } from '@/lib/supabase';

type OAuthProvider = 'google' | 'facebook';

interface AuthContextValue {
  /** Whether Supabase auth is configured. When false, the app is in dev-bypass mode. */
  authConfigured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    authConfigured,
    loading,
    user: session?.user ?? null,
    session,
    async signInWithProvider(provider) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
    },
    async signInWithEmail(email, password) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signUpWithEmail(email, password) {
      if (!supabase) return { needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      // If email confirmation is on, there is no active session yet.
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
