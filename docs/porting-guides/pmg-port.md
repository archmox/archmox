# PMG Porting Guide: Debian to Arch Linux PKGBUILDs

## Overview

The Proxmox Mail Gateway (PMG) is an SMTP proxy that provides spam filtering, virus scanning, and policy-based email routing. Unlike PVE and PBS, PMG has a smaller package footprint but deeply integrates with the mail infrastructure stack (Postfix, ClamAV, SpamAssassin) and requires careful configuration of mail flow.

This guide details the porting of PMG from its Debian packaging to Arch Linux PKGBUILDs, covering the SMTP proxy architecture, content filtering pipeline, quarantine management, and integration with standard Arch Linux mail packages.

## Package Architecture

PMG consists of three primary packages:

| PKGBUILD | Language | Purpose |
|----------|----------|---------|
| `pmg-api` | Perl | Core API daemon, SMTP proxy logic, rule engine |
| `pmg-gui` | JavaScript/ExtJS | Web-based administration interface |
| `pmg-docs` | HTML | Documentation and man pages |

### Dependency Chain

```
pmg-api
  ├── archmox-pve-common        # Shared Perl utilities
  ├── archmox-pve-access-control  # Authentication (PAM, LDAP, TOTP)
  ├── archmox-pve-http-server     # HTTP/HTTPS API daemon
  ├── archmox-pve-cluster         # Cluster filesystem (pmxcfs)
  ├── perl-mailtools              # Email message parsing
  ├── perl-mime-lite              # MIME encoding/decoding
  ├── perl-email-simple           # Simple email parsing
  ├── perl-email-mime             # MIME email handling
  ├── perl-email-address          # Email address validation
  ├── perl-net-server             # TCP server framework (SMTP proxy)
  ├── perl-net-smtp-ssl           # SMTP over TLS
  ├── postfix                     # Mail Transfer Agent
  ├── clamav                      # Virus scanner
  ├── spamassassin                # Spam detection
  └── dkim-milter                 # DKIM signing/verification

pmg-gui
  └── archmox-proxmox-widget-toolkit  # ExtJS widgets

pmg-docs
  └── (standalone HTML documentation)
```

### PMG Specific Perl Modules

PMG adds several Perl modules not found in PVE:

```
Proxmox::PMG::*
  ├── Config            # Configuration file parsing
  ├── RuleEngine        # Content filtering rules
  ├── RuleCache         # Cached rule evaluation
  ├── SMTP              # SMTP protocol handling
  ├── SpamDetector      # SpamAssassin integration
  ├── VirusDetector     # ClamAV integration
  ├── DKIM              # DKIM verification/signing
  ├── Quarantine        # Quarantine storage and digests
  ├── LDAPTool          # LDAP directory integration
  ├── Statistics        # Mail flow statistics
  └── Custom           # Custom regex/script rules
```

## SMTP Proxy Architecture

PMG operates as a transparent SMTP proxy sitting between the internet and the internal mail server. The mail flow is:

```
Internet → PMG (port 25) → [filter] → Internal MTA (port 125)
            ↓
        Quarantine (spam/virus)
```

### Components

1. **pmg-smtp-filter** — The core SMTP proxy daemon. It:
   - Accepts inbound SMTP connections on port 25
   - Receives the full message via `DATA`
   - Runs through the rule engine (SpamAssassin, ClamAV, custom rules)
   - Forwards clean mail to the internal MTA on port 125 (or rejects/quarantines)
   - Supports TLS from both external senders and to internal MTA

2. **pmg-smtp-forward** — Outbound mail forwarder:
   - Accepts mail from internal MTA on port 26
   - Applies outbound filtering rules
   - Signs with DKIM if configured
   - Delivers to external MX

3. **pmg-policy** — Policy daemon consulted by Postfix via `check_policy_service`:
   - Real-time sender/recipient validation
   - Greylisting decisions
   - Rate limiting

4. **pmg-log-tracker** — Tracks mail flow and generates statistics

### Postfix Configuration

PMG configures Postfix to route mail through the proxy:

```postfix
# /etc/postfix/main.cf edits by PMG:
content_filter = scan:localhost:10026  # Outbound filtering
receive_override_options = no_address_mappings

# Master.cf additions:
scan      unix  -       -       n       -       10      smtp
    -o smtp_send_xforward_command=yes
    -o smtp_bind_address=127.0.0.1
    -o smtp_bind_address6=::1

127.0.0.1:10026 inet  n       -       n       -       10      smtpd
    -o content_filter=
    -o receive_override_options=
    -o smtpd_restriction_classes=
    -o smtpd_client_restrictions=
    -o smtpd_helo_restrictions=
    -o smtpd_sender_restrictions=
    -o smtpd_recipient_restrictions=permit_mynetworks,reject
    -o mynetworks=127.0.0.0/8
    -o smtpd_authorized_xforward_hosts=127.0.0.0/8
```

On Arch Linux, Postfix configuration is at `/etc/postfix/`. The PKGBUILD must ensure Postfix is configured as a satellite system, not as a final delivery MTA.

## Content Filtering Pipeline

### Rule Engine

PMG's rule engine processes each message through a configurable chain:

```
[Inbound Message]
    ↓
1. Pre-filter rules (header checks)
    ↓
2. Virus scan (ClamAV)
    ├── Clean → continue
    └── Infected → quarantine/reject
    ↓
3. Spam scan (SpamAssassin)
    ├── Score < threshold → deliver
    ├── Score > threshold but < quarantine → mark subject [SPAM]
    └── Score > quarantine → quarantine
    ↓
4. Custom rules (regex, scripts, LDAP)
    ├── Whitelist → deliver unconditionally
    ├── Blacklist → reject
    └── Custom action → defined by administrator
    ↓
5. DKIM verification/signing
    ↓
6. Forward to internal MTA
```

Rules are stored in `/etc/pmg/rules/` and can be:
- **Who** rules: Match sender/recipient patterns
- **What** rules: Match content (regex on headers/body/attachments)
- **When** rules: Time-based conditions
- **Action** rules: deliver, reject, quarantine, mark, forward

### SpamAssassin Integration

PMG embeds SpamAssassin via `Mail::SpamAssassin` Perl module. Key integration points:

- **Bayes database** stored at `/var/lib/pmg/spamassassin/bayes/`
- **Auto-learning**: PMG trains SpamAssassin based on user quarantine actions
- **Rule updates**: `sa-update` runs periodically for new spam rules
- **Custom scores**: Administrators can override scores per rule via the web UI

### ClamAV Integration

ClamAV integration uses `ClamAV::Client` Perl module or direct Unix socket communication:

```perl
# Connection via Unix socket
my $clam = ClamAV::Client->new(
    socket => '/var/run/clamav/clamd.sock'
);
my $result = $clam->scan($tmpfile);
```

On Arch Linux, ClamAV is installed from the `clamav` package and configured via `/etc/clamav/clamd.conf`. The `freshclam` daemon handles virus definition updates.

## Quarantine System

PMG provides a per-user quarantine system:

### Storage

Quarantined messages are stored in:

```
/var/lib/pmg/quarantine/
  ├── <year>/
  │   ├── <month>/
  │   │   ├── <day>/
  │   │   │   ├── <hash>.eml          # Original message (encrypted)
  │   │   │   └── <hash>.meta          # Metadata (sender, recipient, reason)
  │   │   └── ...
  │   └── ...
  └── ...
```

### Quarantine Digest

Users receive a daily digest email listing quarantined messages. The digest includes:
- Sender, subject, date for each quarantined message
- Links to release, delete, or report as not-spam
- Optional attachment listing

The digest is generated by `pmg-quarantine-digest` which runs via a systemd timer.

### Quarantine Management via Web UI

Users authenticate via:
- Local PMG user database
- LDAP/Active Directory
- Email-based authentication tokens

After login, users can:
- View and search quarantined messages
- Release messages to their inbox
- Report false positives (train SpamAssassin)
- Whitelist/blacklist senders
- Configure digest preferences

## DKIM Signing and Verification

PMG supports both DKIM verification (inbound) and signing (outbound):

### Verification
Inbound mail is checked against the sender's DKIM DNS record. Results are added as headers:
```
Authentication-Results: pmg.example.com;
    dkim=pass header.d=example.com header.s=selector;
```

### Signing
Outbound mail can be signed with a domain key. Configuration in `/etc/pmg/dkim/`:
```
/etc/pmg/dkim/
  ├── <domain>.private   # Private key (PEM)
  └── <domain>.public    # Public key
```

The DKIM daemon (`opendkim` or integrated `pmg-dkim`) performs signing.

## File System Layout

PMG installs to:

```
/usr/bin/
  ├── pmg-smtp-filter         # SMTP proxy daemon
  ├── pmg-smtp-forward        # Outbound forwarder
  ├── pmg-policy              # Policy daemon
  ├── pmg-log-tracker         # Mail flow tracking
  ├── pmg-quarantine-digest   # Digest generator
  └── pmgsh                   # CLI management shell (/usr/bin/pmgsh)

/usr/share/pmg/
  ├── www/                    # Web UI
  └── i18n/                   # Translations

/usr/share/perl5/vendor_perl/Proxmox/PMG/  # Perl modules

/etc/pmg/
  ├── pmg.conf                # Main configuration
  ├── rules/                  # Content filtering rules
  ├── dkim/                   # DKIM keys
  ├── tls/                    # TLS certificates
  └── templates/              # Email templates

/var/lib/pmg/
  ├── quarantine/             # Quarantined messages
  ├── spamassassin/           # Bayes databases
  ├── stats/                  # Mail flow statistics
  └── logs/                   # PMG-specific logs

/usr/lib/systemd/system/
  ├── pmg-smtp-filter.service
  ├── pmg-smtp-forward.service
  ├── pmg-policy.service
  ├── pmg-log-tracker.service
  ├── pmg-quarantine-digest.timer
  └── postfix.service
```

## Verification

After porting, verify the PMG installation:

1. Configure Postfix for PMG mode (listening on loopback only, relaying to PMG)
2. Start ClamAV: `systemctl enable --now clamd freshclam`
3. Start SpamAssassin: `systemctl enable --now spamassassin`
4. Start PMG services: `systemctl enable --now pmg-smtp-filter pmg-policy pmg-log-tracker`
5. Access web UI at `https://<hostname>:8006/` (shared with PVE UI)
6. Send test email through the gateway and verify filtering
7. Check quarantine via web UI or digest
8. Test DKIM signing with outbound mail
9. Run `pmgsh get /status` to verify daemon health

## References

- [Proxmox Mail Gateway Documentation](https://pmg.proxmox.com/pmg-docs/)
- [Postfix on Arch Linux](https://wiki.archlinux.org/title/Postfix)
- [SpamAssassin Wiki](https://wiki.apache.org/spamassassin/)
- [ClamAV Documentation](https://docs.clamav.net/)
