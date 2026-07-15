'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-line">
        <Sparkles className="h-4 w-4 text-accent" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-line bg-card/60 px-4 py-3 backdrop-blur-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent/70"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
