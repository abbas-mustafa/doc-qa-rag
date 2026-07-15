"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEnhancedMotion } from "./useEnhancedMotion";

/**
 * Adapted from abbas-portfolio's FusionBackground (source of truth for the look).
 *
 * Two deliberate departures from the portfolio version:
 *
 * 1. No scroll parallax. The portfolio drives blob offsets from `useScroll()`,
 *    but the DocQA shell is `h-dvh overflow-hidden` — the window never scrolls,
 *    so scrollYProgress would sit at 0 forever. Dropped rather than ported dead.
 *
 * 2. Lower alphas (0.14/0.12/0.08 vs the portfolio's 0.20/0.18/0.14). A landing
 *    page is glanced at; a workspace is stared at for an hour. The backdrop has
 *    to stay behind the text it sits under.
 *
 * Performance note: the blobs are soft *by gradient*, not by `filter: blur()`.
 * A large blur() over
 * a ~40rem element is an expensive convolution, and animating it re-runs that
 * convolution every frame while forcing every backdrop-blur above it to
 * re-sample. Multi-stop gradients approximate the same falloff for free,
 * leaving only compositor-level transforms to animate.
 */
const GRID = {
  backgroundImage:
    "linear-gradient(rgba(52,211,153,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,0.05) 1px,transparent 1px)",
  backgroundSize: "56px 56px",
  maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
  WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
} as const;

/** Eased falloff that mimics a Gaussian blur without the filter cost. */
const soft = (rgb: string, a: number) =>
  `radial-gradient(circle closest-side,` +
  ` rgba(${rgb},${a}),` +
  ` rgba(${rgb},${(a * 0.72).toFixed(3)}) 30%,` +
  ` rgba(${rgb},${(a * 0.32).toFixed(3)}) 55%,` +
  ` rgba(${rgb},${(a * 0.1).toFixed(3)}) 75%,` +
  ` transparent 100%)`;

const EMERALD = "52,211,153";
const SKY = "14,165,233";

const BLOBS = [
  { pos: "-top-40 left-1/4 h-[46rem] w-[46rem]", rgb: EMERALD, a: 0.14 },
  { pos: "top-1/3 -right-40 h-[40rem] w-[40rem]", rgb: SKY, a: 0.12 },
  { pos: "bottom-0 left-1/3 h-[38rem] w-[38rem]", rgb: EMERALD, a: 0.08 },
];

export default function FusionBackground() {
  const enhanced = useEnhancedMotion();

  // Hooks must run unconditionally; their values are only used when enhanced.
  const mx = useMotionValue(-1000);
  const my = useMotionValue(-1000);
  const sx = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (!enhanced) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [enhanced, mx, my]);

  // Translate a fixed gradient instead of repainting a full-viewport
  // `background` string on every frame.
  const glowX = useTransform(sx, (v) => v - 600);
  const glowY = useTransform(sy, (v) => v - 600);

  // Lightweight static version for phones / reduced-motion.
  if (!enhanced) {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
        <div className="absolute inset-0 opacity-40" style={GRID} />
        {BLOBS.map((b, i) => (
          <div
            key={i}
            className={`absolute ${b.pos} rounded-full`}
            style={{ background: soft(b.rgb, b.a) }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="absolute inset-0 opacity-40" style={GRID} />

      {BLOBS.map((b, i) => (
        <div key={i} className={`absolute ${b.pos}`}>
          <motion.div
            className="h-full w-full rounded-full"
            style={{ background: soft(b.rgb, b.a), willChange: "transform" }}
            animate={{ x: [0, 100, -60, 0], y: [0, 70, 30, 0] }}
            transition={{ duration: 22 + i * 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      ))}

      {/* cursor glow — moved by transform, not by repainting `background` */}
      <motion.div
        className="absolute left-0 top-0 h-[1200px] w-[1200px] rounded-full"
        style={{
          x: glowX,
          y: glowY,
          background: soft(EMERALD, 0.07),
          willChange: "transform",
        }}
      />
    </div>
  );
}
