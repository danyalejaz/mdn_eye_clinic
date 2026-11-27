import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { clinic } from "../fixtures";
import { Mark } from "./ui";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  current?: boolean;
};

export function Shell({
  role,
  navLabel,
  items,
  user,
  footer,
  mobile,
  children,
}: {
  role: string;
  navLabel: string;
  items: NavItem[];
  user: { initials: string; name: string };
  footer: string;
  mobile?: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="bg-canvas text-text font-body min-h-screen flex">
      <aside className="hidden lg:flex w-sidebar min-h-screen bg-surface border-r border-border flex-col justify-between p-lg shrink-0">
        <div className="flex flex-col gap-xl">
          <Link to="/" className="flex items-center gap-sm px-sm h-[40px] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Mark />
            <span className="font-title text-card-title text-ink">{clinic.name}</span>
          </Link>
          <nav aria-label={navLabel} className="flex flex-col gap-xs">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={item.current ? "page" : undefined}
                  className={
                    item.current
                      ? "flex items-center gap-md h-[44px] px-md rounded-md bg-primary-soft text-primary font-label text-label-md"
                      : "flex items-center gap-md h-[44px] px-md rounded-md text-text hover:bg-surface-alt font-body text-body-sm"
                  }
                >
                  <Icon className={`w-5 h-5 ${item.current ? "" : "text-muted"}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="pt-lg border-t border-border px-sm">
          <span className="font-caption text-caption text-muted">{footer}</span>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${mobile ? "pb-24 lg:pb-0" : ""}`}>
        <header className="h-[64px] bg-surface border-b border-border px-mobile-gutter md:px-tablet-gutter lg:px-desktop-gutter flex items-center justify-between gap-md sticky top-0 z-20">
          <div className="flex items-center gap-md min-w-0">
            <span className="inline-flex items-center px-md py-xs rounded-full bg-primary-soft text-primary font-caption text-caption shrink-0">
              {role}
            </span>
            <span className="hidden sm:inline-block font-body text-body-sm text-muted tabular-nums truncate">{clinic.dateLabel}</span>
          </div>
          <div className="flex items-center gap-md">
            <button
              type="button"
              aria-label="Notifications"
              className="relative inline-flex items-center justify-center w-[44px] h-[44px] rounded-md border border-border bg-surface hover:bg-surface-alt"
            >
              <Bell className="w-5 h-5 text-ink" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-sm pl-sm border-l border-border">
              <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-label text-label-md">
                {user.initials}
              </div>
              <span className="hidden sm:inline-block font-label text-label-md text-ink">{user.name}</span>
            </div>
          </div>
        </header>
        <main className="p-mobile-gutter md:p-tablet-gutter lg:p-desktop-gutter flex flex-col gap-xl max-w-public w-full">
          {children}
        </main>
      </div>

      {mobile ? (
        <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border h-[64px] grid grid-cols-4 z-30">
          {mobile.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-xs font-caption text-caption ${item.current ? "text-primary" : "text-muted"}`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
