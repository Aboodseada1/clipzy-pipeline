"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FadeIn, motion } from "@/components/ui/motion";
import { ClipzyMark } from "@/components/brand";
import { Loader2 } from "lucide-react";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@clipzy.aaseada.com");
  const [password, setPassword] = useState("clipzy-launch-2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials. Check the seeded operator account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-50"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, color-mix(in oklab, var(--color-brand) 22%, transparent), transparent 40%), radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--color-brand-2) 22%, transparent), transparent 40%)",
          backgroundSize: "200% 200%",
        }}
      />
      <FadeIn className="relative w-full max-w-md">
        <div className="glow-border rounded-3xl">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)]/85 glass p-8 shadow-2xl">
            <div className="mb-8 flex flex-col items-center text-center">
              <ClipzyMark className="h-12 w-12" />
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Clipzy</h1>
              <p className="text-sm text-[var(--color-muted)]">Autonomous short-form pipeline — control plane</p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button type="submit" disabled={loading} size="lg" className="mt-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
              Two operators are seeded by <code className="rounded bg-[var(--color-base)]/60 px-1.5 py-0.5">npm run db:seed</code>.
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
