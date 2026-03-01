import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-bold text-gray-100 mb-2">404</h1>
      <p className="text-lg text-gray-400 mb-8">Page not found</p>
      <Link
        to="/"
        className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-150"
      >
        &larr; Back to home
      </Link>
    </div>
  );
}
