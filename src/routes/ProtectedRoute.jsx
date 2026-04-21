// src/routes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/authContext/AuthContext";

export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <Outlet />;
}
