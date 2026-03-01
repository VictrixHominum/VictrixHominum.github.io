import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, LoadingSpinner } from '@/components/ui';

export default function AdminPage() {
  const { user, role, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Logged in as admin
  if (user && role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-8">
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-surface-300"
            />

            <h1 className="text-2xl font-bold text-gray-100 mb-1">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Signed in as{' '}
              <span className="text-gray-300">{user.name ?? user.login}</span>
            </p>

            <div className="space-y-3">
              <Link
                to="/admin/create"
                className="block w-full px-4 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium transition-colors duration-150 hover:bg-primary-400 text-center"
              >
                Create Post
              </Link>

              <Button
                variant="ghost"
                size="md"
                onClick={logout}
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in but not admin
  if (user && role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl bg-surface-50 border border-surface-200 p-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              Your account does not have admin privileges for this site.
            </p>

            <Button
              variant="secondary"
              size="md"
              onClick={logout}
              className="w-full"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl bg-surface-50 border border-surface-200 p-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            Admin Portal
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            Sign in with GitHub to manage blog posts.
          </p>

          <Button variant="primary" size="lg" onClick={login} className="w-full">
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Sign in with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
