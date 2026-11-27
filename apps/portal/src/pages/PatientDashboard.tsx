import { Link } from "@tanstack/react-router";
import { Bell, Calendar, CalendarPlus, FileText, Folder, Home, Menu, Pill, Receipt, User } from "lucide-react";
import { patient } from "../fixtures";
import { Shell } from "../components/Shell";
import { Badge } from "../components/ui";

export function PatientDashboard() {
  return (
    <Shell
      role="Patient Portal"
      navLabel="Patient navigation"
      footer={`Linked record · ${patient.mrn}`}
      user={{ initials: patient.initials, name: patient.name }}
      items={[
        { to: "/patient", label: "Home", icon: Home, current: true },
        { to: "/patient", label: "Appointments", icon: Calendar },
        { to: "/patient", label: "Medical history", icon: FileText },
        { to: "/patient", label: "Prescriptions", icon: Pill },
        { to: "/patient", label: "Documents", icon: Folder },
        { to: "/patient", label: "Billing", icon: Receipt },
        { to: "/patient", label: "Profile & Settings", icon: User },
      ]}
      mobile={[
        { to: "/patient", label: "Home", icon: Home, current: true },
        { to: "/patient", label: "Appointments", icon: Calendar },
        { to: "/patient", label: "Records", icon: FileText },
        { to: "/", label: "More", icon: Menu },
      ]}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Welcome, {patient.name}</h1>
          <p className="font-body text-body-sm text-muted tabular-nums">
            {patient.mrn} · Verified phone {patient.phone}
          </p>
        </div>
        <Link
          to="/patient"
          className="inline-flex items-center justify-center gap-sm h-[44px] px-lg rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 shrink-0"
        >
          <CalendarPlus className="w-5 h-5" aria-hidden="true" />
          Book appointment
        </Link>
      </div>

      <div role="status" className="flex items-start gap-md p-lg rounded-md bg-info-soft text-info border border-border">
        <Bell className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-xs">
          <span className="font-label text-label-md">Appointment reminder</span>
          <span className="font-body text-body-sm">
            Please arrive 15 minutes before your scheduled visit on Tue, 1 Dec 2026 at 9:00 AM.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-stretch">
        <article className="lg:col-span-7 bg-surface border border-border rounded-lg p-xl flex flex-col justify-between gap-lg">
          <div className="flex flex-col gap-md">
            <header className="flex items-start justify-between gap-md">
              <div>
                <span className="font-caption text-caption text-muted">Upcoming appointment</span>
                <h2 className="font-headline text-section-title text-ink">Demo Doctor A</h2>
                <p className="font-body text-body-sm text-muted">General Medicine · Consultation Rs. 1,500</p>
              </div>
              <Badge tone="success">Confirmed</Badge>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md p-md rounded-md bg-surface-alt border border-border">
              <div>
                <span className="font-caption text-caption text-muted">Date & time</span>
                <p className="font-label text-label-md text-ink tabular-nums">Tue, 1 Dec 2026 · 9:00 AM</p>
              </div>
              <div>
                <span className="font-caption text-caption text-muted">Booking reference</span>
                <p className="font-label text-label-md text-ink tabular-nums">APT-2026-000001</p>
              </div>
            </div>
          </div>
          <footer className="flex flex-wrap items-center gap-md pt-md border-t border-border">
            <Link to="/patient" className="inline-flex items-center justify-center h-[44px] px-lg rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover">
              View appointment
            </Link>
            <Link to="/patient" className="inline-flex items-center justify-center h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft">
              Reschedule
            </Link>
          </footer>
        </article>

        <div className="lg:col-span-5 flex flex-col gap-lg">
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-sm">
              <span className="font-caption text-caption text-muted">Recent released visit</span>
              <Badge tone="success">Released</Badge>
            </div>
            <h3 className="font-title text-card-title text-ink">Follow-up consultation</h3>
            <p className="font-body text-body-sm text-muted tabular-nums">Thu, 12 Nov 2026 · Demo Doctor A</p>
            <p className="font-body text-body-sm text-text">Patient-facing care instructions and follow-up schedule released for your review.</p>
          </article>
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-sm">
              <span className="font-caption text-caption text-muted">Latest approved prescription</span>
              <Badge tone="success">Approved</Badge>
            </div>
            <h3 className="font-title text-card-title text-ink tabular-nums">RX-2026-000012</h3>
            <p className="font-body text-body-sm text-muted tabular-nums">Issued 12 Nov 2026 · PDF ready</p>
          </article>
        </div>
      </div>

      <section className="flex flex-col gap-md">
        <h2 className="font-headline text-section-title text-ink">Quick shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
          {[
            { icon: Calendar, label: "My appointments" },
            { icon: FileText, label: "Released history" },
            { icon: Pill, label: "Prescriptions" },
            { icon: Receipt, label: "Billing & receipts" },
          ].map(({ icon: Icon, label }) => (
            <Link key={label} to="/patient" className="bg-surface border border-border rounded-lg p-lg flex items-center gap-md hover:border-primary transition-colors duration-quick">
              <Icon className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
              <span className="font-label text-label-md text-ink">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
