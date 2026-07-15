'use client';

import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthProvider';
import LoginScreen from './LoginScreen';
import UpdatePasswordScreen from './UpdatePasswordScreen';
import Dashboard from './Dashboard';

function Gate() {
  const { loading, authConfigured, session, recovering } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Must precede the session check: a recovery link grants a real session, so
  // otherwise we'd drop the user into the dashboard with a password they've
  // already forgotten and no way to change it. The session is required, not
  // incidental — updateUser() needs one, so without it this screen could only
  // fail on submit, and the login screen is the more useful place to be.
  if (authConfigured && recovering && session) {
    return <UpdatePasswordScreen />;
  }

  // Real auth: require a session. Dev-bypass (no Supabase configured): go straight in.
  if (authConfigured && !session) {
    return <LoginScreen />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
