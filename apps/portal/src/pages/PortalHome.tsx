import { Link } from "@tanstack/react-router";
import { clinic } from "../fixtures";
import { Mark } from "../components/ui";

const roles = [
  { to: "/patient", title: "Patient", detail: "Upcoming visit, released summary, and approved prescription." },
  { to: "/reception", title: "Reception", detail: "Today’s arrivals, check-in, queue token, and collections." },
  { to: "/doctor", title: "Doctor", detail: "Called patient, allergy prompt, and the day’s schedule." },
  { to: "/admin", title: "Administrator", detail: "Seven-day totals, staff invite, and backup status." },
] as const;

export function PortalHome() {
  return (
    <div className="min-h-screen bg-canvas text-text font-body">
      <header className="bg-surface border-b border-border">
        <div className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter h-[64px] flex items-center gap-sm">
          <Mark />
          <span className="font-title text-card-title text-ink">{clinic.name}</span>
        </div>
      </header>
      <main className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter py-3xl flex flex-col gap-xl">
        <div className="flex flex-col gap-sm max-w-prose">
          <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Demo portal</h1>
          <p className="font-body text-body-md text-muted">
            Sample screens for the four clinic roles. Sign-in is not connected yet, and every record on these pages is fictional.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
          {roles.map((role) => (
            <Link
              key={role.to}
              to={role.to}
              className="bg-surface border border-border rounded-lg p-xl flex flex-col gap-sm hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <span className="font-title text-card-title text-ink">{role.title}</span>
              <span className="font-body text-body-sm text-muted">{role.detail}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
