/**
 * Tests for the GitHub service module.
 *
 * Since the service reads from `../config` at module scope (using
 * `import.meta.env` which is unavailable in Jest), we mock the config
 * module entirely before importing the service.
 */

jest.mock('@/config', () => ({
  config: {
    github: {
      owner: 'testowner',
      repo: 'testrepo',
    },
    blog: {
      postsDirectory: 'content/posts',
      imagesDirectory: 'public/images/blog',
    },
  },
}));

// Ensure `fetch` exists on global before the service module is imported.
// jsdom does not provide a native fetch implementation.
global.fetch = jest.fn() as jest.Mock;

import {
  fetchAllPosts,
  fetchPostBySlug,
  createPost,
  uploadImage,
} from '@/services/github';

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function okText(text: string): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(text),
  } as unknown as Response;
}

function notFound(): Response {
  return {
    ok: false,
    status: 404,
    text: () => Promise.resolve('Not Found'),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Raw markdown fixtures
// ---------------------------------------------------------------------------

const POST_A_RAW = `---
title: Post A
date: 2026-01-15
excerpt: Excerpt A
tags: [React, TypeScript]
author: AuthorA
---

Content of post A.`;

const POST_B_RAW = `---
title: Post B
date: 2026-02-20
excerpt: Excerpt B
tags: [Jest]
author: AuthorB
---

Content of post B.`;

const POST_DRAFT_RAW = `---
title: Draft Post
date: 2026-03-01
excerpt: A draft
tags: [WIP]
author: AuthorC
status: draft
---

This is a draft.`;

// ---------------------------------------------------------------------------
// fetchAllPosts
// ---------------------------------------------------------------------------

describe('fetchAllPosts', () => {
  it('returns sorted BlogPostMeta array', async () => {
    // First call: Git Trees API
    mockFetch.mockResolvedValueOnce(
      okJson({
        tree: [
          { path: 'content/posts/post-a.md', type: 'blob' },
          { path: 'content/posts/post-b.md', type: 'blob' },
          { path: 'README.md', type: 'blob' }, // should be ignored
        ],
      }),
    );

    // Subsequent calls: raw content for each .md file
    mockFetch.mockResolvedValueOnce(okText(POST_A_RAW));
    mockFetch.mockResolvedValueOnce(okText(POST_B_RAW));

    const posts = await fetchAllPosts();

    expect(posts).toHaveLength(2);
    // Sorted newest-first: Post B (Feb 2026) before Post A (Jan 2026)
    expect(posts[0].title).toBe('Post B');
    expect(posts[0].slug).toBe('post-b');
    expect(posts[0].date).toBe('2026-02-20');
    expect(posts[0].tags).toEqual(['Jest']);
    expect(posts[0].status).toBe('published'); // no status in frontmatter defaults to published

    expect(posts[1].title).toBe('Post A');
    expect(posts[1].slug).toBe('post-a');
    expect(posts[1].tags).toEqual(['React', 'TypeScript']);
    expect(posts[1].status).toBe('published');
  });

  it('skips files that fail to fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        tree: [
          { path: 'content/posts/good.md', type: 'blob' },
          { path: 'content/posts/bad.md', type: 'blob' },
        ],
      }),
    );

    mockFetch.mockResolvedValueOnce(okText(POST_A_RAW));
    mockFetch.mockResolvedValueOnce(notFound());

    const posts = await fetchAllPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('Post A');
  });
});

// ---------------------------------------------------------------------------
// fetchPostBySlug
// ---------------------------------------------------------------------------

describe('fetchPostBySlug', () => {
  it('returns a BlogPost with parsed frontmatter and content', async () => {
    mockFetch.mockResolvedValueOnce(okText(POST_A_RAW));

    const post = await fetchPostBySlug('post-a');

    expect(post.title).toBe('Post A');
    expect(post.slug).toBe('post-a');
    expect(post.date).toBe('2026-01-15');
    expect(post.excerpt).toBe('Excerpt A');
    expect(post.tags).toEqual(['React', 'TypeScript']);
    expect(post.author).toBe('AuthorA');
    expect(post.content).toBe('Content of post A.');
    expect(post.status).toBe('published'); // defaults to published when no status
  });

  it('parses draft status from frontmatter', async () => {
    mockFetch.mockResolvedValueOnce(okText(POST_DRAFT_RAW));

    const post = await fetchPostBySlug('draft-post');

    expect(post.title).toBe('Draft Post');
    expect(post.status).toBe('draft');
    expect(post.content).toBe('This is a draft.');
  });

  it('throws when the post is not found', async () => {
    mockFetch.mockResolvedValueOnce(notFound());

    await expect(fetchPostBySlug('nonexistent')).rejects.toThrow(
      'Post not found: nonexistent',
    );
  });
});

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

describe('createPost', () => {
  it('calls the GitHub API with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ content: { sha: 'abc123' } }));

    await createPost(
      {
        title: 'My New Post',
        excerpt: 'A great post',
        tags: ['React'],
        content: 'Hello world',
        author: 'TestAuthor',
        status: 'published',
      },
      'fake-token',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/repos/testowner/testrepo/contents/content/posts/my-new-post.md');
    expect(options!.method).toBe('PUT');

    const headers = options!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fake-token');

    const body = JSON.parse(options!.body as string);
    expect(body.message).toBe('Add blog post: My New Post');
    expect(typeof body.content).toBe('string'); // base64-encoded
  });
});

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------

describe('uploadImage', () => {
  it('calls the API and returns the correct URL', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ content: { sha: 'img123' } }));

    const bytes = Uint8Array.from([137, 80, 78, 71]); // fake PNG bytes
    const file = new File([bytes], 'photo.png', { type: 'image/png' });
    // jsdom's File does not implement arrayBuffer(), so we polyfill it.
    file.arrayBuffer = () => Promise.resolve(bytes.buffer as ArrayBuffer);

    // Mock Date.now to get a predictable filename
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const resultUrl = await uploadImage(file, 'fake-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/repos/testowner/testrepo/contents/public/images/blog/1700000000000-photo.png');
    expect(options!.method).toBe('PUT');

    const headers = options!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fake-token');

    expect(resultUrl).toBe('/images/blog/1700000000000-photo.png');

    dateSpy.mockRestore();
  });
});
