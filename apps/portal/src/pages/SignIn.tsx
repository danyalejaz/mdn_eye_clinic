import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Mark, Notice, controlClass, primaryButtonClass } from "../components/ui";
import { loadSession } from "../session";

export function SignIn({ booking }: { booking: { doctorId: string; slotId: string; date?: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json().catch(() => null)) as { twoFactorRedirect?: boolean } | null;
      if (body?.twoFactorRedirect || !response.ok) {
        setError(body?.twoFactorRedirect ? "This page is for patient appointment booking." : "Email or password was not accepted.");
        return;
      }
      const session = await loadSession(true);
      if (session.state !== "ready" || session.actor.role !== "patient") {
        setError("This page is for patient appointment booking.");
        return;
      }
      await router.navigate({ to: "/patient", search: booking });
    } catch {
      setError("The clinic service is unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-text font-body">
      <main className="max-w-[32rem] mx-auto px-mobile-gutter py-3xl flex flex-col gap-xl">
        <div className="flex items-center gap-sm">
          <Mark />
          <span className="font-title text-card-title text-ink">Book a visit</span>
        </div>
        <h1 className="font-headline text-sm-page-title text-ink">Patient sign-in</h1>
        {error ? <Notice>{error}</Notice> : null}
        <form onSubmit={(event) => void submit(event)} className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label text-label-md text-ink">Email</span>
            <input className={controlClass} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label text-label-md text-ink">Password</span>
            <input className={controlClass} type="password" autoComplete="current-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className={primaryButtonClass} type="submit" disabled={pending}>{pending ? "Signing in…" : "Continue"}</button>
        </form>
      </main>
    </div>
  );
}
