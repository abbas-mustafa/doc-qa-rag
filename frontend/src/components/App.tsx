'use client';

import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthProvider';
import LoginScreen from './LoginScreen';
import Dashboard from './Dashboard';

function Gate() {
  const { loading, authConfigured, session } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
      </div>
    );
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
