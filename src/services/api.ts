import type { BlogPost, BlogPostMeta, PostStatus } from '../types/blog';
import { config } from '../config';

const API_BASE = config.github.apiBaseUrl;

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const message = (body as { error?: string }).error || `API error ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch metadata for all blog posts, sorted newest-first by date.
 */
export async function fetchAllPosts(): Promise<BlogPostMeta[]> {
  return apiFetch<BlogPostMeta[]>('/api/posts');
}

/**
 * Fetch a single blog post (including its markdown content) by slug.
 */
export async function fetchPostBySlug(slug: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/api/posts/${encodeURIComponent(slug)}`);
}

/**
 * Create a new blog post. Requires an authenticated admin token.
 */
export async function createPost(
  data: {
    title: string;
    excerpt: string;
    tags: string[];
    coverImage?: string;
    content: string;
    author: string;
    status: PostStatus;
  },
  token: string,
): Promise<void> {
  await apiFetch('/api/posts', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing blog post by slug. Requires an authenticated admin token.
 */
export async function updatePost(
  slug: string,
  data: {
    title: string;
    date: string;
    excerpt: string;
    tags: string[];
    coverImage?: string;
    content: string;
    author: string;
    status: PostStatus;
  },
  token: string,
): Promise<void> {
  await apiFetch(`/api/posts/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

/**
 * Delete a blog post by slug. Requires an authenticated admin token.
 */
export async function deletePost(
  slug: string,
  token: string,
): Promise<void> {
  await apiFetch(`/api/posts/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
}

/**
 * Upload an image. Requires an authenticated admin token.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(
  file: File,
  token: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  // Do NOT set Content-Type — the browser sets the multipart boundary automatically
  const res = await fetch(`${API_BASE}/api/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const message = (body as { error?: string }).error || 'Image upload failed';
    throw new Error(message);
  }

  const result = (await res.json()) as { url: string };
  return result.url;
}
