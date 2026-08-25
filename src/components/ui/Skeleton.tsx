/**
 * Bare pulsing block — the one shape every loading.tsx composes from, so a
 * skeleton always uses the design system's own tokens (bg-line-soft-2)
 * instead of a hardcoded gray that would look foreign against bg-surface.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line-soft-2 ${className}`} />;
}
