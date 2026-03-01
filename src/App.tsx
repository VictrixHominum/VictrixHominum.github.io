import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import BlogListPage from '@/pages/BlogListPage';
import BlogPostPage from '@/pages/BlogPostPage';
import AdminPage from '@/pages/AdminPage';
import CreatePostPage from '@/pages/CreatePostPage';
import EditPostPage from '@/pages/EditPostPage';
import OAuthCallbackPage from '@/pages/OAuthCallbackPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Wraps the top-level Layout with the AuthProvider so every route
 * has access to authentication context.
 */
function AuthLayout() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      // Public routes
      { path: '/', element: <HomePage /> },
      { path: '/blog', element: <BlogListPage /> },
      { path: '/blog/:slug', element: <BlogPostPage /> },

      // Admin routes (hidden but accessible)
      { path: '/admin', element: <AdminPage /> },
      { path: '/admin/callback', element: <OAuthCallbackPage /> },

      // Protected admin routes
      {
        element: <ProtectedRoute requiredRole="admin" />,
        children: [
          { path: '/admin/create', element: <CreatePostPage /> },
          { path: '/admin/edit/:slug', element: <EditPostPage /> },
        ],
      },

      // 404
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
