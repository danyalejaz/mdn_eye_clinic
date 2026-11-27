import { BarChart2, CalendarClock, Globe, LayoutDashboard, Settings, ShieldCheck, Stethoscope, UserCog, BriefcaseMedical } from "lucide-react";
import { Shell } from "../components/Shell";
import { Badge, Metric } from "../components/ui";

const breakdown = [
  ["Completed", "61"],
  ["Confirmed / Scheduled", "16"],
  ["Cancelled", "5"],
  ["No-show", "2"],
];

export function AdminDashboard() {
  return (
    <Shell
      role="Administrator"
      navLabel="Administration navigation"
      footer="Operations only · No clinical notes"
      user={{ initials: "A1", name: "Clinic Admin" }}
      items={[
        { to: "/admin", label: "Overview", icon: LayoutDashboard, current: true },
        { to: "/admin", label: "Staff", icon: UserCog },
        { to: "/admin", label: "Doctors", icon: Stethoscope },
        { to: "/admin", label: "Services", icon: BriefcaseMedical },
        { to: "/admin", label: "Schedules", icon: CalendarClock },
        { to: "/admin", label: "Website content", icon: Globe },
        { to: "/admin", label: "Reports", icon: BarChart2 },
        { to: "/admin", label: "Audit", icon: ShieldCheck },
        { to: "/admin", label: "Settings", icon: Settings },
      ]}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Admin overview</h1>
          <p className="font-body text-body-sm text-muted">Clinic Name · Mardan, Pakistan · Asia/Karachi · Currency PKR</p>
        </div>
        <Badge tone="success">Public website: Published</Badge>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
        <Metric label="Appointments (7 days)" value="84" />
        <Metric label="Verified collections (7 days)" value="Rs. 94,500" />
        <Metric label="Published doctors" value="3" />
        <Metric label="Pending staff invites" value="1" tone="warning" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
        <section className="lg:col-span-6 bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
          <h2 className="font-headline text-section-title text-ink">Appointment status breakdown</h2>
          <div className="flex flex-col gap-sm pt-xs">
            {breakdown.map(([label, value], index) => (
              <div key={label} className={`flex items-center justify-between py-xs ${index < breakdown.length - 1 ? "border-b border-border" : ""}`}>
                <span className="font-body text-body-sm text-text">{label}</span>
                <span className="font-label text-label-md text-ink tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="lg:col-span-6 flex flex-col gap-lg">
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-md">
            <h2 className="font-headline text-section-title text-ink">Staff & invitations</h2>
            <div className="flex items-center justify-between gap-md p-md rounded-md bg-surface-alt border border-border">
              <div>
                <p className="font-label text-label-md text-ink">reception.new@clinic.example.test</p>
                <p className="font-caption text-caption text-muted">Role: Receptionist · Expires in 48h</p>
              </div>
              <Badge tone="warning">Invite pending</Badge>
            </div>
          </article>
          <article className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-md">
              <h2 className="font-headline text-section-title text-ink">Backup & recovery status</h2>
              <Badge tone="success">Verified</Badge>
            </div>
            <p className="font-body text-body-sm text-muted tabular-nums">Last verified snapshot: Fri, 27 Nov 2026 · 03:00 AM</p>
          </article>
        </div>
      </div>
    </Shell>
  );
}
