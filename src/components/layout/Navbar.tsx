import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/blog', label: 'Blog' },
] as const;

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-lg border-b border-surface-300">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="text-lg font-bold tracking-tight text-gray-100 hover:text-primary-400 transition-colors">
            VictrixHominum
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-surface-100 hover:text-gray-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {user && (
              <div className="ml-4 flex items-center gap-3 border-l border-surface-300 pl-4">
                <img
                  src={user.avatar_url}
                  alt={user.name ?? user.login}
                  className="h-7 w-7 rounded-full ring-1 ring-surface-300"
                />
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-surface-100 hover:text-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-surface-100 hover:text-gray-100 transition-colors md:hidden"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-surface-300 bg-surface/95 backdrop-blur-lg md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-surface-100 hover:text-gray-100 transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {user && (
              <div className="mt-2 flex items-center gap-3 border-t border-surface-300 pt-3">
                <img
                  src={user.avatar_url}
                  alt={user.name ?? user.login}
                  className="h-7 w-7 rounded-full ring-1 ring-surface-300"
                />
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-surface-100 hover:text-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
