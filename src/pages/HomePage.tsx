import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { BlogPostMeta } from '@/types/blog';
import { fetchAllPosts } from '@/services/github';
import { Carousel, LoadingSpinner } from '@/components/ui';

const RECENT_DAYS = 30;

const techStack = [
  'TypeScript',
  'Node.js',
  'Python',
  'PostgreSQL',
  'AWS',
  'GraphQL',
  'MySql'
];

export default function HomePage() {
  const [recentPosts, setRecentPosts] = useState<BlogPostMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      try {
        const posts = await fetchAllPosts();
        if (cancelled) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RECENT_DAYS);

        const recent = posts.filter(
          (post) => new Date(post.date) >= cutoff,
        );

        setRecentPosts(recent);
      } catch {
        // Fail silently; carousel simply won't render
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="relative inline-block">
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gray-100">
              VictrixHominum
            </h1>
            <div className="absolute -inset-x-4 -inset-y-2 rounded-2xl bg-gradient-to-r from-primary-500/20 via-transparent to-primary-400/20 blur-xl -z-10" />
          </div>

          <p className="mt-4 text-lg sm:text-xl text-primary-400 font-medium">
            Developer &amp; Writer
          </p>

          <p className="mt-6 max-w-2xl mx-auto text-gray-400 leading-relaxed">
            I am an engineering leader with a focus on delivery and building a strong engineering culture.
            This site was mostly to test out AI tools but also as I wanted a place to write my anti-'analyslop'
            and technical ramblings.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <a
              href="https://github.com/VictrixHominum"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-100 border border-surface-300 text-gray-200 text-sm font-medium transition-colors duration-150 hover:bg-surface-200 hover:text-gray-100"
            >
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
              GitHub
            </a>

            <Link
              to="/blog"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium transition-colors duration-150 hover:bg-primary-400"
            >
              Read the Blog
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
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-16 border-t border-surface-200">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-gray-100 mb-8 text-center">
            Tech Stack
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 rounded-full text-sm font-medium bg-surface-50 border border-surface-300 text-gray-300 transition-colors duration-150 hover:border-primary-500/50 hover:text-primary-400"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Posts Section */}
      <section className="py-16 border-t border-surface-200">
        <div className="mx-auto max-w-6xl px-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : recentPosts.length > 0 ? (
            <>
              <Carousel items={recentPosts} title="Recent Posts" />
              <div className="mt-8 text-center">
                <Link
                  to="/blog"
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-150"
                >
                  View all posts &rarr;
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-100 mb-4">
                Recent Posts
              </h2>
              <p className="text-gray-500">
                No posts from the last 30 days. Check out the{' '}
                <Link
                  to="/blog"
                  className="text-primary-400 hover:text-primary-300 transition-colors duration-150"
                >
                  full blog
                </Link>{' '}
                for older articles.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
