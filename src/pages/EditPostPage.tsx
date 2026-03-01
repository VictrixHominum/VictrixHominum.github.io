import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { BlogFormData } from '@/types/blog';
import { useAuth } from '@/context/AuthContext';
import { fetchPostBySlug, updatePost, uploadImage } from '@/services/github';
import {
  Button,
  MarkdownEditor,
  LoadingSpinner,
  UnsavedChangesModal,
} from '@/components/ui';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export default function EditPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // ---- loading state ----
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- form state ----
  const [formData, setFormData] = useState<BlogFormData>({
    title: '',
    excerpt: '',
    tags: '',
    coverImage: '',
    content: '',
  });

  // Preserved fields (not editable)
  const [originalDate, setOriginalDate] = useState('');
  const [originalAuthor, setOriginalAuthor] = useState('');

  // Snapshot of form data when the post was loaded — used for dirty detection
  const [initialData, setInitialData] = useState<BlogFormData | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ---- dirty detection ----
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    return (
      formData.title !== initialData.title ||
      formData.excerpt !== initialData.excerpt ||
      formData.tags !== initialData.tags ||
      formData.coverImage !== initialData.coverImage ||
      formData.content !== initialData.content
    );
  }, [formData, initialData]);

  // ---- unsaved-changes guard ----
  const { blocker, proceed, reset } = useUnsavedChanges(isDirty);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);

  // ---- load existing post ----
  useEffect(() => {
    if (!slug) {
      setLoadError('No post specified.');
      setIsLoadingPost(false);
      return;
    }

    let cancelled = false;

    async function loadPost() {
      try {
        const post = await fetchPostBySlug(slug!);
        if (cancelled) return;

        const loaded: BlogFormData = {
          title: post.title,
          excerpt: post.excerpt,
          tags: post.tags.join(', '),
          coverImage: post.coverImage ?? '',
          content: post.content,
        };

        setFormData(loaded);
        setInitialData(loaded);
        setOriginalDate(post.date);
        setOriginalAuthor(post.author);
      } catch {
        if (!cancelled) setLoadError('Failed to load post. It may not exist.');
      } finally {
        if (!cancelled) setIsLoadingPost(false);
      }
    }

    loadPost();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ---- field helpers ----
  function updateField<K extends keyof BlogFormData>(
    field: K,
    value: BlogFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  }

  // ---- image upload ----
  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      if (!token) throw new Error('Not authenticated');
      return uploadImage(file, token);
    },
    [token],
  );

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
        setFeedback({
          type: 'error',
          message: 'Failed to upload cover image.',
        });
      } finally {
        setIsUploadingCover(false);
        e.target.value = '';
      }
    },
    [token],
  );

  // ---- save helper (reused by submit + modal Save & Exit) ----
  const savePost = useCallback(async (): Promise<boolean> => {
    if (!slug || !token || !user) return false;

    if (!formData.title.trim() || !formData.content.trim()) {
      setFeedback({
        type: 'error',
        message: 'Title and content are required.',
      });
      return false;
    }

    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await updatePost(
        slug,
        {
          title: formData.title.trim(),
          date: originalDate,
          excerpt: formData.excerpt.trim(),
          tags,
          coverImage: formData.coverImage.trim() || undefined,
          content: formData.content,
          author: originalAuthor,
        },
        token,
      );

      // Update the snapshot so the form is no longer dirty
      setInitialData({ ...formData });
      return true;
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to save post. Please try again.',
      });
      return false;
    }
  }, [slug, token, user, formData, originalDate, originalAuthor]);

  // ---- form submit ----
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!token || !user) {
      setFeedback({ type: 'error', message: 'You must be signed in.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const success = await savePost();

    if (success) {
      setFeedback({
        type: 'success',
        message: 'Post updated successfully! Redirecting...',
      });
      setTimeout(() => navigate(`/blog/${slug}`), 1500);
    }

    setIsSubmitting(false);
  }

  // ---- unsaved-changes modal handlers ----
  const handleModalSave = useCallback(async () => {
    setIsSavingBeforeLeave(true);
    const success = await savePost();
    setIsSavingBeforeLeave(false);

    if (success) proceed();
  }, [savePost, proceed]);

  const handleModalDiscard = useCallback(() => {
    proceed();
  }, [proceed]);

  const handleModalCancel = useCallback(() => {
    reset();
  }, [reset]);

  // ---- loading / error states ----
  if (isLoadingPost) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-400 text-lg mb-6">{loadError}</p>
        <button
          onClick={() => navigate('/blog')}
          className="text-primary-400 hover:text-primary-300 transition-colors duration-150"
        >
          &larr; Back to blog
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Edit Post</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/blog/${slug}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>

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
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => navigate(`/blog/${slug}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={blocker.state === 'blocked'}
        saving={isSavingBeforeLeave}
        onSave={handleModalSave}
        onDiscard={handleModalDiscard}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
