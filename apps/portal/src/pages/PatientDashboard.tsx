import { useEffect, useState } from "react";
import { api, failureMessage, publicDoctors } from "../api";
import { Mark, Notice, StatusBadge, controlClass, primaryButtonClass, secondaryButtonClass } from "../components/ui";
import { businessToday, formatWhen, money } from "../format";
import { clearSession } from "../session";
import type { Actor, Appointment, OpenSlot, PublicDoctor } from "../types";

export function PatientDashboard({ actor, doctorId, slotId }: { actor: Actor; doctorId: string; slotId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [chosenDoctor, setChosenDoctor] = useState(doctorId);
  const [date, setDate] = useState(businessToday());
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState<{ slotId: string; when: string; doctor: string } | null>(null);
  const canBook = actor.role === "patient" && Boolean(actor.patientId);

  async function reload() {
    if (actor.role !== "patient") return;
    const visits = await api<{ data: Appointment[] }>("/api/v1/appointments?limit=25");
    setAppointments(visits.data);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([reload(), publicDoctors()])
      .then(([, published]) => {
        if (active) setDoctors(published);
      })
      .catch((reason: unknown) => {
        if (active) setError(failureMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [actor.role]);

  useEffect(() => {
    if (!chosenDoctor) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    const params = new URLSearchParams({ from: date, to: date, doctorId: chosenDoctor });
    let active = true;
    setLoadingSlots(true);
    const load = () => {
      void api<{ data: OpenSlot[] }>(`/api/v1/public/availability?${params}`)
        .then((body) => {
          if (active) setSlots(body.data);
        })
        .catch((reason: unknown) => {
          if (active) setError(failureMessage(reason));
        })
        .finally(() => {
          if (active) setLoadingSlots(false);
        });
    };
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [chosenDoctor, date]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, select, textarea, button")) return;
      if (event.key.toLowerCase() === "b") document.getElementById("booking-doctor")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (reason) {
      setError(failureMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: {} });
    } finally {
      clearSession();
      window.location.assign("/");
    }
  }

  const upcoming = appointments.filter((item) => item.status === "confirmed" && Date.parse(item.scheduledAt) > Date.now());

  return (
    <div className="min-h-screen bg-canvas text-text font-body">
      <header className="bg-surface border-b border-border">
        <div className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter h-[64px] flex items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <Mark />
            <span className="font-title text-card-title text-ink">Book a visit</span>
          </div>
          <button type="button" onClick={() => void signOut()} className={secondaryButtonClass}>Sign out</button>
        </div>
      </header>
      <main className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter py-3xl flex flex-col gap-xl">
        {error ? <Notice>{error}</Notice> : null}
        {!canBook ? (
          <p className="font-body text-body-md text-muted">Appointment booking is available on patient accounts.</p>
        ) : (
          <section className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
            <h1 className="font-headline text-section-title text-ink">Choose a time</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <label className="flex flex-col gap-xs">
                <span className="font-label text-label-md text-ink">Doctor</span>
                <select id="booking-doctor" className={controlClass} value={chosenDoctor} onChange={(event) => setChosenDoctor(event.target.value)}>
                  <option value="">Choose a doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.displayName} · {money(doctor.feeMinor)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label text-label-md text-ink">Date</span>
                <input className={controlClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
            {loadingSlots ? (
              <div className="flex flex-col gap-sm" aria-busy="true" aria-label="Looking up open times">
                <span className="shimmer h-11 rounded-lg" />
                <span className="shimmer h-11 rounded-lg" />
              </div>
            ) : slots.length === 0 ? (
              <p className="font-body text-body-sm text-muted">No open slots for that doctor and date.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {slots.map((slot) => (
                  <li key={slot.slotId}>
                    <button
                      type="button"
                      className={slot.slotId === slotId ? primaryButtonClass : secondaryButtonClass}
                      disabled={pending}
                      onClick={() => {
                        const doctor = doctors.find((item) => item.id === slot.doctorId);
                        setConfirming({ slotId: slot.slotId, when: formatWhen(slot.startAt), doctor: doctor?.displayName ?? "Doctor" });
                        void run(() => api("/api/v1/appointments", {
                          body: { doctorId: slot.doctorId, slotId: slot.slotId },
                          idempotencyKey: crypto.randomUUID(),
                        }).then(() => undefined)).finally(() => setConfirming(null));
                      }}
                    >
                      {confirming?.slotId === slot.slotId ? "Confirming…" : `Confirm ${formatWhen(slot.startAt)}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canBook ? (
          <section className="flex flex-col gap-md">
            <h2 className="font-headline text-section-title text-ink">Your appointments</h2>
            {confirming ? (
              <article className="bg-surface border border-border rounded-lg p-xl">
                <p className="font-title text-card-title text-ink">{confirming.doctor}</p>
                <p className="font-body text-body-sm text-ink">{confirming.when}</p>
                <p className="font-caption text-caption text-muted">Confirming this visit…</p>
              </article>
            ) : null}
            {upcoming.length === 0 && !confirming ? <p className="font-body text-body-sm text-muted">No confirmed visit is scheduled.</p> : upcoming.map((item) => (
              <article key={item.id} className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-sm">
                <div className="flex items-start justify-between gap-md">
                  <div>
                    <p className="font-title text-card-title text-ink">{item.doctorName ?? "Doctor"}</p>
                    <p className="font-body text-body-sm text-ink tabular-nums">{formatWhen(item.scheduledAt)}</p>
                    <p className="font-caption text-caption text-muted tabular-nums">{item.reference} · {money(item.feeMinor)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex flex-wrap gap-sm">
                  <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => void run(() => api(`/api/v1/appointments/${item.id}/cancel`, { body: { expectedVersion: item.version } }).then(() => undefined))}>Cancel</button>
                  <button type="button" className={secondaryButtonClass} onClick={() => { setRescheduleId(item.id); setChosenDoctor(item.doctorId); }}>Reschedule</button>
                </div>
                {rescheduleId === item.id ? slots.filter((slot) => slot.slotId !== item.slotId).map((slot) => (
                  <button key={slot.slotId} type="button" className={primaryButtonClass} disabled={pending} onClick={() => void run(async () => {
                    await api(`/api/v1/appointments/${item.id}/reschedule`, { body: { slotId: slot.slotId, expectedVersion: item.version } });
                    setRescheduleId(null);
                  })}>
                    Move to {formatWhen(slot.startAt)}
                  </button>
                )) : null}
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
