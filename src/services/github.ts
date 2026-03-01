import type { BlogPost, BlogPostMeta, PostStatus } from '../types/blog';
import { config } from '../config';

const { owner, repo } = config.github;
const { postsDirectory, imagesDirectory } = config.blog;

const GITHUB_API = 'https://api.github.com';
const RAW_CONTENT_URL = `https://raw.githubusercontent.com/${owner}/${repo}/main`;

// ---------------------------------------------------------------------------
// Frontmatter parser (avoids gray-matter import issues with verbatimModuleSyntax)
// ---------------------------------------------------------------------------

interface FrontmatterResult {
  data: Record<string, string | string[]>;
  content: string;
}

function parseFrontmatter(raw: string): FrontmatterResult {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }

  const [, frontmatterBlock, content] = match;
  const data: Record<string, string | string[]> = {};

  let currentKey = '';

  for (const line of frontmatterBlock.split('\n')) {
    const trimmed = line.trimEnd();

    // Continuation of a YAML array value (lines starting with "  - ")
    if (/^\s+-\s+/.test(trimmed) && currentKey) {
      const value = trimmed.replace(/^\s+-\s+/, '').trim();
      const existing = data[currentKey];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        data[currentKey] = [value];
      }
      continue;
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const [, key, rawValue] = kvMatch;
      currentKey = key;

      const value = rawValue.trim();

      // Empty value (array or multi-line will follow)
      if (value === '') {
        data[currentKey] = [];
        continue;
      }

      // Inline array: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        data[currentKey] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        continue;
      }

      // Strip surrounding quotes
      data[currentKey] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data, content: content.trim() };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function filenameFromSlug(slug: string): string {
  return `${slug}.md`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toMeta(
  data: Record<string, string | string[]>,
  slug: string,
): BlogPostMeta {
  return {
    title: (data.title as string) ?? '',
    slug,
    date: (data.date as string) ?? '',
    excerpt: (data.excerpt as string) ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    coverImage: (data.coverImage as string) || undefined,
    author: (data.author as string) ?? '',
    status: ((data.status as string) === 'draft' ? 'draft' : 'published') as PostStatus,
  };
}

function buildFrontmatter(meta: {
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  coverImage?: string;
  author: string;
  status: PostStatus;
}): string {
  const lines: string[] = ['---'];
  lines.push(`title: "${meta.title}"`);
  lines.push(`date: "${meta.date}"`);
  lines.push(`excerpt: "${meta.excerpt}"`);
  lines.push(`author: "${meta.author}"`);
  lines.push(`status: "${meta.status}"`);
  if (meta.coverImage) {
    lines.push(`coverImage: "${meta.coverImage}"`);
  }
  lines.push('tags:');
  for (const tag of meta.tags) {
    lines.push(`  - ${tag}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

interface GitHubTreeItem {
  path: string;
  type: string;
}

async function fetchGitHubApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub API error ${res.status} for ${path}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

async function fetchGitHubApiAuth<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  return fetchGitHubApi<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch metadata for all blog posts, sorted newest-first by date.
 * Uses the GitHub Contents API (no auth required for public repos).
 */
export async function fetchAllPosts(): Promise<BlogPostMeta[]> {
  // Use the Git Trees API to list files in the posts directory.
  // This avoids rate-limit pressure from fetching each file individually.
  const tree = await fetchGitHubApi<{ tree: GitHubTreeItem[] }>(
    `/repos/${owner}/${repo}/git/trees/main?recursive=1`,
  );

  const mdFiles = tree.tree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path.startsWith(`${postsDirectory}/`) &&
      item.path.endsWith('.md'),
  );

  // Fetch raw content for each markdown file in parallel
  const posts = await Promise.all(
    mdFiles.map(async (item) => {
      const filename = item.path.split('/').pop()!;
      const slug = slugFromFilename(filename);

      const res = await fetch(`${RAW_CONTENT_URL}/${item.path}`);
      if (!res.ok) return null;

      const raw = await res.text();
      const { data } = parseFrontmatter(raw);
      return toMeta(data, slug);
    }),
  );

  return posts
    .filter((p): p is BlogPostMeta => p !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Fetch a single blog post (including its markdown content) by slug.
 */
export async function fetchPostBySlug(slug: string): Promise<BlogPost> {
  const filename = filenameFromSlug(slug);
  const url = `${RAW_CONTENT_URL}/${postsDirectory}/${filename}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Post not found: ${slug}`);
  }

  const raw = await res.text();
  const { data, content } = parseFrontmatter(raw);

  return {
    ...toMeta(data, slug),
    content,
  };
}

/**
 * Create a new blog post by committing a markdown file via the GitHub
 * Contents API. Requires an authenticated token with repo write access.
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
  const slug = generateSlug(data.title);
  const date = new Date().toISOString().split('T')[0];

  const frontmatter = buildFrontmatter({
    title: data.title,
    date,
    excerpt: data.excerpt,
    tags: data.tags,
    coverImage: data.coverImage,
    author: data.author,
    status: data.status,
  });

  const fileContent = `${frontmatter}\n\n${data.content}\n`;
  const path = `${postsDirectory}/${filenameFromSlug(slug)}`;

  await fetchGitHubApiAuth(
    `/repos/${owner}/${repo}/contents/${path}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add blog post: ${data.title}`,
        content: btoa(unescape(encodeURIComponent(fileContent))),
      }),
    },
  );
}

/**
 * Delete a blog post by slug via the GitHub Contents API.
 * Requires an authenticated token with repo write access.
 * First fetches the file to obtain its SHA, then sends a DELETE request.
 */
export async function deletePost(
  slug: string,
  token: string,
): Promise<void> {
  const filename = filenameFromSlug(slug);
  const path = `${postsDirectory}/${filename}`;
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;

  // Fetch the file metadata to get the current SHA (required by the API)
  const file = await fetchGitHubApiAuth<{ sha: string }>(apiPath, token);

  await fetchGitHubApiAuth(apiPath, token, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Delete blog post: ${slug}`,
      sha: file.sha,
    }),
  });
}

/**
 * Update an existing blog post by slug via the GitHub Contents API.
 * Requires an authenticated token with repo write access.
 * Fetches the current SHA first, then PUTs the updated content.
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
  const filename = filenameFromSlug(slug);
  const path = `${postsDirectory}/${filename}`;
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;

  // Fetch the file metadata to get the current SHA (required by the API)
  const file = await fetchGitHubApiAuth<{ sha: string }>(apiPath, token);

  const frontmatter = buildFrontmatter({
    title: data.title,
    date: data.date,
    excerpt: data.excerpt,
    tags: data.tags,
    coverImage: data.coverImage,
    author: data.author,
    status: data.status,
  });

  const fileContent = `${frontmatter}\n\n${data.content}\n`;

  await fetchGitHubApiAuth(apiPath, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Update blog post: ${data.title}`,
      content: btoa(unescape(encodeURIComponent(fileContent))),
      sha: file.sha,
    }),
  });
}

/**
 * Upload an image to the blog images directory via the GitHub Contents API.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(
  file: File,
  token: string,
): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const filename = `${timestamp}-${safeName}`;
  const path = `${imagesDirectory}/${filename}`;

  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce(
      (acc, byte) => acc + String.fromCharCode(byte),
      '',
    ),
  );

  await fetchGitHubApiAuth(
    `/repos/${owner}/${repo}/contents/${path}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Upload blog image: ${filename}`,
        content: base64,
      }),
    },
  );

  // The image lives under public/ which is served at the site root
  return `/images/blog/${filename}`;
}
