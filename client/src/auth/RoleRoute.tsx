import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { Role } from "@/types";

/** Gate a route to a specific role (e.g. admin-only pages in later phases). */
export function RoleRoute({ role }: { role: Role }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
