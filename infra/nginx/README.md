# Nginx — archmox fleet edge (us.iso.acreetionos.org)

The `*.archmox.acreetionos.org` DNS records are grey-cloud (direct to origin),
so nginx on the shared AcreetionOS host is the front door for the fleet.

## Layout

| File | Server path | Purpose |
|------|-------------|---------|
| `sites-available/archmox-fleet` | `/etc/nginx/sites-available/` (symlinked from `sites-enabled/`) | Port-80 ACME + HTTPS redirect; port-443 reverse proxy: static content → Cloudflare Pages, `/api/*` + `/cdn/*` → `archmox-api` Worker |
| `conf.d/archmox-fleet-map.conf` | `/etc/nginx/conf.d/` | `$host` → Pages deployment map |

TLS is a single multi-SAN Let's Encrypt certificate (`archmox-fleet`) covering
all six hostnames, issued via webroot HTTP-01 at `/var/www/letsencrypt` and
auto-renewed by certbot.

## Deploying changes

```sh
scp sites-available/archmox-fleet natalie@us.iso.acreetionos.org:/tmp/
ssh natalie@us.iso.acreetionos.org
sudo cp /tmp/archmox-fleet /etc/nginx/sites-available/archmox-fleet
sudo nginx -t && sudo systemctl reload nginx
```

## Notes

- The catch-all `default_server` in `/etc/nginx/redirects/catchall-redirect.conf`
  is managed separately (acreetionos-robots-edge) and intentionally redirects
  only *unknown* hostnames; named blocks always win.
- `/etc/nginx/nginx.conf` includes `/etc/nginx/redirects/*.conf` — keep the
  `.conf` suffix glob; a bare `*` once picked up editor backups and produced
  duplicate `default_server` definitions that broke config validation.
