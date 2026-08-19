import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';

// Route guard, wired into app/router.tsx around every protected route.
// Unauthenticated visitors are bounced to /login and remember where they
// were trying to go, so LoginPage can send them back after a successful
// login.
export function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
