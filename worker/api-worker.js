/**
 * Cloudflare Worker — Blog API backed by R2 object storage.
 *
 * Endpoints:
 *   POST   /auth/token              OAuth token exchange (unchanged)
 *   GET    /api/posts               List all post metadata (public)
 *   GET    /api/posts/:slug         Get single post with content (public)
 *   POST   /api/posts               Create a new post (admin)
 *   PUT    /api/posts/:slug         Update an existing post (admin)
 *   DELETE /api/posts/:slug         Delete a post (admin)
 *   POST   /api/images              Upload an image (admin)
 *   GET    /api/images/:filename    Serve an image (public, cached)
 *
 * Environment bindings (wrangler.toml):
 *   - BLOG_BUCKET:      R2 bucket for posts and images
 *   - ALLOWED_ORIGINS:  Comma-separated allowed CORS origins
 *   - ALLOWED_USER:     GitHub username permitted to write
 *
 * Secrets (wrangler secret put ...):
 *   - GITHUB_CLIENT_SECRET
 *
 * R2 key layout:
 *   posts/{slug}.md          Full markdown with YAML frontmatter
 *   images/{timestamp}-{name} Uploaded images
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function buildCorsHeaders(request, env) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const origin = request.headers.get('Origin') || '';

  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ---------------------------------------------------------------------------
// Auth middleware — verifies GitHub token against ALLOWED_USER
// ---------------------------------------------------------------------------

async function verifyAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return { authorized: false, status: 401, error: 'Missing authorization token' };
  }

  const allowedUser = (env.ALLOWED_USER || '').toLowerCase();

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'victrixhominum-api-worker',
    },
  });

  if (!userResponse.ok) {
    return { authorized: false, status: 401, error: 'Invalid token' };
  }

  const userData = await userResponse.json();
  const authenticatedUser = (userData.login || '').toLowerCase();

  if (authenticatedUser !== allowedUser) {
    return { authorized: false, status: 403, error: 'Forbidden' };
  }

  return { authorized: true };
}

// ---------------------------------------------------------------------------
// Frontmatter parser (ported from src/services/github.ts)
// ---------------------------------------------------------------------------

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }

  const [, frontmatterBlock, content] = match;
  const data = {};
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

      if (value === '') {
        data[currentKey] = [];
        continue;
      }

      // Inline array: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        data[currentKey] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        continue;
      }

      // Strip surrounding quotes
      data[currentKey] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data, content: content.trim() };
}

function toMeta(data, slug) {
  return {
    title: data.title ?? '',
    slug,
    date: data.date ?? '',
    excerpt: data.excerpt ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    coverImage: data.coverImage || undefined,
    author: data.author ?? '',
    status: data.status === 'draft' ? 'draft' : 'published',
  };
}

function buildFrontmatter(meta) {
  const lines = ['---'];
  lines.push(`title: "${meta.title}"`);
  lines.push(`date: "${meta.date}"`);
  lines.push(`excerpt: "${meta.excerpt}"`);
  lines.push(`author: "${meta.author}"`);
  lines.push(`status: "${meta.status}"`);
  if (meta.coverImage) {
    lines.push(`coverImage: "${meta.coverImage}"`);
  }
  lines.push('tags:');
  for (const tag of meta.tags || []) {
    lines.push(`  - ${tag}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// OAuth token exchange (existing logic, unchanged)
// ---------------------------------------------------------------------------

async function handleOAuthToken(request, env, corsHeaders) {
  try {
    const { code, client_id } = await request.json();

    if (!code || !client_id) {
      return jsonResponse({ error: 'Missing code or client_id parameter' }, 400, corsHeaders);
    }

    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientSecret) {
      return jsonResponse({ error: 'Server misconfiguration: GITHUB_CLIENT_SECRET not set' }, 500, corsHeaders);
    }

    // Exchange the code for an access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ client_id, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return jsonResponse({
        error: tokenData.error_description || tokenData.error,
        detail: tokenData.error,
      }, 400, corsHeaders);
    }

    const accessToken = tokenData.access_token;

    // Server-side identity verification
    const allowedUser = (env.ALLOWED_USER || '').toLowerCase();

    if (allowedUser) {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'victrixhominum-api-worker',
        },
      });

      if (!userResponse.ok) {
        return jsonResponse({ error: 'Failed to verify user identity' }, 500, corsHeaders);
      }

      const userData = await userResponse.json();
      const authenticatedUser = (userData.login || '').toLowerCase();

      if (authenticatedUser !== allowedUser) {
        // Revoke the token so it can't be intercepted
        await fetch(`https://api.github.com/applications/${client_id}/token`, {
          method: 'DELETE',
          headers: {
            Authorization: 'Basic ' + btoa(client_id + ':' + clientSecret),
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'victrixhominum-api-worker',
          },
          body: JSON.stringify({ access_token: accessToken }),
        }).catch(() => { /* best-effort revocation */ });

        return jsonResponse({ error: 'Login is restricted to the site owner.' }, 403, corsHeaders);
      }
    }

    return jsonResponse({ access_token: accessToken }, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: 'Token exchange failed', detail: err.message }, 500, corsHeaders);
  }
}

// ---------------------------------------------------------------------------
// Blog post endpoints
// ---------------------------------------------------------------------------

async function handleListPosts(env, corsHeaders) {
  const listed = await env.BLOG_BUCKET.list({ prefix: 'posts/' });
  const posts = [];

  for (const object of listed.objects) {
    // Skip non-.md files or the prefix itself
    if (!object.key.endsWith('.md')) continue;

    const obj = await env.BLOG_BUCKET.get(object.key);
    if (!obj) continue;

    const raw = await obj.text();
    const { data } = parseFrontmatter(raw);
    const slug = object.key.replace('posts/', '').replace('.md', '');
    posts.push(toMeta(data, slug));
  }

  // Sort newest-first
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return jsonResponse(posts, 200, {
    ...corsHeaders,
    'Cache-Control': 'public, max-age=60, s-maxage=60',
  });
}

async function handleGetPost(slug, env, corsHeaders) {
  const obj = await env.BLOG_BUCKET.get(`posts/${slug}.md`);
  if (!obj) {
    return jsonResponse({ error: `Post not found: ${slug}` }, 404, corsHeaders);
  }

  const raw = await obj.text();
  const { data, content } = parseFrontmatter(raw);

  return jsonResponse(
    { ...toMeta(data, slug), content },
    200,
    { ...corsHeaders, 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  );
}

async function handleCreatePost(request, env, corsHeaders) {
  const auth = await verifyAdmin(request, env);
  if (!auth.authorized) {
    return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
  }

  const body = await request.json();
  const { title, excerpt, tags, coverImage, content, author, status } = body;

  if (!title || !content) {
    return jsonResponse({ error: 'Title and content are required' }, 400, corsHeaders);
  }

  const slug = generateSlug(title);
  const date = new Date().toISOString().split('T')[0];

  // Check for slug collision
  const existing = await env.BLOG_BUCKET.head(`posts/${slug}.md`);
  if (existing) {
    return jsonResponse({ error: 'A post with this slug already exists' }, 409, corsHeaders);
  }

  const frontmatter = buildFrontmatter({
    title,
    date,
    excerpt: excerpt || '',
    tags: tags || [],
    coverImage,
    author: author || '',
    status: status || 'published',
  });

  const fileContent = `${frontmatter}\n\n${content}\n`;
  await env.BLOG_BUCKET.put(`posts/${slug}.md`, fileContent, {
    httpMetadata: { contentType: 'text/markdown' },
  });

  return jsonResponse({ slug, date }, 201, corsHeaders);
}

async function handleUpdatePost(slug, request, env, corsHeaders) {
  const auth = await verifyAdmin(request, env);
  if (!auth.authorized) {
    return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
  }

  const existing = await env.BLOG_BUCKET.head(`posts/${slug}.md`);
  if (!existing) {
    return jsonResponse({ error: `Post not found: ${slug}` }, 404, corsHeaders);
  }

  const body = await request.json();
  const { title, date, excerpt, tags, coverImage, content, author, status } = body;

  if (!title || !content) {
    return jsonResponse({ error: 'Title and content are required' }, 400, corsHeaders);
  }

  const frontmatter = buildFrontmatter({
    title,
    date,
    excerpt: excerpt || '',
    tags: tags || [],
    coverImage,
    author: author || '',
    status: status || 'published',
  });

  const fileContent = `${frontmatter}\n\n${content}\n`;
  await env.BLOG_BUCKET.put(`posts/${slug}.md`, fileContent, {
    httpMetadata: { contentType: 'text/markdown' },
  });

  return jsonResponse({ slug }, 200, corsHeaders);
}

async function handleDeletePost(slug, request, env, corsHeaders) {
  const auth = await verifyAdmin(request, env);
  if (!auth.authorized) {
    return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
  }

  const existing = await env.BLOG_BUCKET.head(`posts/${slug}.md`);
  if (!existing) {
    return jsonResponse({ error: `Post not found: ${slug}` }, 404, corsHeaders);
  }

  await env.BLOG_BUCKET.delete(`posts/${slug}.md`);
  return jsonResponse({ deleted: true }, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// Image endpoints
// ---------------------------------------------------------------------------

async function handleUploadImage(request, env, corsHeaders) {
  const auth = await verifyAdmin(request, env);
  if (!auth.authorized) {
    return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'No file provided' }, 400, corsHeaders);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const filename = `${timestamp}-${safeName}`;

  await env.BLOG_BUCKET.put(`images/${filename}`, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  // Return the full public URL for the image
  const workerUrl = new URL(request.url);
  const imageUrl = `${workerUrl.origin}/api/images/${filename}`;

  return jsonResponse({ url: imageUrl }, 201, corsHeaders);
}

async function handleGetImage(filename, env, corsHeaders) {
  const obj = await env.BLOG_BUCKET.get(`images/${filename}`);
  if (!obj) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (obj.httpEtag) {
    headers.set('ETag', obj.httpEtag);
  }

  return new Response(obj.body, { headers });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = buildCorsHeaders(request, env);

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // --- Auth ---
      if (method === 'POST' && (path === '/auth/token' || path === '/')) {
        return handleOAuthToken(request, env, corsHeaders);
      }

      // --- Posts ---
      if (path === '/api/posts') {
        if (method === 'GET') return handleListPosts(env, corsHeaders);
        if (method === 'POST') return handleCreatePost(request, env, corsHeaders);
      }

      const postMatch = path.match(/^\/api\/posts\/([\w-]+)$/);
      if (postMatch) {
        const slug = postMatch[1];
        if (method === 'GET') return handleGetPost(slug, env, corsHeaders);
        if (method === 'PUT') return handleUpdatePost(slug, request, env, corsHeaders);
        if (method === 'DELETE') return handleDeletePost(slug, request, env, corsHeaders);
      }

      // --- Images ---
      if (method === 'POST' && path === '/api/images') {
        return handleUploadImage(request, env, corsHeaders);
      }

      const imageMatch = path.match(/^\/api\/images\/(.+)$/);
      if (imageMatch && method === 'GET') {
        const filename = decodeURIComponent(imageMatch[1]);
        return handleGetImage(filename, env, corsHeaders);
      }

      // --- 404 ---
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    } catch (err) {
      return jsonResponse(
        { error: 'Internal server error', detail: err.message },
        500,
        corsHeaders,
      );
    }
  },
};
