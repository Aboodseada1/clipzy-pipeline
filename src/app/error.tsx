"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-[var(--color-muted)]">An unexpected error occurred. The pipeline state is preserved — you can retry safely.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/dashboard"><Button variant="secondary">Back to dashboard</Button></Link>
      </div>
    </div>
  );
}
