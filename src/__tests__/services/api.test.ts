/**
 * Tests for the API service module.
 *
 * The service reads from `../config` at module scope (using
 * `import.meta.env` which is unavailable in Jest), so we mock the
 * config module entirely before importing the service.
 */

jest.mock('@/config', () => ({
  config: {
    github: {
      apiBaseUrl: 'https://test-api.workers.dev',
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
} from '@/services/api';

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

function createdJson(data: unknown): Response {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function notFoundJson(): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Post not found: nonexistent' }),
    text: () => Promise.resolve('Not Found'),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// fetchAllPosts
// ---------------------------------------------------------------------------

describe('fetchAllPosts', () => {
  it('returns sorted BlogPostMeta array from the API', async () => {
    const apiResponse = [
      {
        title: 'Post B',
        slug: 'post-b',
        date: '2026-02-20',
        excerpt: 'Excerpt B',
        tags: ['Jest'],
        author: 'AuthorB',
        status: 'published',
      },
      {
        title: 'Post A',
        slug: 'post-a',
        date: '2026-01-15',
        excerpt: 'Excerpt A',
        tags: ['React', 'TypeScript'],
        author: 'AuthorA',
        status: 'published',
      },
    ];

    mockFetch.mockResolvedValueOnce(okJson(apiResponse));

    const posts = await fetchAllPosts();

    expect(posts).toHaveLength(2);
    expect(posts[0].title).toBe('Post B');
    expect(posts[0].slug).toBe('post-b');
    expect(posts[0].date).toBe('2026-02-20');
    expect(posts[0].tags).toEqual(['Jest']);
    expect(posts[0].status).toBe('published');

    expect(posts[1].title).toBe('Post A');
    expect(posts[1].slug).toBe('post-a');
    expect(posts[1].tags).toEqual(['React', 'TypeScript']);

    // Verify the correct URL was called
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test-api.workers.dev/api/posts');
  });
});

// ---------------------------------------------------------------------------
// fetchPostBySlug
// ---------------------------------------------------------------------------

describe('fetchPostBySlug', () => {
  it('returns a BlogPost with parsed data', async () => {
    const apiResponse = {
      title: 'Post A',
      slug: 'post-a',
      date: '2026-01-15',
      excerpt: 'Excerpt A',
      tags: ['React', 'TypeScript'],
      author: 'AuthorA',
      status: 'published',
      content: 'Content of post A.',
    };

    mockFetch.mockResolvedValueOnce(okJson(apiResponse));

    const post = await fetchPostBySlug('post-a');

    expect(post.title).toBe('Post A');
    expect(post.slug).toBe('post-a');
    expect(post.date).toBe('2026-01-15');
    expect(post.excerpt).toBe('Excerpt A');
    expect(post.tags).toEqual(['React', 'TypeScript']);
    expect(post.author).toBe('AuthorA');
    expect(post.content).toBe('Content of post A.');
    expect(post.status).toBe('published');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test-api.workers.dev/api/posts/post-a');
  });

  it('parses draft status from the API', async () => {
    const apiResponse = {
      title: 'Draft Post',
      slug: 'draft-post',
      date: '2026-03-01',
      excerpt: 'A draft',
      tags: ['WIP'],
      author: 'AuthorC',
      status: 'draft',
      content: 'This is a draft.',
    };

    mockFetch.mockResolvedValueOnce(okJson(apiResponse));

    const post = await fetchPostBySlug('draft-post');

    expect(post.title).toBe('Draft Post');
    expect(post.status).toBe('draft');
    expect(post.content).toBe('This is a draft.');
  });

  it('throws when the post is not found', async () => {
    mockFetch.mockResolvedValueOnce(notFoundJson());

    await expect(fetchPostBySlug('nonexistent')).rejects.toThrow(
      'Post not found: nonexistent',
    );
  });
});

// ---------------------------------------------------------------------------
// createPost
// ---------------------------------------------------------------------------

describe('createPost', () => {
  it('calls the API with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce(createdJson({ slug: 'my-new-post', date: '2026-03-01' }));

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
    expect(url).toBe('https://test-api.workers.dev/api/posts');
    expect(options!.method).toBe('POST');

    const headers = options!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fake-token');

    const body = JSON.parse(options!.body as string);
    expect(body.title).toBe('My New Post');
    expect(body.excerpt).toBe('A great post');
    expect(body.tags).toEqual(['React']);
    expect(body.content).toBe('Hello world');
    expect(body.author).toBe('TestAuthor');
    expect(body.status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------

describe('uploadImage', () => {
  it('calls the API and returns the image URL', async () => {
    mockFetch.mockResolvedValueOnce(
      createdJson({ url: 'https://test-api.workers.dev/api/images/1700000000000-photo.png' }),
    );

    const bytes = Uint8Array.from([137, 80, 78, 71]); // fake PNG bytes
    const file = new File([bytes], 'photo.png', { type: 'image/png' });

    const resultUrl = await uploadImage(file, 'fake-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test-api.workers.dev/api/images');
    expect(options!.method).toBe('POST');

    const headers = options!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fake-token');

    // Body should be FormData
    expect(options!.body).toBeInstanceOf(FormData);

    expect(resultUrl).toBe('https://test-api.workers.dev/api/images/1700000000000-photo.png');
  });
});
