import { AlertTriangle, CalendarDays, Clock, LayoutDashboard, ListOrdered, Pill, User, Users } from "lucide-react";
import { Shell } from "../components/Shell";
import { Badge, Metric } from "../components/ui";

export function DoctorDashboard() {
  return (
    <Shell
      role="Doctor"
      navLabel="Doctor navigation"
      footer="Care relationship required"
      user={{ initials: "DA", name: "Demo Doctor A" }}
      items={[
        { to: "/doctor", label: "Overview", icon: LayoutDashboard, current: true },
        { to: "/doctor", label: "Calendar", icon: CalendarDays },
        { to: "/doctor", label: "Queue", icon: ListOrdered },
        { to: "/doctor", label: "Patients", icon: Users },
        { to: "/doctor", label: "Prescriptions", icon: Pill },
        { to: "/doctor", label: "Availability", icon: Clock },
        { to: "/doctor", label: "Profile", icon: User },
      ]}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Doctor dashboard</h1>
          <p className="font-body text-body-sm text-muted">Your active queue, scheduled outpatient visits, and recent encounters. Shift 9:00 AM – 2:00 PM.</p>
        </div>
        <button type="button" className="inline-flex items-center justify-center h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft shrink-0">
          Open queue
        </button>
      </div>

      <section className="bg-surface border border-border rounded-lg p-xl flex flex-col lg:flex-row lg:items-center justify-between gap-lg">
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-sm">
            <Badge tone="info">Called · Token A-024</Badge>
            <span className="font-caption text-caption text-muted tabular-nums">Arrived 08:52 AM</span>
          </div>
          <h2 className="font-headline text-section-title text-ink">
            Sample Patient 01 · <span className="tabular-nums text-muted">MRN-DEMO-001</span>
          </h2>
          <div role="alert" className="inline-flex items-center gap-xs px-md py-xs rounded-md bg-warning-soft text-warning font-body text-body-sm w-fit">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Allergy status not recorded — confirm before prescribing</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-md shrink-0">
          <button type="button" className="inline-flex items-center justify-center h-[44px] px-xl rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover">
            Start consultation
          </button>
          <button type="button" className="inline-flex items-center justify-center h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft">
            View history
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-lg">
        <Metric label="Scheduled today" value="12" />
        <Metric label="Waiting in queue" value="3" tone="warning" />
        <Metric label="Finalized encounters" value="5" tone="success" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
        <section className="lg:col-span-7 bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
          <h2 className="font-headline text-section-title text-ink">Upcoming appointments</h2>
          <div className="divide-y divide-border">
            <div className="py-md flex items-center justify-between gap-md">
              <div>
                <p className="font-label text-label-md text-ink">Sample Patient 02</p>
                <p className="font-caption text-caption text-muted tabular-nums">09:20 AM · MRN-DEMO-002 · Follow-up</p>
              </div>
              <Badge tone="warning">Waiting</Badge>
            </div>
            <div className="py-md flex items-center justify-between gap-md">
              <div>
                <p className="font-label text-label-md text-ink">Sample Patient 04</p>
                <p className="font-caption text-caption text-muted tabular-nums">09:40 AM · MRN-DEMO-004 · New visit</p>
              </div>
              <Badge tone="success">Confirmed</Badge>
            </div>
          </div>
        </section>
        <section className="lg:col-span-5 bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
          <h2 className="font-headline text-section-title text-ink">Recent completed</h2>
          <div className="divide-y divide-border">
            <div className="py-md flex items-center justify-between gap-md">
              <div>
                <p className="font-label text-label-md text-ink">Sample Patient 05</p>
                <p className="font-caption text-caption text-muted tabular-nums">08:40 AM · MRN-DEMO-005</p>
              </div>
              <Badge tone="success">Released</Badge>
            </div>
            <div className="py-md flex items-center justify-between gap-md">
              <div>
                <p className="font-label text-label-md text-ink">Sample Patient 06</p>
                <p className="font-caption text-caption text-muted tabular-nums">08:20 AM · MRN-DEMO-006</p>
              </div>
              <Badge tone="neutral">Finalized</Badge>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
