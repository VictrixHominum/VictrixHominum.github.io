import { useState, useEffect, useMemo } from 'react';
import type { BlogPostMeta, SortOption } from '@/types/blog';
import { fetchAllPosts } from '@/services/github';
import { Card, FilterBar, LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

function sortPosts(posts: BlogPostMeta[], sort: SortOption): BlogPostMeta[] {
  const sorted = [...posts];

  switch (sort) {
    case 'newest':
      return sorted.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    case 'a-z':
      return sorted.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    case 'z-a':
      return sorted.sort((a, b) =>
        b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }),
      );
    default:
      return sorted;
  }
}

function matchesSearch(post: BlogPostMeta, query: string): boolean {
  const q = query.toLowerCase();
  return (
    post.title.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q) ||
    post.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export default function BlogListPage() {
  const { user, role } = useAuth();
  const isAdmin = Boolean(user && role === 'admin');

  const [posts, setPosts] = useState<BlogPostMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState<SortOption>('newest');

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      try {
        const data = await fetchAllPosts();
        if (!cancelled) setPosts(data);
      } catch {
        // Fail silently; empty state will show
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    // Filter drafts for non-admin users
    const visible = isAdmin ? posts : posts.filter((p) => p.status !== 'draft');

    const searched = searchQuery
      ? visible.filter((post) => matchesSearch(post, searchQuery))
      : visible;

    return sortPosts(searched, currentSort);
  }, [posts, searchQuery, currentSort, isAdmin]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-100 mb-8">Blog</h1>

        <div className="mb-8">
          <FilterBar
            currentSort={currentSort}
            onSortChange={setCurrentSort}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Card
                key={post.slug}
                title={post.status === 'draft' ? `[DRAFT] ${post.title}` : post.title}
                slug={post.slug}
                date={post.date}
                excerpt={post.excerpt}
                tags={post.tags}
                coverImage={post.coverImage}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">
              {searchQuery
                ? `No posts matching "${searchQuery}"`
                : 'No posts yet. Check back soon!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
