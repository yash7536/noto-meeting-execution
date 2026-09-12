// The Noto product wordmark — text-only, no icon/symbol/graphic. This is
// the single logo asset in the codebase; import this component wherever
// the brand mark is needed instead of writing the product name inline.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface ${className}`}
    >
      Noto
    </span>
  );
}
