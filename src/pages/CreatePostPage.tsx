import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { BlogFormData } from '@/types/blog';
import { useAuth } from '@/context/AuthContext';
import { createPost, uploadImage } from '@/services/github';
import { Button, MarkdownEditor } from '@/components/ui';

export default function CreatePostPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<BlogFormData>({
    title: '',
    excerpt: '',
    tags: '',
    coverImage: '',
    content: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function updateField<K extends keyof BlogFormData>(
    field: K,
    value: BlogFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  }

  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      if (!token) throw new Error('Not authenticated');
      return uploadImage(file, token);
    },
    [token],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!token || !user) {
      setFeedback({ type: 'error', message: 'You must be signed in.' });
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      setFeedback({
        type: 'error',
        message: 'Title and content are required.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await createPost(
        {
          title: formData.title.trim(),
          excerpt: formData.excerpt.trim(),
          tags,
          coverImage: formData.coverImage.trim() || undefined,
          content: formData.content,
          author: user.name ?? user.login,
        },
        token,
      );

      setFeedback({
        type: 'success',
        message: 'Post created successfully! Redirecting...',
      });

      setTimeout(() => navigate('/blog'), 1500);
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to create post. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-100 mb-8">
          Create New Post
        </h1>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-sm ${
              feedback.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Post title"
              className="w-full px-4 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 placeholder-gray-600 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label
              htmlFor="excerpt"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Excerpt
            </label>
            <textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => updateField('excerpt', e.target.value)}
              placeholder="A brief summary of the post"
              rows={3}
              className="w-full px-4 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 placeholder-gray-600 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="tags"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              placeholder="react, typescript, webdev (comma-separated)"
              className="w-full px-4 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 placeholder-gray-600 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Cover Image URL */}
          <div>
            <label
              htmlFor="coverImage"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Cover Image URL{' '}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              id="coverImage"
              type="text"
              value={formData.coverImage}
              onChange={(e) => updateField('coverImage', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2.5 text-sm bg-surface-50 border border-surface-300 rounded-lg text-gray-200 placeholder-gray-600 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Markdown Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Content
            </label>
            <MarkdownEditor
              value={formData.content}
              onChange={(value) => updateField('content', value)}
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* Preview */}
          {formData.title.trim() && (
            <div className="rounded-xl border border-surface-300 overflow-hidden">
              <div className="px-4 py-2 text-xs text-gray-500 font-mono bg-surface-100 border-b border-surface-300">
                Post Preview
              </div>
              <div className="p-6 bg-surface-50">
                <h2 className="text-2xl font-bold text-gray-100 mb-2">
                  {formData.title}
                </h2>

                {formData.excerpt && (
                  <p className="text-sm text-gray-400 mb-4">
                    {formData.excerpt}
                  </p>
                )}

                {formData.tags && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {formData.tags
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-surface-200 text-gray-300 border border-surface-300"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}

                {formData.content.trim() && (
                  <div className="prose-blog prose prose-invert prose-sm max-w-none text-gray-300 border-t border-surface-300 pt-6">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {formData.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Publishing...' : 'Publish Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
