import clsx from "clsx";

/**
 * Ported from abbas-portfolio (source of truth) — keep in sync.
 *
 * Text filled with a continuously flowing gradient. The stops run through
 * DocQA's own two accents rather than the portfolio's emerald→sky→violet.
 */
export default function GradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "animate-gradient-text bg-gradient-to-r from-accent via-sky-300 to-accent-2",
        className
      )}
    >
      {children}
    </span>
  );
}
