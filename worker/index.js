// Archmox Fleet Worker — serves static content + API for all subdomains
// Main site (archmox.acreetionos.org) is served by Pages project
// Subdomains (pve, pbs, pmg, docs, cdn) are served by this Worker
// SSL covered by *.acretionos.org Universal SSL wildcard

// ─── Static HTML content for each subdomain ─────────────────────────

const PAGES = {
  pve: {
    title: 'Archmox VE — Virtual Environment',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="Archmox Virtual Environment — KVM and LXC virtualization for Arch Linux.">
<title>Archmox VE — Virtual Environment | archmox.acreetionos.org</title>
<style>
:root{--am-teal:#2a9d8f;--am-orange:#f4a261;--am-bg:#0f0f0f;--am-panel:#1a1a1a;--am-box:#222;--am-border:#333;--am-text:#e0e0e0;--am-dim:#9a9a9a;--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--font-mono:"Fira Code",monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--am-bg);color:var(--am-text);line-height:1.6;padding:2rem}
a{color:var(--am-teal)}
.container{max-width:900px;margin:0 auto}
header{margin-bottom:3rem;text-align:center}
header h1{font-size:2.5rem;background:linear-gradient(135deg,var(--am-teal),var(--am-orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
nav{margin-top:1rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
nav a{padding:0.4rem 0.8rem;border-radius:6px;color:var(--am-dim);font-size:0.9rem}
nav a:hover{background:rgba(42,157,143,0.1);color:var(--am-teal);text-decoration:none}
.box{background:var(--am-panel);border:1px solid var(--am-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem}
.box h2{color:var(--am-teal);margin-bottom:1rem}
.box p{color:var(--am-dim);margin-bottom:0.8rem}
.box ul{color:var(--am-dim);margin-left:1.5rem}
.box li{margin-bottom:0.5rem}
code{font-family:var(--font-mono);background:rgba(42,157,143,0.1);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em}
.back{display:block;text-align:center;margin-top:2rem;padding:0.6rem 1.5rem;border:1px solid var(--am-border);border-radius:8px;color:var(--am-dim);font-size:0.9rem}
.back:hover{text-decoration:none;border-color:var(--am-teal);color:var(--am-teal)}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Archmox Virtual Environment</h1>
<p style="color:var(--am-dim)">pve.archmox.acreetionos.org</p>
<nav><a href="https://archmox.acreetionos.org">Main Site</a><a href="https://pbs.archmox.acreetionos.org">PBS</a><a href="https://pmg.archmox.acreetionos.org">PMG</a><a href="https://docs.archmox.acreetionos.org">Docs</a><a href="https://github.com/archmox">GitHub</a></nav>
</header>
<div class="box">
<h2>Overview</h2>
<p><strong>Archmox Virtual Environment (PVE)</strong> is a complete virtualization platform based on KVM and LXC, built for Arch Linux via PKGBUILDs.</p>
<p>Manage your virtual machines and containers through a web-based interface with full clustering, live migration, and high availability.</p>
</div>
<div class="box">
<h2>Key Features</h2>
<ul>
<li><strong>KVM Virtual Machines</strong> — Full hardware virtualization with UEFI, TPM, and GPU passthrough support</li>
<li><strong>LXC Containers</strong> — Lightweight OS-level virtualization for system containers</li>
<li><strong>Web Management UI</strong> — HTTPS-based interface for managing VMs, storage, networking, and users</li>
<li><strong>Live Migration</strong> — Move running VMs between nodes with zero downtime</li>
<li><strong>Snapshot &amp; Clone</strong> — Instant snapshots, linked clones, and full clones</li>
<li><strong>Role-Based Access Control</strong> — Granular permissions for users, groups, and realms</li>
<li><strong>Built-in Firewall</strong> — Per-VM and cluster-level firewall with IPSet support</li>
<li><strong>Two-Factor Auth</strong> — TOTP-based 2FA for the web interface</li>
</ul>
</div>
<div class="box">
<h2>Packages</h2>
<p>PVE consists of these core PKGBUILD packages:</p>
<ul>
<li><code>pve-manager</code> — Management daemon and web UI</li>
<li><code>qemu-server</code> — QEMU/KVM wrapper and management</li>
<li><code>pve-container</code> — LXC container management</li>
<li><code>pve-cluster</code> — Corosync-based cluster filesystem</li>
<li><code>pve-storage</code> — Storage backend (ZFS, Ceph, LVM, NFS, iSCSI)</li>
<li><code>pve-network</code> — Software-defined networking (SDN, VXLAN, VLAN)</li>
<li><code>pve-firewall</code> — Cluster firewall management</li>
<li><code>pve-ha-manager</code> — High availability resource scheduling</li>
</ul>
</div>
<div class="box">
<h2>Installation</h2>
<p style="text-align:center;padding:1.5rem;background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;font-size:1.1rem;color:var(--am-teal);font-weight:700">&#8987; Coming Soon</p>
<p>Installation packages and ISOs will be available once the initial port is complete.</p>
</div>
<a href="https://archmox.acreetionos.org" class="back">&larr; Back to Archmox</a>
</div>
</body>
</html>`
  },

  pbs: {
    title: 'Archmox PBS — Backup Server',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="Archmox Backup Server — Deduplicated backup for VMs and containers on Arch Linux.">
<title>Archmox PBS — Backup Server | archmox.acreetionos.org</title>
<style>
:root{--am-teal:#2a9d8f;--am-orange:#f4a261;--am-bg:#0f0f0f;--am-panel:#1a1a1a;--am-box:#222;--am-border:#333;--am-text:#e0e0e0;--am-dim:#9a9a9a;--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--font-mono:"Fira Code",monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--am-bg);color:var(--am-text);line-height:1.6;padding:2rem}
a{color:var(--am-teal)}
.container{max-width:900px;margin:0 auto}
header{margin-bottom:3rem;text-align:center}
header h1{font-size:2.5rem;background:linear-gradient(135deg,var(--am-teal),var(--am-orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
nav{margin-top:1rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
nav a{padding:0.4rem 0.8rem;border-radius:6px;color:var(--am-dim);font-size:0.9rem}
nav a:hover{background:rgba(42,157,143,0.1);color:var(--am-teal);text-decoration:none}
.box{background:var(--am-panel);border:1px solid var(--am-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem}
.box h2{color:var(--am-teal);margin-bottom:1rem}
.box p{color:var(--am-dim);margin-bottom:0.8rem}
.box ul{color:var(--am-dim);margin-left:1.5rem}
.box li{margin-bottom:0.5rem}
code{font-family:var(--font-mono);background:rgba(42,157,143,0.1);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em}
.back{display:block;text-align:center;margin-top:2rem;padding:0.6rem 1.5rem;border:1px solid var(--am-border);border-radius:8px;color:var(--am-dim);font-size:0.9rem}
.back:hover{text-decoration:none;border-color:var(--am-teal);color:var(--am-teal)}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Archmox Backup Server</h1>
<p style="color:var(--am-dim)">pbs.archmox.acreetionos.org</p>
<nav><a href="https://archmox.acreetionos.org">Main Site</a><a href="https://pve.archmox.acreetionos.org">PVE</a><a href="https://pmg.archmox.acreetionos.org">PMG</a><a href="https://docs.archmox.acreetionos.org">Docs</a><a href="https://github.com/archmox">GitHub</a></nav>
</header>
<div class="box">
<h2>Overview</h2>
<p><strong>Archmox Backup Server (PBS)</strong> is an enterprise-grade backup solution for VMs and containers featuring content-addressable storage, inline deduplication, and encryption. The core is written in Rust for maximum performance.</p>
<p>PBS integrates natively with PVE and supports backing up to local storage, NFS, SMB, and S3-compatible object storage.</p>
</div>
<div class="box">
<h2>Key Features</h2>
<ul>
<li><strong>Content-Addressable Storage</strong> — Data is chunked and indexed by cryptographic hash, eliminating duplicates</li>
<li><strong>Inline Deduplication</strong> — Identical data blocks are stored once, dramatically reducing storage usage</li>
<li><strong>Client-Side Encryption</strong> — Encrypt backups before they leave the source</li>
<li><strong>Incremental Backups</strong> — Only changed blocks are transferred after the initial full backup</li>
<li><strong>Scheduling &amp; Retention</strong> — Configurable backup schedules with prune policies (keep-last, keep-daily, etc.)</li>
<li><strong>Remote Sync</strong> — Sync backups between PBS instances for off-site DR</li>
<li><strong>Web UI &amp; REST API</strong> — Full management interface and automation API</li>
<li><strong>Verification Jobs</strong> — Automatically verify backup integrity on a schedule</li>
</ul>
</div>
<div class="box">
<h2>Packages</h2>
<ul>
<li><code>archmox-pbs</code> — Backup server daemon and tools</li>
<li><code>pxar</code> — High-performance archive format</li>
<li><code>archmox-pbs-qemu</code> — QEMU integration for live VM backups</li>
</ul>
</div>
<div class="box">
<h2>Installation</h2>
<p style="text-align:center;padding:1.5rem;background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;font-size:1.1rem;color:var(--am-teal);font-weight:700">&#8987; Coming Soon</p>
</div>
<a href="https://archmox.acreetionos.org" class="back">&larr; Back to Archmox</a>
</div>
</body>
</html>`
  },

  pmg: {
    title: 'Archmox PMG — Mail Gateway',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="Archmox Mail Gateway — SMTP proxy with spam filtering for Arch Linux.">
<title>Archmox PMG — Mail Gateway | archmox.acreetionos.org</title>
<style>
:root{--am-teal:#2a9d8f;--am-orange:#f4a261;--am-bg:#0f0f0f;--am-panel:#1a1a1a;--am-box:#222;--am-border:#333;--am-text:#e0e0e0;--am-dim:#9a9a9a;--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--font-mono:"Fira Code",monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--am-bg);color:var(--am-text);line-height:1.6;padding:2rem}
a{color:var(--am-teal)}
.container{max-width:900px;margin:0 auto}
header{margin-bottom:3rem;text-align:center}
header h1{font-size:2.5rem;background:linear-gradient(135deg,var(--am-teal),var(--am-orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
nav{margin-top:1rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
nav a{padding:0.4rem 0.8rem;border-radius:6px;color:var(--am-dim);font-size:0.9rem}
nav a:hover{background:rgba(42,157,143,0.1);color:var(--am-teal);text-decoration:none}
.box{background:var(--am-panel);border:1px solid var(--am-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem}
.box h2{color:var(--am-teal);margin-bottom:1rem}
.box p{color:var(--am-dim);margin-bottom:0.8rem}
.box ul{color:var(--am-dim);margin-left:1.5rem}
.box li{margin-bottom:0.5rem}
code{font-family:var(--font-mono);background:rgba(42,157,143,0.1);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em}
.back{display:block;text-align:center;margin-top:2rem;padding:0.6rem 1.5rem;border:1px solid var(--am-border);border-radius:8px;color:var(--am-dim);font-size:0.9rem}
.back:hover{text-decoration:none;border-color:var(--am-teal);color:var(--am-teal)}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Archmox Mail Gateway</h1>
<p style="color:var(--am-dim)">pmg.archmox.acreetionos.org</p>
<nav><a href="https://archmox.acreetionos.org">Main Site</a><a href="https://pve.archmox.acreetionos.org">PVE</a><a href="https://pbs.archmox.acreetionos.org">PBS</a><a href="https://docs.archmox.acreetionos.org">Docs</a><a href="https://github.com/archmox">GitHub</a></nav>
</header>
<div class="box">
<h2>Overview</h2>
<p><strong>Archmox Mail Gateway (PMG)</strong> is a fully-featured SMTP proxy that sits in front of your mail server and provides spam filtering, virus scanning, and policy-based routing. Built for Arch Linux.</p>
<p>PMG acts as a mail relay — it receives inbound mail, filters it, and forwards clean mail to your internal mail server.</p>
</div>
<div class="box">
<h2>Key Features</h2>
<ul>
<li><strong>SpamAssassin Integration</strong> — Bayesian filtering, rule-based scoring, and auto-learning</li>
<li><strong>ClamAV Virus Scanning</strong> — Attachment-level virus detection on all inbound and outbound mail</li>
<li><strong>Quarantine System</strong> — Users can review and release quarantined messages via web UI or daily digest</li>
<li><strong>Policy Routing</strong> — Route mail based on sender, recipient, or content classification</li>
<li><strong>LDAP/AD Integration</strong> — Authenticate users against existing directory services</li>
<li><strong>Web UI &amp; REST API</strong> — Full management interface with role-based access</li>
<li><strong>Transport Layer Security</strong> — TLS for both inbound and outbound SMTP connections</li>
<li><strong>Outbound Filtering</strong> — Scan outbound mail for policy violations and malware</li>
</ul>
</div>
<div class="box">
<h2>Packages</h2>
<ul>
<li><code>pmg-api</code> — Mail gateway API and daemon</li>
<li><code>pmg-gui</code> — Web-based administration interface</li>
<li><code>pmg-docs</code> — Documentation and man pages</li>
</ul>
</div>
<div class="box">
<h2>Installation</h2>
<p style="text-align:center;padding:1.5rem;background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;font-size:1.1rem;color:var(--am-teal);font-weight:700">&#8987; Coming Soon</p>
</div>
<a href="https://archmox.acreetionos.org" class="back">&larr; Back to Archmox</a>
</div>
</body>
</html>`
  },

  docs: {
    title: 'Archmox Docs — Documentation',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="Archmox Documentation — Porting guides, API docs, and manuals.">
<title>Archmox Docs — Documentation | archmox.acreetionos.org</title>
<style>
:root{--am-teal:#2a9d8f;--am-orange:#f4a261;--am-bg:#0f0f0f;--am-panel:#1a1a1a;--am-box:#222;--am-border:#333;--am-text:#e0e0e0;--am-dim:#9a9a9a;--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--font-mono:"Fira Code",monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--am-bg);color:var(--am-text);line-height:1.6;padding:2rem}
a{color:var(--am-teal)}
.container{max-width:900px;margin:0 auto}
header{margin-bottom:3rem;text-align:center}
header h1{font-size:2.5rem;background:linear-gradient(135deg,var(--am-teal),var(--am-orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
nav{margin-top:1rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
nav a{padding:0.4rem 0.8rem;border-radius:6px;color:var(--am-dim);font-size:0.9rem}
nav a:hover{background:rgba(42,157,143,0.1);color:var(--am-teal);text-decoration:none}
.box{background:var(--am-panel);border:1px solid var(--am-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem}
.box h2{color:var(--am-teal);margin-bottom:1rem}
.box p{color:var(--am-dim);margin-bottom:0.8rem}
.box ul{color:var(--am-dim);margin-left:1.5rem}
.box li{margin-bottom:0.5rem}
code{font-family:var(--font-mono);background:rgba(42,157,143,0.1);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em}
.back{display:block;text-align:center;margin-top:2rem;padding:0.6rem 1.5rem;border:1px solid var(--am-border);border-radius:8px;color:var(--am-dim);font-size:0.9rem}
.back:hover{text-decoration:none;border-color:var(--am-teal);color:var(--am-teal)}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin:1.5rem 0}
.doc-card{background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;padding:1.25rem;transition:border-color 0.2s}
.doc-card:hover{border-color:var(--am-teal)}
.doc-card h3{margin-bottom:0.5rem;font-size:1.1rem}
.doc-card p{font-size:0.85rem;margin:0}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Archmox Documentation</h1>
<p style="color:var(--am-dim)">docs.archmox.acreetionos.org</p>
<nav><a href="https://archmox.acreetionos.org">Main Site</a><a href="https://pve.archmox.acreetionos.org">PVE</a><a href="https://pbs.archmox.acreetionos.org">PBS</a><a href="https://pmg.archmox.acreetionos.org">PMG</a><a href="https://github.com/archmox">GitHub</a></nav>
</header>
<div class="box">
<h2>Documentation Hub</h2>
<p>Welcome to the Archmox documentation hub. Here you'll find porting guides, API references, architecture docs, and manuals for all Archmox components.</p>
<p>Documentation is being actively developed as the port progresses. Check the <a href="https://github.com/archmox">GitHub repositories</a> for the latest updates.</p>
</div>
<div class="doc-grid">
<div class="doc-card">
<h3>&#128214; Porting Guide</h3>
<p>How to build and package Archmox components from source. Covers PKGBUILDs, Perl module paths, systemd services, and archiso integration.</p>
</div>
<div class="doc-card">
<h3>&#9881; PVE Architecture</h3>
<p>Architecture overview of the PVE stack: cluster communication, storage backend abstraction, and VM lifecycle management.</p>
</div>
<div class="doc-card">
<h3>&#128230; PBS Internals</h3>
<p>Content-addressable storage design, chunking strategy, data deduplication, and the pxar archive format.</p>
</div>
<div class="doc-card">
<h3>&#9993; PMG Configuration</h3>
<p>Setting up SMTP proxies, SpamAssassin rules, ClamAV integration, and quarantine management.</p>
</div>
<div class="doc-card">
<h3>&#128640; API Reference</h3>
<p>REST API documentation for all Archmox components — PVE, PBS, and PMG endpoints.</p>
</div>
<div class="doc-card">
<h3>&#128297; Building from Source</h3>
<p>How to build Archmox packages from source using PKGBUILDs and the Arch Linux build system.</p>
</div>
</div>
<a href="https://archmox.acreetionos.org" class="back">&larr; Back to Archmox</a>
</div>
</body>
</html>`
  },

  cdn: {
    title: 'Archmox CDN — ISOs & Packages',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="description" content="Archmox CDN — ISO downloads and binary repositories.">
<title>Archmox CDN — ISOs & Packages | archmox.acreetionos.org</title>
<style>
:root{--am-teal:#2a9d8f;--am-orange:#f4a261;--am-bg:#0f0f0f;--am-panel:#1a1a1a;--am-box:#222;--am-border:#333;--am-text:#e0e0e0;--am-dim:#9a9a9a;--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--font-mono:"Fira Code",monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--am-bg);color:var(--am-text);line-height:1.6;padding:2rem}
a{color:var(--am-teal)}
.container{max-width:900px;margin:0 auto}
header{margin-bottom:3rem;text-align:center}
header h1{font-size:2.5rem;background:linear-gradient(135deg,var(--am-teal),var(--am-orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
nav{margin-top:1rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
nav a{padding:0.4rem 0.8rem;border-radius:6px;color:var(--am-dim);font-size:0.9rem}
nav a:hover{background:rgba(42,157,143,0.1);color:var(--am-teal);text-decoration:none}
.box{background:var(--am-panel);border:1px solid var(--am-border);border-radius:12px;padding:2rem;margin-bottom:1.5rem}
.box h2{color:var(--am-teal);margin-bottom:1rem}
.box p{color:var(--am-dim);margin-bottom:0.8rem}
.box ul{color:var(--am-dim);margin-left:1.5rem}
.box li{margin-bottom:0.5rem}
code{font-family:var(--font-mono);background:rgba(42,157,143,0.1);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em}
.back{display:block;text-align:center;margin-top:2rem;padding:0.6rem 1.5rem;border:1px solid var(--am-border);border-radius:8px;color:var(--am-dim);font-size:0.9rem}
.back:hover{text-decoration:none;border-color:var(--am-teal);color:var(--am-teal)}
.listing{background:var(--am-box);border:1px solid var(--am-border);border-radius:8px;padding:1rem;margin:0.5rem 0;font-family:var(--font-mono);font-size:0.9rem}
.listing a{display:block;padding:0.3rem 0;color:var(--am-dim)}
.listing a:hover{color:var(--am-teal)}
</style>
</head>
<body>
<div class="container">
<header>
<h1>Archmox CDN</h1>
<p style="color:var(--am-dim)">cdn.archmox.acreetionos.org</p>
<nav><a href="https://archmox.acreetionos.org">Main Site</a><a href="https://pve.archmox.acreetionos.org">PVE</a><a href="https://pbs.archmox.acreetionos.org">PBS</a><a href="https://pmg.archmox.acreetionos.org">PMG</a><a href="https://docs.archmox.acreetionos.org">Docs</a></nav>
</header>
<div class="box">
<h2>ISO Downloads</h2>
<p style="text-align:center;padding:1.5rem;background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;font-size:1.1rem;color:var(--am-teal);font-weight:700">&#8987; Coming Soon</p>
<p>Archmox installation ISOs and binary packages will be available once the initial port is complete.</p>
</div>
<div class="box">
<h2>Binary Repository</h2>
<p style="text-align:center;padding:1.5rem;background:var(--am-box);border:1px solid var(--am-border);border-radius:10px;font-size:1.1rem;color:var(--am-teal);font-weight:700">&#8987; Coming Soon</p>
<p>Archmox packages will be available via an Arch Linux binary repository once the port stabilizes.</p>
</div>
<div class="box">
<h2>Mirrors</h2>
<p>If you'd like to host a mirror for Archmox ISOs or packages, please reach out via <a href="https://discord.acreetionos.org">Discord</a> or the mailing list. We welcome community mirrors!</p>
</div>
<a href="https://archmox.acreetionos.org" class="back">&larr; Back to Archmox</a>
</div>
</body>
</html>`
  }
};

// ─── API handlers ────────────────────────────────────────────────────

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

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ─── Main request handler ────────────────────────────────────────────

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request);
  const path = url.pathname;
  const hostname = url.hostname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // ── Subdomain static content routing ──
  // Extract subdomain from hostname (e.g. "pve" from "pve.archmox.acreetionos.org")
  const match = hostname.match(/^(\w+)\.archmox\.acreetionos\.org$/);
  if (match) {
    const sub = match[1];
    if (PAGES[sub]) {
      return htmlResponse(PAGES[sub].html);
    }
  }

  // ── API routes ──

  // Health check
  if (path === '/api/health' && request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      project: 'archmox',
      version: env.FLEET_VERSION || '1.0.0',
      ssl: 'covered by *.acretionos.org Universal SSL',
      timestamp: new Date().toISOString(),
    }, 200, cors);
  }

  // Fleet status
  if (path === '/api/status' && request.method === 'GET') {
    return jsonResponse({
      fleet: {
        main: { domain: 'archmox.acreetionos.org', via: 'Cloudflare Pages' },
        pve: { domain: 'pve.archmox.acreetionos.org', via: 'Worker' },
        pbs: { domain: 'pbs.archmox.acreetionos.org', via: 'Worker' },
        pmg: { domain: 'pmg.archmox.acreetionos.org', via: 'Worker' },
        docs: { domain: 'docs.archmox.acreetionos.org', via: 'Worker' },
        cdn: { domain: 'cdn.archmox.acreetionos.org', via: 'Worker' },
      },
      ssl: '*.acretionos.org Universal SSL',
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
      if (env.DISCORD_WEBHOOK) {
        await fetch(env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**New Archmox Contact Form**\n**Name:** ${name}\n**Email:** ${email}\n**Subject:** ${subject || 'N/A'}\n**Message:** ${message}`,
          }),
        });
      }
      return jsonResponse({ success: true, message: 'Message received.' }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  // Newsletter signup
  if (path === '/api/newsletter' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email } = body;
      if (!email) return jsonResponse({ error: 'Email is required' }, 400, cors);
      if (env.ARCHMOX_KV) {
        await env.ARCHMOX_KV.put(`subscriber:${email}`, JSON.stringify({
          email, subscribed_at: new Date().toISOString(), source: 'archmox',
        }));
      }
      return jsonResponse({ success: true, message: 'Subscribed!' }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  // Security report
  if (path === '/api/security' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { reporter, description, severity, affected_component } = body;
      if (!description || !affected_component) {
        return jsonResponse({ error: 'Description and affected component are required' }, 400, cors);
      }
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
        message: 'Report received. For encrypted reports: security@archmox.acreetionos.org',
      }, 200, cors);
    } catch {
      return jsonResponse({ error: 'Invalid request' }, 400, cors);
    }
  }

  // ISO redirect
  if (path.startsWith('/api/iso/') && request.method === 'GET') {
    const version = path.replace('/api/iso/', '');
    return Response.redirect(`https://cdn.archmox.acreetionos.org/isos/${version}/archmox-ve-${version}-x86_64.iso`, 302);
  }

  // If we get here on a subdomain with a non-matching path, serve the subdomain's main page
  if (match && PAGES[match[1]]) {
    return htmlResponse(PAGES[match[1]].html);
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
