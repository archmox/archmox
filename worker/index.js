// Archmox Fleet Worker — full backend services
// Static content served by Pages projects
// API, CDN, email, and monitoring handled here

// ── Reverse proxy for glitched Pages custom domains ──
const PAGES_ORIGIN = {
  'pmg.archmox.acreetionos.org': 'https://archmox-pmg.pages.dev',
  'cdn.archmox.acreetionos.org': 'https://archmox-cdn.pages.dev',
  'pbs.archmox.acreetionos.org': 'https://archmox-pbs.pages.dev',
};

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
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

// ── CDN: R2 bucket helpers ──
async function handleCDN(request, env, cors) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/cdn/', '');

  // GET /cdn/isos — list ISOs
  if (path === 'isos' && request.method === 'GET') {
    const objects = await env.CDN_ISOS.list();
    const isos = objects.objects.map(o => ({
      name: o.key, size: o.size, uploaded: o.uploaded,
    }));
    return jsonResponse({ isos }, 200, cors);
  }

  // GET /cdn/isos/:filename — download ISO
  if (path.startsWith('isos/') && request.method === 'GET') {
    const filename = path.replace('isos/', '');
    const obj = await env.CDN_ISOS.get(filename);
    if (!obj) return jsonResponse({ error: 'ISO not found' }, 404, cors);
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // GET /cdn/repos — list packages
  if (path === 'repos' && request.method === 'GET') {
    const objects = await env.CDN_REPOS.list({ limit: 100 });
    const pkgs = objects.objects.map(o => ({
      name: o.key, size: o.size, uploaded: o.uploaded,
    }));
    return jsonResponse({ packages: pkgs }, 200, cors);
  }

  // GET /cdn/status — CDN health
  if (path === 'status' && request.method === 'GET') {
    const isoCount = (await env.CDN_ISOS.list()).objects.length;
    const repoCount = (await env.CDN_REPOS.list()).objects.length;
    return jsonResponse({
      bucket: { isos: isoCount, repos: repoCount },
      storage: 'R2 (free tier)',
    }, 200, cors);
  }

  return jsonResponse({ error: 'CDN endpoint not found' }, 404, cors);
}

// ── Main handler ──
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const cors = corsHeaders(request);
  const path = url.pathname;
  const hostname = url.hostname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ── Reverse proxy for glitched Pages ──
  const target = PAGES_ORIGIN[hostname];
  if (target && !path.startsWith('/api/') && !path.startsWith('/cdn/')) {
    const proxyUrl = target + path + (url.search || '');
    const proxyResponse = await fetch(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    return proxyResponse;
  }

  // ── CDN service ──
  if (path.startsWith('/cdn/')) {
    return handleCDN(request, env, cors);
  }

  // ── Health ──
  if (path === '/api/health' && request.method === 'GET') {
    const cdnOk = !!(env.CDN_ISOS && env.CDN_REPOS);
    const kvOk = !!(env.ARCHMOX_KV && env.FLEET_KV);
    const dbOk = !!env.DOCS_DB;
    return jsonResponse({
      status: 'ok',
      project: 'archmox',
      services: { cdn: cdnOk, kv: kvOk, d1: dbOk },
      version: env.FLEET_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
    }, 200, cors);
  }

  // ── Fleet status ──
  if (path === '/api/status' && request.method === 'GET') {
    const fleetStatus = {};
    for (const [name, domain] of Object.entries({
      main: 'archmox.acreetionos.org', pve: 'pve.archmox.acreetionos.org',
      pbs: 'pbs.archmox.acreetionos.org', pmg: 'pmg.archmox.acreetionos.org',
      docs: 'docs.archmox.acreetionos.org', cdn: 'cdn.archmox.acreetionos.org',
    })) {
      try {
        const resp = await fetch(`https://${domain}/api/health`);
        const data = await resp.json();
        fleetStatus[name] = { domain, status: data.status || 'error', services: data.services || {} };
      } catch { fleetStatus[name] = { domain, status: 'unreachable' }; }
    }
    return jsonResponse({
      fleet: fleetStatus,
      email: 'security@archmox.acreetionos.org → spivajohnathan64@gmail.com',
      discord: 'https://discord.acreetionos.org',
      cdn: 'R2 free tier (10GB)',
      kv: 'ARCHMOX_KV + FLEET_KV',
      db: 'D1 (archmox-docs)',
    }, 200, cors);
  }

  // ── Contact ──
  if (path === '/api/contact' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.name || !body.email || !body.message)
        return jsonResponse({ error: 'Name, email, message required' }, 400, cors);
      const entry = { ...body, timestamp: new Date().toISOString(), ip: request.headers.get('CF-Connecting-IP') };
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`contact:${Date.now()}`, JSON.stringify(entry));
      }
      if (env.DISCORD_WEBHOOK) {
        await fetch(env.DISCORD_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `**Archmox Contact**\n**${body.name}** <${body.email}>\n${body.message}` }),
        });
      }
      return jsonResponse({ success: true }, 200, cors);
    } catch { return jsonResponse({ error: 'Invalid request' }, 400, cors); }
  }

  // ── Newsletter ──
  if (path === '/api/newsletter' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.email) return jsonResponse({ error: 'Email required' }, 400, cors);
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`sub:${body.email}`, JSON.stringify({
          email: body.email, t: new Date().toISOString(), ip: request.headers.get('CF-Connecting-IP'),
        }));
      }
      return jsonResponse({ success: true }, 200, cors);
    } catch { return jsonResponse({ error: 'Invalid request' }, 400, cors); }
  }

  // ── Security reports ──
  if (path === '/api/security' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.description || !body.affected_component)
        return jsonResponse({ error: 'Description and affected component required' }, 400, cors);
      const report = {
        ...body, timestamp: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP'),
        source: 'web',
      };
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`security:${Date.now()}`, JSON.stringify(report));
      }
      if (env.SECURITY_WEBHOOK) {
        await fetch(env.SECURITY_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `**Archmox Security Report**\n**Reporter:** ${body.reporter || 'Anonymous'}\n**Component:** ${body.affected_component}\n**Severity:** ${body.severity || 'N/A'}\n**Description:** ${body.description}\n_Also sent to security@archmox.acreetionos.org_` }),
        });
      }
      return jsonResponse({
        success: true,
        message: 'Report received. For encrypted reports: security@archmox.acreetionos.org',
      }, 200, cors);
    } catch { return jsonResponse({ error: 'Invalid request' }, 400, cors); }
  }

  return jsonResponse({ error: 'Not found' }, 404, cors);
}

// ── Cron handler: fleet health monitoring ──
async function handleScheduled(controller, env) {
  const results = [];
  for (const [name, domain] of Object.entries({
    main: 'archmox.acreetionos.org', pve: 'pve.archmox.acreetionos.org',
    pbs: 'pbs.archmox.acreetionos.org', pmg: 'pmg.archmox.acreetionos.org',
    docs: 'docs.archmox.acreetionos.org', cdn: 'cdn.archmox.acreetionos.org',
  })) {
    try {
      const start = Date.now();
      const resp = await fetch(`https://${domain}/`);
      const ms = Date.now() - start;
      results.push({ service: name, domain, status: resp.status === 200 ? 'up' : 'degraded', ms });
    } catch (e) {
      results.push({ service: name, domain, status: 'down', error: e.message });
    }
  }
  if (env.FLEET_KV) {
    await env.FLEET_KV.put('health:latest', JSON.stringify({
      timestamp: new Date().toISOString(), results,
    }));
  }
}

export default {
  async fetch(request, env, ctx) {
    try { return await handleRequest(request, env, ctx); }
    catch (e) { return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
  },
  async scheduled(controller, env) {
    await handleScheduled(controller, env);
  },
};
