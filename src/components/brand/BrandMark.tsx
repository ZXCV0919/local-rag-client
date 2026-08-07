export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--color-accent, #0f766e)" />
      <path
        d="M8 7h12a3 3 0 0 1 3 3v15H11a3 3 0 0 0-3 3V7z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M20 7l3 3h-3V7z" fill="#fff" opacity="0.9" />
    </svg>
  );
}
