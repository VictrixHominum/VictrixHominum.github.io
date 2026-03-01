import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import BlogListPage from '@/pages/BlogListPage';
import BlogPostPage from '@/pages/BlogPostPage';
import AdminPage from '@/pages/AdminPage';
import CreatePostPage from '@/pages/CreatePostPage';
import OAuthCallbackPage from '@/pages/OAuthCallbackPage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />

            {/* Admin routes (hidden but accessible) */}
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/callback" element={<OAuthCallbackPage />} />

            {/* Protected admin routes */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/admin/create" element={<CreatePostPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
