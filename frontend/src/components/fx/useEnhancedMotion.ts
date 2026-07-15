"use client";

import { useEffect, useState } from "react";

/**
 * Ported from abbas-portfolio (source of truth) — keep in sync.
 *
 * True only on devices that can comfortably afford the heavy motion:
 * a real pointer (mouse) on a large screen, with reduced-motion off.
 * Phones/tablets (coarse pointer) get the lightweight, static experience.
 *
 * Defaults to `false` so the first paint (and SSR) is always the cheap one;
 * desktops upgrade after mount.
 */
export function useEnhancedMotion() {
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const canHover = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnhanced(canHover.matches && !reduce.matches);
    update();
    canHover.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      canHover.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  return enhanced;
}
