import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { PatientDashboard } from "./pages/PatientDashboard";
import { PortalHome } from "./pages/PortalHome";
import { SignIn } from "./pages/SignIn";
import { loadSession } from "./session";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

function bookingSearch(search: Record<string, unknown>): { doctorId: string; slotId: string; date?: string } {
  const date = typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
    ? search.date : undefined;
  return {
    doctorId: typeof search.doctorId === "string" ? search.doctorId : "",
    slotId: typeof search.slotId === "string" ? search.slotId : "",
    date,
  };
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    const session = await loadSession();
    if (session.state === "ready" && session.actor.role === "patient") {
      throw redirect({ to: "/patient", search: { doctorId: "", slotId: "" } });
    }
  },
  component: PortalHome,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: bookingSearch,
  beforeLoad: async ({ search }) => {
    const session = await loadSession();
    if (session.state === "ready" && session.actor.role === "patient") {
      throw redirect({ to: "/patient", search });
    }
  },
  component: function PatientSignIn() {
    return <SignIn booking={signInRoute.useSearch()} />;
  },
});

const patientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/patient",
  validateSearch: bookingSearch,
  beforeLoad: async ({ search }) => {
    const session = await loadSession();
    if (session.state !== "ready") throw redirect({ to: "/sign-in", search });
    return { actor: session.actor };
  },
  component: function BookingScreen() {
    const { actor } = patientRoute.useRouteContext();
    const { doctorId, slotId, date } = patientRoute.useSearch();
    return <PatientDashboard actor={actor} doctorId={doctorId} slotId={slotId} initialDate={date} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, patientRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
