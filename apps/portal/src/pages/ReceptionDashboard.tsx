import { CalendarCheck, CalendarDays, CalendarPlus, LayoutDashboard, ListOrdered, Receipt, UserPlus, Users } from "lucide-react";
import { Shell } from "../components/Shell";
import { Badge, Metric } from "../components/ui";

const rows = [
  { time: "09:00 AM", name: "Sample Patient 01", meta: "MRN-DEMO-001 · APT-2026-000001", doctor: "Demo Doctor A", status: "Checked in · A-024", tone: "info" as const, action: "View token" },
  { time: "09:20 AM", name: "Sample Patient 02", meta: "MRN-DEMO-002 · APT-2026-000002", doctor: "Demo Doctor A", status: "Confirmed", tone: "success" as const, action: "Check in" },
  { time: "09:40 AM", name: "Sample Patient 03", meta: "MRN-DEMO-003 · APT-2026-000003", doctor: "Demo Doctor B", status: "Pending", tone: "warning" as const, action: "Check in" },
];

export function ReceptionDashboard() {
  return (
    <Shell
      role="Receptionist"
      navLabel="Reception navigation"
      footer="Front desk scope · No clinical notes"
      user={{ initials: "R1", name: "Front Desk Staff" }}
      items={[
        { to: "/reception", label: "Overview", icon: LayoutDashboard, current: true },
        { to: "/reception", label: "Patients", icon: Users },
        { to: "/reception", label: "Appointments", icon: CalendarCheck },
        { to: "/reception", label: "Calendar", icon: CalendarDays },
        { to: "/reception", label: "Queue", icon: ListOrdered },
        { to: "/reception", label: "Billing", icon: Receipt },
      ]}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Reception dashboard</h1>
          <p className="font-body text-body-sm text-muted">Manage today’s arrivals, check-ins, walk-in bookings, and fee collection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <button type="button" className="inline-flex items-center justify-center gap-xs h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft">
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            Register patient
          </button>
          <button type="button" className="inline-flex items-center justify-center gap-xs h-[44px] px-lg rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover">
            <CalendarPlus className="w-4 h-4" aria-hidden="true" />
            New appointment
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-lg">
        <Metric label="Booked today" value="18" />
        <Metric label="Arrived / Checked in" value="6" tone="info" />
        <Metric label="Waiting in queue" value="4" tone="warning" />
        <Metric label="Completed" value="7" tone="success" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
        <section className="lg:col-span-8 bg-surface border border-border rounded-lg p-xl flex flex-col gap-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <h2 className="font-headline text-section-title text-ink">Today’s appointments</h2>
            <label className="sr-only" htmlFor="rec-doctor-filter">Filter by doctor</label>
            <select id="rec-doctor-filter" className="h-[44px] px-md rounded-md bg-surface text-text border border-control-border font-body text-body-sm" defaultValue="all">
              <option value="all">All doctors</option>
              <option>Demo Doctor A</option>
              <option>Demo Doctor B</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  {["Time", "Patient", "Doctor", "Status"].map((heading) => (
                    <th key={heading} scope="col" className="py-md px-md font-label text-label-md text-ink">{heading}</th>
                  ))}
                  <th scope="col" className="py-md px-md font-label text-label-md text-ink text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.meta} className="h-[52px]">
                    <td className="py-md px-md font-body text-body-sm text-ink tabular-nums">{row.time}</td>
                    <td className="py-md px-md">
                      <div className="font-label text-label-md text-ink">{row.name}</div>
                      <div className="font-caption text-caption text-muted tabular-nums">{row.meta}</div>
                    </td>
                    <td className="py-md px-md font-body text-body-sm text-text">{row.doctor}</td>
                    <td className="py-md px-md"><Badge tone={row.tone}>{row.status}</Badge></td>
                    <td className="py-md px-md text-right">
                      <button type="button" className="h-[36px] px-md rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover whitespace-nowrap">
                        {row.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="lg:col-span-4 flex flex-col gap-lg">
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
            <div className="flex flex-wrap items-center justify-between gap-xs">
              <h2 className="font-headline text-section-title text-ink">Queue summary</h2>
              <span className="font-caption text-caption text-muted tabular-nums">Updated 09:15 AM</span>
            </div>
            <div className="p-md rounded-md bg-primary-soft border border-border flex items-center justify-between gap-md">
              <div>
                <span className="font-caption text-caption text-primary">Now serving</span>
                <p className="font-headline text-headline-md text-ink tabular-nums">A-024</p>
              </div>
              <span className="font-body text-body-sm text-text">Room 1 · Demo Doctor A</span>
            </div>
            <button type="button" className="inline-flex items-center justify-center h-[44px] px-lg rounded-md bg-surface text-primary border border-control-border font-label text-label-md hover:bg-primary-soft">
              Open queue board
            </button>
          </article>
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
            <h2 className="font-headline text-section-title text-ink">Daily collections</h2>
            <div className="flex items-baseline justify-between">
              <span className="font-body text-body-sm text-muted">Verified total</span>
              <span className="font-metric text-metric text-ink tabular-nums">Rs. 16,500</span>
            </div>
            <div className="flex flex-col gap-xs pt-sm border-t border-border font-body text-body-sm">
              <div className="flex justify-between"><span className="text-muted">Cash</span><span className="text-ink tabular-nums">Rs. 12,000</span></div>
              <div className="flex justify-between"><span className="text-muted">Bank transfer</span><span className="text-ink tabular-nums">Rs. 4,500</span></div>
            </div>
          </article>
        </div>
      </div>
    </Shell>
  );
}
