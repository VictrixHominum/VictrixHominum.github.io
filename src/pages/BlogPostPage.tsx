import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { BlogPost } from '@/types/blog';
import { fetchPostBySlug } from '@/services/github';
import { LoadingSpinner } from '@/components/ui';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 leading-tight mb-4">
            {post.title}
          </h1>

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
    </div>
  );
}
