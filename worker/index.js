// Archmox API Worker — backend API for all fleet Pages projects
// Static content is served directly by the Pages projects
// This Worker only handles API endpoints

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
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // Health check
  if (path === '/api/health' && request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      project: 'archmox',
      version: env.FLEET_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
    }, 200, cors);
  }

  // Fleet status
  if (path === '/api/status' && request.method === 'GET') {
    return jsonResponse({
      fleet: {
        main: 'archmox.acreetionos.org',
        pve: 'pve.archmox.acreetionos.org',
        pbs: 'pbs.archmox.acreetionos.org',
        pmg: 'pmg.archmox.acreetionos.org',
        docs: 'docs.archmox.acreetionos.org',
        cdn: 'cdn.archmox.acreetionos.org',
      },
      discord: 'https://discord.acreetionos.org',
      security: 'security@archmox.acreetionos.org',
    }, 200, cors);
  }

  // Contact form
  if (path === '/api/contact' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.name || !body.email || !body.message) {
        return jsonResponse({ error: 'Name, email, and message are required' }, 400, cors);
      }
      if (env.DISCORD_WEBHOOK) {
        await fetch(env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**New Archmox Contact**\n**Name:** ${body.name}\n**Email:** ${body.email}\n**Subject:** ${body.subject || 'N/A'}\n**Message:** ${body.message}`,
          }),
        });
      }
      return jsonResponse({ success: true }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  // Newsletter
  if (path === '/api/newsletter' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.email) return jsonResponse({ error: 'Email required' }, 400, cors);
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`sub:${body.email}`, JSON.stringify({
          email: body.email, t: new Date().toISOString(),
        }));
      }
      return jsonResponse({ success: true }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  // Security report
  if (path === '/api/security' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.description || !body.affected_component) {
        return jsonResponse({ error: 'Description and affected component required' }, 400, cors);
      }
      if (env.SECURITY_WEBHOOK) {
        await fetch(env.SECURITY_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**Security Report**\n**Reporter:** ${body.reporter || 'Anonymous'}\n**Severity:** ${body.severity || 'N/A'}\n**Component:** ${body.affected_component}\n**Description:** ${body.description}`,
          }),
        });
      }
      return jsonResponse({ success: true }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  return jsonResponse({ error: 'Not found' }, 404, cors);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
