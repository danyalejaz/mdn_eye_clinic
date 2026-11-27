import { Link } from "@tanstack/react-router";
import { Mark } from "../components/ui";

export function PortalHome() {
  return (
    <div className="min-h-screen bg-canvas text-text font-body">
      <header className="bg-surface border-b border-border">
        <div className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter h-[64px] flex items-center gap-sm">
          <Mark />
          <span className="font-title text-card-title text-ink">Book a visit</span>
        </div>
      </header>
      <main className="max-w-public mx-auto px-mobile-gutter md:px-desktop-gutter py-3xl flex flex-col gap-lg">
        <h1 className="font-headline text-sm-page-title md:text-page-title text-ink">Appointment booking</h1>
        <p className="font-body text-body-md text-muted">
          Sign in with a patient account to confirm an open time, or to reschedule and cancel a visit you already booked.
        </p>
        <Link to="/sign-in" className="inline-flex items-center justify-center h-[48px] px-xl rounded-md bg-primary text-on-primary font-label text-label-md hover:bg-primary-hover w-fit">
          Sign in to book
        </Link>
      </main>
    </div>
  );
}
