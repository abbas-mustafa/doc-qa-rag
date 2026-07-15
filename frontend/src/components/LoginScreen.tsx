'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, MessageSquareText, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import { validateEmail, validatePassword } from '@/lib/validation';
import FusionCard from './fx/FusionCard';
import GradientText from './fx/GradientText';
import Magnetic from './fx/Magnetic';
import { GoogleIcon } from './BrandIcons';

type Mode = 'signin' | 'signup' | 'forgot';

const COPY: Record<Mode, { title: string; sub: string; action: string }> = {
  signin: { title: 'Welcome to', sub: 'Sign in to your workspaces', action: 'Sign in' },
  signup: { title: 'Join', sub: 'Create your account', action: 'Create account' },
  forgot: { title: 'Reset your', sub: "We'll email you a reset link", action: 'Send reset link' },
};

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithProvider, sendPasswordReset, linkError, dismissLinkError } =
    useAuth();
  // Arriving on a dead reset link means the one thing you wanted was a working
  // one, so open on the form that sends it rather than making you find it again.
  const [mode, setMode] = useState<Mode>(linkError ? 'forgot' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);

  // Errors surface only after a submit attempt, so the form doesn't scold you
  // for a half-typed address.
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setPassword('');
    setShowPassword(false);
    dismissLinkError();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const emailError = validateEmail(email);
    // Sign-in accepts any existing password; only sign-up enforces the policy.
    const passwordError =
      mode === 'forgot' ? null : mode === 'signup' ? validatePassword(password) : password ? null : 'Password is required.';

    if (emailError || passwordError) {
      setErrors({ email: emailError ?? undefined, password: passwordError ?? undefined });
      return;
    }
    setErrors({});
    setBusy(true);

    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(email.trim(), password);
        if (needsConfirmation) {
          toast.success('Check your email to confirm your account.');
          switchMode('signin');
        }
      } else if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await sendPasswordReset(email.trim());
        // Deliberately not revealing whether the address exists.
        toast.success('If that email has an account, a reset link is on its way.');
        switchMode('signin');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: 'google') {
    setOauthBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not sign in with ${provider}`);
      setOauthBusy(null);
    }
    // On success the browser redirects away, so `oauthBusy` is intentionally
    // left set — clearing it would flash the button back to idle mid-redirect.
  }

  const copy = COPY[mode];
  const inputBase =
    'w-full rounded-lg border bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted';

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
                  <MessageSquareText className="h-6 w-6 text-accent" />
                </div>
              </Magnetic>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
                  {copy.title} <GradientText>DocQA</GradientText>
                </h1>
                <p className="mt-1 text-sm text-muted">{copy.sub}</p>
              </div>
            </div>

            {linkError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-ink"
              >
                <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-danger" />
                <span>
                  {linkError}. Reset links work once and expire, so request a fresh one below.
                </span>
              </div>
            )}

            {mode !== 'forgot' && (
              <>
                {/*
                  Google only. Facebook needs the Meta app in Live mode, which
                  needs a hosted privacy policy and data-deletion endpoint —
                  standing overhead that outweighs one extra provider.
                */}
                <OAuthButton
                  label="Continue with Google"
                  icon={<GoogleIcon className="h-4 w-4" />}
                  busy={oauthBusy === 'google'}
                  disabled={Boolean(oauthBusy)}
                  onClick={() => handleOAuth('google')}
                />
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs uppercase tracking-wider text-muted">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  // "username", not "email": both are valid tokens, but they
                  // reach different machinery. "email" asks for address
                  // autofill (the contact-details store); "username" is what
                  // pairs with current-password to make this a *credential*
                  // form, which is what a password manager offers to fill.
                  autoComplete="username"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`${inputBase} ${
                    errors.email
                      ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger/40'
                      : 'border-line focus:border-accent-2/60 focus:ring-1 focus:ring-accent-2/40'
                  }`}
                />
                <FieldError id="email-error" message={errors.email} />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      className={`${inputBase} pr-10 ${
                        errors.password
                          ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger/40'
                          : 'border-line focus:border-accent-2/60 focus:ring-1 focus:ring-accent-2/40'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError id="password-error" message={errors.password} />
                </div>
              )}

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="-mt-1 self-end text-xs text-muted transition-colors hover:text-accent"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg shadow-md shadow-accent/20 transition-all hover:shadow-accent/30 disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {copy.action}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-muted">
              {mode === 'forgot' ? (
                <button
                  onClick={() => switchMode('signin')}
                  className="inline-flex items-center gap-1 font-medium text-accent transition-colors hover:text-accent/80"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </button>
              ) : (
                <>
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="font-medium text-accent transition-colors hover:text-accent/80"
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </>
              )}
            </div>
          </div>
        </FusionCard>
      </motion.div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden pt-1.5 text-xs text-danger"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function OAuthButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // w-full is load-bearing: a <button> shrink-wraps its content even as a
      // flex container, so without it this only filled the card back when a
      // flex-col wrapper was stretching it.
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-card disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
