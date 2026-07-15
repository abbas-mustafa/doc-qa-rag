"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import clsx from "clsx";

/**
 * Adapted from abbas-portfolio's FusionCard (source of truth for the look).
 *
 * The signature card: glassy surface, a spotlight glow + lit border that follow
 * the cursor, and (optionally) a subtle 3D tilt toward the pointer. One mouse
 * tracker drives all of it so tilt and glow stay in sync.
 *
 * Departure from the portfolio version: the glow colour is a `tone` prop rather
 * than a hardcoded emerald, so cards can carry the same semantics as the rest of
 * the app — emerald for DocQA's own surfaces, sky for the user's content.
 */
const TONES = {
  accent: "52,211,153",
  "accent-2": "14,165,233",
} as const;

export default function FusionCard({
  children,
  className,
  tone = "accent",
  tilt = false,
  max = 5,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
  tilt?: boolean;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const rgb = TONES[tone];

  // pointer position in px (for glow) and 0..1 (for tilt)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const nx = useMotionValue(0.5);
  const ny = useMotionValue(0.5);

  const rx = useSpring(useTransform(ny, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(nx, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set(e.clientX - r.left);
    py.set(e.clientY - r.top);
    nx.set((e.clientX - r.left) / r.width);
    ny.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    setHover(false);
    nx.set(0.5);
    ny.set(0.5);
  };

  const glow = useMotionTemplate`radial-gradient(340px circle at ${px}px ${py}px, rgba(${rgb},0.15), transparent 70%)`;
  const borderGlow = useMotionTemplate`radial-gradient(240px circle at ${px}px ${py}px, rgba(${rgb},0.7), transparent 70%)`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      style={
        tilt
          ? { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", transformPerspective: 1000 }
          : undefined
      }
      className={clsx("group relative rounded-2xl", className)}
    >
      {/* lit border ring */}
      <motion.div
        aria-hidden
        style={{ background: borderGlow, opacity: hover ? 1 : 0 }}
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
      />
      <div className="relative h-full overflow-hidden rounded-2xl border border-line bg-card/60 backdrop-blur-md">
        {/* cursor glow */}
        <motion.div
          aria-hidden
          style={{ background: glow, opacity: hover ? 1 : 0 }}
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        />
        <div className="relative h-full">{children}</div>
      </div>
    </motion.div>
  );
}
