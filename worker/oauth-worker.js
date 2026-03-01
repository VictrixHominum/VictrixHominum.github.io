/**
 * Cloudflare Worker for GitHub OAuth token exchange.
 *
 * Deploy this as a Cloudflare Worker and set one secret:
 *   wrangler secret put GITHUB_CLIENT_SECRET
 *
 * Environment variables (set in wrangler.toml [vars]):
 *   - ALLOWED_ORIGINS: Comma-separated allowed origins
 *   - ALLOWED_USER:    GitHub username that is permitted to log in
 *
 * Security: after exchanging the OAuth code for a token, the worker
 * calls the GitHub /user API to verify the *actual* authenticated
 * identity. The token is only returned if the verified username
 * matches ALLOWED_USER. A spoofed username in the request body is
 * ignored — identity is always checked server-side against GitHub.
 */

export default {
  async fetch(request, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { code, client_id } = await request.json();

      if (!code || !client_id) {
        return new Response(JSON.stringify({ error: 'Missing code or client_id parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientSecret = env.GITHUB_CLIENT_SECRET;

      if (!clientSecret) {
        return new Response(JSON.stringify({ error: 'Server misconfiguration: GITHUB_CLIENT_SECRET not set' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Exchange the code for an access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(JSON.stringify({
          error: tokenData.error_description || tokenData.error,
          detail: tokenData.error,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = tokenData.access_token;

      // ── Server-side identity verification ──────────────────────────
      // Call GitHub's /user endpoint with the newly obtained token to
      // confirm who actually authenticated. This cannot be spoofed.
      const allowedUser = (env.ALLOWED_USER || '').toLowerCase();

      if (allowedUser) {
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'victrixhominum-oauth-worker',
          },
        });

        if (!userResponse.ok) {
          return new Response(JSON.stringify({ error: 'Failed to verify user identity' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userData = await userResponse.json();
        const authenticatedUser = (userData.login || '').toLowerCase();

        if (authenticatedUser !== allowedUser) {
          // Revoke the token so it can't be intercepted and used
          await fetch(`https://api.github.com/applications/${client_id}/token`, {
            method: 'DELETE',
            headers: {
              Authorization: 'Basic ' + btoa(client_id + ':' + clientSecret),
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'victrixhominum-oauth-worker',
            },
            body: JSON.stringify({ access_token: accessToken }),
          }).catch(() => { /* best-effort revocation */ });

          return new Response(JSON.stringify({
            error: 'Login is restricted to the site owner.',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ access_token: accessToken }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal server error', detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
