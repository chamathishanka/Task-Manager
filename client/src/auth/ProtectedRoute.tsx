import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { FullScreenLoader } from "@/components/full-screen-loader";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Wait for the startup silent-refresh to settle before deciding.
  if (isLoading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
