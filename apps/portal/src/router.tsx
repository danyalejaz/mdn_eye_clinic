import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DoctorDashboard } from "./pages/DoctorDashboard";
import { PatientDashboard } from "./pages/PatientDashboard";
import { PortalHome } from "./pages/PortalHome";
import { ReceptionDashboard } from "./pages/ReceptionDashboard";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: PortalHome,
});

const patientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/patient",
  component: PatientDashboard,
});

const receptionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reception",
  component: ReceptionDashboard,
});

const doctorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/doctor",
  component: DoctorDashboard,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminDashboard,
});

const routeTree = rootRoute.addChildren([indexRoute, patientRoute, receptionRoute, doctorRoute, adminRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
