// Archmox API Worker — Backend for the Archmox fleet
// Sponsored by the AcreetionOS Project
// Website: https://archmox.acreetionos.org
// This worker provides:
//   GET  /api/health         — Health check
//   POST /api/contact        — Contact form submissions
//   POST /api/newsletter     — Newsletter signup
//   GET  /api/status         — Overall fleet status
//   GET  /api/iso/:version   — Redirect to latest ISO
//   POST /api/security       — Security report submission

const ALLOWED_ORIGINS = [
  'https://archmox.acreetionos.org',
  'https://pve.archmox.acreetionos.org',
  'https://pbs.archmox.acreetionos.org',
  'https://pmg.archmox.acreetionos.org',
  'https://docs.archmox.acreetionos.org',
  'https://cdn.archmox.acreetionos.org',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
    },
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // Health check
  if (path === '/api/health' && request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      project: 'archmox',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }, 200, cors);
  }

  // Fleet status
  if (path === '/api/status' && request.method === 'GET') {
    return jsonResponse({
      fleet: {
        main: { domain: 'archmox.acreetionos.org', status: 'active' },
        pve: { domain: 'pve.archmox.acreetionos.org', status: 'active' },
        pbs: { domain: 'pbs.archmox.acreetionos.org', status: 'active' },
        pmg: { domain: 'pmg.archmox.acreetionos.org', status: 'active' },
        docs: { domain: 'docs.archmox.acreetionos.org', status: 'active' },
        cdn: { domain: 'cdn.archmox.acreetionos.org', status: 'active' },
      },
      discord: 'https://discord.acreetionos.org',
      security: 'security@archmox.acreetionos.org',
    }, 200, cors);
  }

  // Contact form
  if (path === '/api/contact' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { name, email, message, subject } = body;
      
      if (!name || !email || !message) {
        return jsonResponse({ error: 'Name, email, and message are required' }, 400, cors);
      }

      // Forward to Discord webhook or email
      if (env.DISCORD_WEBHOOK) {
        await fetch(env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**New Archmox Contact Form Submission**\n**Name:** ${name}\n**Email:** ${email}\n**Subject:** ${subject || 'N/A'}\n**Message:** ${message}`,
          }),
        });
      }

      return jsonResponse({ success: true, message: 'Message received. We will get back to you soon.' }, 200, cors);
    } catch (e) {
      return jsonResponse({ error: 'Invalid request body' }, 400, cors);
    }
  }

  // Newsletter signup
  if (path === '/api/newsletter' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return jsonResponse({ error: 'Email is required' }, 400, cors);
      }

      // Store in KV if available
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`subscriber:${email}`, JSON.stringify({
          email,
          subscribed_at: new Date().toISOString(),
          source: 'archmox',
        }));
      }

      return jsonResponse({ success: true, message: 'Subscribed successfully!' }, 200, cors);
    } catch (e) {
      return jsonResponse({ error: 'Invalid request body' }, 400, cors);
    }
  }

  // Security report submission
  if (path === '/api/security' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { reporter, description, severity, affected_component } = body;

      if (!description || !affected_component) {
        return jsonResponse({ error: 'Description and affected component are required' }, 400, cors);
      }

      // Forward to security team
      if (env.SECURITY_WEBHOOK) {
        await fetch(env.SECURITY_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**Security Report - Archmox**\n**Reporter:** ${reporter || 'Anonymous'}\n**Severity:** ${severity || 'Unspecified'}\n**Component:** ${affected_component}\n**Description:** ${description}`,
          }),
        });
      }

      return jsonResponse({
        success: true,
        message: 'Report received. For encrypted reports, email security@archmox.acreetionos.org',
      }, 200, cors);
    } catch (e) {
      return jsonResponse({ error: 'Invalid request body' }, 400, cors);
    }
  }

  // ISO redirect
  if (path.startsWith('/api/iso/') && request.method === 'GET') {
    const version = path.replace('/api/iso/', '');
    const isoUrl = `https://cdn.archmox.acreetionos.org/isos/${version}/archmox-ve-${version}-x86_64.iso`;
    return Response.redirect(isoUrl, 302);
  }

  // 404 for unknown API routes
  return jsonResponse({ error: 'Not found', path }, 404, cors);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
