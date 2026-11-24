export function ClipzyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="clipzy-grad" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="var(--color-brand)" />
          <stop offset="0.5" stopColor="var(--color-brand-2)" />
          <stop offset="1" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="12" fill="url(#clipzy-grad)" opacity="0.18" />
      <rect x="3" y="3" width="42" height="42" rx="12" stroke="url(#clipzy-grad)" strokeWidth="1.5" />
      <path d="M19 17v14l13-7-13-7z" fill="url(#clipzy-grad)" />
      <circle cx="24" cy="24" r="22" stroke="url(#clipzy-grad)" strokeWidth="0.4" opacity="0.5" />
    </svg>
  );
}
