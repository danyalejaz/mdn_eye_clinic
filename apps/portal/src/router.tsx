import { createRootRoute, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import { PatientDashboard } from "./pages/PatientDashboard";
import { PortalHome } from "./pages/PortalHome";
import { SignIn } from "./pages/SignIn";
import { loadSession } from "./session";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

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
  beforeLoad: async () => {
    const session = await loadSession();
    if (session.state === "ready" && session.actor.role === "patient") {
      throw redirect({ to: "/patient", search: { doctorId: "", slotId: "" } });
    }
  },
  component: SignIn,
});

const patientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/patient",
  validateSearch: (search: Record<string, unknown>) => ({
    doctorId: typeof search.doctorId === "string" ? search.doctorId : "",
    slotId: typeof search.slotId === "string" ? search.slotId : "",
  }),
  beforeLoad: async () => {
    const session = await loadSession();
    if (session.state !== "ready") throw redirect({ to: "/sign-in" });
    return { actor: session.actor };
  },
  component: function BookingScreen() {
    const { actor } = patientRoute.useRouteContext();
    const { doctorId, slotId } = patientRoute.useSearch();
    return <PatientDashboard actor={actor} doctorId={doctorId} slotId={slotId} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, patientRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
