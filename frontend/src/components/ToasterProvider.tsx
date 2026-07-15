'use client';

import { Toaster } from 'react-hot-toast';

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        // Mirrors the --card / --ink / --line / --accent / --danger tokens in
        // globals.css. react-hot-toast takes inline styles, so these can't read
        // the CSS variables directly — they have to be kept in sync by hand.
        style: {
          background: 'rgba(15, 22, 19, 0.9)',
          color: '#eaf4ef',
          border: '1px solid rgba(52, 211, 153, 0.14)',
          backdropFilter: 'blur(8px)',
        },
        success: { iconTheme: { primary: '#34d399', secondary: '#0f1613' } },
        error: { iconTheme: { primary: '#f87171', secondary: '#0f1613' } },
      }}
    />
  );
}
