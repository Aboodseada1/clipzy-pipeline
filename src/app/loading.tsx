export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand)]" />
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      </div>
    </div>
  );
}
