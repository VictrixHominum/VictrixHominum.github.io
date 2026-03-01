import { useState, useCallback, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { BlogFormData, PostStatus } from '@/types/blog';
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

  const submitStatusRef = useRef<PostStatus>('published');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const handleCoverUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !token) return;

      setIsUploadingCover(true);
      try {
        const url = await uploadImage(file, token);
        updateField('coverImage', url);
      } catch {
        setFeedback({ type: 'error', message: 'Failed to upload cover image.' });
      } finally {
        setIsUploadingCover(false);
        e.target.value = '';
      }
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
          status: submitStatusRef.current,
        },
        token,
      );

      setFeedback({
        type: 'success',
        message:
          submitStatusRef.current === 'draft'
            ? 'Draft saved successfully! Redirecting...'
            : 'Post published successfully! Redirecting...',
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

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Cover Image{' '}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>

            {formData.coverImage ? (
              <div className="relative rounded-lg border border-surface-300 overflow-hidden bg-surface-50">
                <img
                  src={formData.coverImage}
                  alt="Cover preview"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-gray-300 font-mono truncate max-w-[60%]">
                    {formData.coverImage}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateField('coverImage', '')}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-300 bg-surface-200/80 hover:bg-surface-300 backdrop-blur-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => coverInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 w-full h-36 rounded-lg border-2 border-dashed transition-colors duration-150 cursor-pointer ${
                  isUploadingCover
                    ? 'border-primary-500/50 bg-primary-500/5'
                    : 'border-surface-300 hover:border-primary-500/40 hover:bg-surface-100/50'
                }`}
              >
                {isUploadingCover ? (
                  <>
                    <svg
                      className="animate-spin h-6 w-6 text-primary-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm text-gray-400">Uploading…</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-8 w-8 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      />
                    </svg>
                    <span className="text-sm text-gray-500">
                      Click to upload a cover image
                    </span>
                  </>
                )}
              </div>
            )}

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
              aria-hidden="true"
            />

            {/* Fallback: paste a URL instead */}
            {!formData.coverImage && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-600">or paste a URL:</span>
                <input
                  id="coverImage"
                  type="text"
                  value={formData.coverImage}
                  onChange={(e) => updateField('coverImage', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-1.5 text-xs bg-surface-50 border border-surface-300 rounded-md text-gray-200 placeholder-gray-600 transition-colors duration-150 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )}
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

                {formData.coverImage && (
                  <div className="rounded-lg overflow-hidden mb-6 border border-surface-200">
                    <img
                      src={formData.coverImage}
                      alt="Cover"
                      className="w-full h-auto object-cover"
                    />
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
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={() => { submitStatusRef.current = 'draft'; }}
            >
              {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={() => { submitStatusRef.current = 'published'; }}
            >
              {isSubmitting ? 'Publishing...' : 'Publish Post'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
