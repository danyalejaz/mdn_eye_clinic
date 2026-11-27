import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mark } from "./ui";

export function AppointmentLayout({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-text font-body">
      <a href="#main-content" className="portal-skip">Skip to main content</a>
      <header className="bg-surface border-b border-border">
        <div className="portal-wrap portal-header">
          <Link to="/" className="portal-brand">
            <Mark />
            <span>Mardan Eye Clinic<small>Patient appointments</small></span>
          </Link>
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}
