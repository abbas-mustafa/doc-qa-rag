'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import { validatePassword } from '@/lib/validation';
import FusionCard from './fx/FusionCard';
import GradientText from './fx/GradientText';
import Magnetic from './fx/Magnetic';

/**
 * Shown when the user arrives from a password-recovery email. Supabase has
 * already granted a real session by this point, so this screen is the only
 * thing standing between the link and the dashboard — see `recovering` in
 * AuthProvider.
 */
export default function UpdatePasswordScreen() {
  const { updatePassword, signOut, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const policyError = validatePassword(password);
    if (policyError) return setError(policyError);
    if (password !== confirm) return setError('Passwords do not match.');

    setError(null);
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('Password updated. You are signed in.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  const inputBase =
    'w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent-2/60 focus:ring-1 focus:ring-accent-2/40';

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <FusionCard>
          <div className="p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <Magnetic strength={0.25}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 shadow-lg shadow-accent/20 ring-1 ring-line">
                  <KeyRound className="h-6 w-6 text-accent" />
                </div>
              </Magnetic>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
                  Set a new <GradientText>password</GradientText>
                </h1>
                <p className="mt-1 text-sm text-muted">Choose something you haven&apos;t used before.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              {/*
                Read-only, but a real field rather than plain text: a password
                manager needs a username next to new-password to know which
                credential it is being asked to update, and it reads that from
                the form, not from prose. It doubles as confirmation of whose
                account this link opened.
              */}
              <input
                type="email"
                id="username"
                name="username"
                autoComplete="username"
                value={user?.email ?? ''}
                readOnly
                tabIndex={-1}
                aria-label="Account being updated"
                className={`${inputBase} cursor-default text-muted`}
              />

              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  id="new-password"
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  autoFocus
                  className={`${inputBase} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <input
                type={show ? 'text' : 'password'}
                id="confirm-password"
                name="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className={inputBase}
              />

              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg shadow-md shadow-accent/20 transition-all hover:shadow-accent/30 disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Update password
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted">
              <button
                onClick={() => signOut()}
                className="font-medium text-accent transition-colors hover:text-accent/80"
              >
                Cancel and sign out
              </button>
            </p>
          </div>
        </FusionCard>
      </motion.div>
    </div>
  );
}
