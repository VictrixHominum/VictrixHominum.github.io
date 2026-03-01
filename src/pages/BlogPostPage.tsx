import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { BlogPost } from '@/types/blog';
import { fetchPostBySlug, deletePost } from '@/services/github';
import { LoadingSpinner, Button, ConfirmModal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, role, token } = useAuth();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = Boolean(user && role === 'admin');

  const handleDelete = useCallback(async () => {
    if (!slug || !token) return;
    setIsDeleting(true);
    try {
      await deletePost(slug, token);
      navigate('/blog');
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setError('Failed to delete post. Please try again.');
    }
  }, [slug, token, navigate]);

  useEffect(() => {
    if (!slug) {
      setError('No post specified.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPost() {
      try {
        const data = await fetchPostBySlug(slug!);
        if (!cancelled) setPost(data);
      } catch {
        if (!cancelled) setError('Failed to load post. It may not exist.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPost();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-400 text-lg mb-6">
          {error ?? 'Post not found.'}
        </p>
        <Link
          to="/blog"
          className="text-primary-400 hover:text-primary-300 transition-colors duration-150"
        >
          &larr; Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* Back link */}
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-400 transition-colors duration-150 mb-10"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to blog
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 leading-tight">
              {post.title}
            </h1>

            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0 mt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/admin/edit/${slug}`)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                  Delete
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <time dateTime={post.date} className="font-mono">
              {post.date}
            </time>

            {post.author && (
              <>
                <span className="text-surface-300">/</span>
                <span>{post.author}</span>
              </>
            )}
          </div>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-surface-100 text-gray-300 border border-surface-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Cover image */}
        {post.coverImage && (
          <div className="rounded-xl overflow-hidden mb-10 border border-surface-200">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Markdown content */}
        <div className="prose-blog prose prose-invert prose-lg max-w-none text-gray-300">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={showDeleteModal}
        title="Delete post"
        message={`Are you sure you want to delete "${post.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
