'use client';

import { Toaster } from 'react-hot-toast';

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(24, 24, 30, 0.9)',
          color: '#f4f4f5',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
        },
        success: { iconTheme: { primary: '#a78bfa', secondary: '#18181e' } },
        error: { iconTheme: { primary: '#f87171', secondary: '#18181e' } },
      }}
    />
  );
}
