'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authCallback, authConfigured, clearAuthCallbackHash, supabase } from '@/lib/supabase';

type OAuthProvider = 'google';

interface AuthContextValue {
  /** Whether Supabase auth is configured. When false, the app is in dev-bypass mode. */
  authConfigured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  /**
   * True while the user is here from a password-recovery link. The recovery link
   * *creates a real session*, so without this flag the app would drop them
   * straight into the dashboard and they'd never get to set a new password.
   */
  recovering: boolean;
  /**
   * Why an email link failed, if the user got here by clicking a dead one —
   * expired, already used, or consumed by a mail scanner. Supabase reports this
   * in the URL and nowhere else, so unless we read it the user just lands on a
   * blank login screen wondering what happened.
   */
  linkError: string | null;
  dismissLinkError: () => void;
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  // Seeded from the URL rather than waiting for PASSWORD_RECOVERY, because that
  // event loses a race it cannot win: auth-js defers it behind a setTimeout,
  // while getSession() resolves in a microtask. The session therefore always
  // lands first, and a flag set only by the event would still be false on the
  // render that reads it — showing the dashboard to someone who came to reset
  // their password. The URL says `type=recovery` synchronously, so trust that.
  const [recovering, setRecovering] = useState(authCallback.type === 'recovery');
  const [linkError, setLinkError] = useState<string | null>(authCallback.errorDescription);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Belt and braces: the URL seed above is what actually catches recovery,
      // but honour the event too in case a link ever arrives by another route.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    // A failed link leaves its error in the address bar (auth-js only tidies the
    // hash on success). We've read it into state; drop it so a reload is clean.
    if (authCallback.errorDescription) clearAuthCallbackHash();
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    authConfigured,
    loading,
    user: session?.user ?? null,
    session,
    recovering,
    linkError,
    dismissLinkError: () => setLinkError(null),
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
    async sendPasswordReset(email) {
      if (!supabase) return;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      if (!supabase) return;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setRecovering(false);
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
