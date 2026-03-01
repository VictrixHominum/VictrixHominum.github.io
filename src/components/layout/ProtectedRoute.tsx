import { Navigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import type { Role } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ProtectedRouteProps {
  requiredRole: Role;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || role !== requiredRole) {
    return <Navigate to="/admin" replace state={{ message: 'You must be logged in as an admin to access this page.' }} />;
  }

  return <Outlet />;
}
