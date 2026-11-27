import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { AppointmentLayout } from "../components/AppointmentLayout";
import { Notice, controlClass, primaryButtonClass } from "../components/ui";
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
    <AppointmentLayout>
      <main id="main-content" tabIndex={-1} className="portal-wrap portal-entry">
        <form onSubmit={(event) => void submit(event)} className="portal-panel" aria-labelledby="sign-in-title">
          <h1 id="sign-in-title">Patient sign-in</h1>
          <p className="text-muted mb-md">{booking.slotId ? "Sign in to continue with the time you selected." : "Use your clinic patient account to continue."}</p>
          {error ? <Notice>{error}</Notice> : null}
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
        <section className="portal-intro" aria-labelledby="entry-title">
          <p className="portal-eyebrow">Patient appointments</p>
          <h2 id="entry-title">Book or manage a visit</h2>
          <p>Confirm a new appointment or manage a visit you’ve already booked.</p>
        </section>
      </main>
    </AppointmentLayout>
  );
}
