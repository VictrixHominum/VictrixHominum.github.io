/**
 * Cloudflare Worker for GitHub OAuth token exchange.
 *
 * Deploy this as a Cloudflare Worker and set these environment variables:
 *   - GITHUB_CLIENT_ID_PROD: Production OAuth App client ID
 *   - GITHUB_CLIENT_SECRET_PROD: Production OAuth App client secret
 *   - GITHUB_CLIENT_ID_DEV: Dev OAuth App client ID (optional)
 *   - GITHUB_CLIENT_SECRET_DEV: Dev OAuth App client secret (optional)
 *   - ALLOWED_ORIGINS: Comma-separated allowed origins
 *
 * The client sends its client_id with the code so the worker can
 * match it to the correct secret (dev vs prod).
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

      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Match client_id to the correct secret
      let resolvedClientId = client_id;
      let resolvedClientSecret;

      if (client_id === env.GITHUB_CLIENT_ID_DEV) {
        resolvedClientSecret = env.GITHUB_CLIENT_SECRET_DEV;
      } else if (client_id === env.GITHUB_CLIENT_ID_PROD) {
        resolvedClientSecret = env.GITHUB_CLIENT_SECRET_PROD;
      } else {
        // Fallback: single-app setup (backwards compatible)
        resolvedClientId = client_id || env.GITHUB_CLIENT_ID_PROD || env.GITHUB_CLIENT_ID;
        resolvedClientSecret = env.GITHUB_CLIENT_SECRET_PROD || env.GITHUB_CLIENT_SECRET;
      }

      if (!resolvedClientSecret) {
        return new Response(JSON.stringify({ error: 'Unknown client_id' }), {
          status: 400,
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
          client_id: resolvedClientId,
          client_secret: resolvedClientSecret,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
