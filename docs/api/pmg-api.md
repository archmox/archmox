# PMG API Reference Overview

## Introduction

The Proxmox Mail Gateway (PMG) API provides a RESTful interface for managing mail filtering rules, quarantine, user administration, system configuration, and monitoring. The API shares the same foundation as the PVE API (Perl-based, `api2/json` format) and is accessible via HTTPS on port 8006.

This document covers the PMG-specific API endpoints and usage patterns.

## API Structure

### Base URL

```
https://<pmg-host>:8006/api2/json/
```

### API Path Hierarchy

```
/api2/json/
  ├── access/                 # User authentication
  ├── admin/                  # System administration
  ├── cluster/                # Cluster configuration
  ├── config/                 # PMG-specific configuration
  │   ├── rule/               # Content filtering rules
  │   ├── spam/               # SpamAssassin settings
  │   ├── virus/              # ClamAV configuration
  │   ├── transport/          # SMTP transport rules
  │   ├── mailproxy/          # SMTP proxy settings
  │   ├── ldap/               # LDAP configuration
  │   └── dkim/               # DKIM settings
  ├── nodes/                  # Node-level operations
  ├── quarantine/             # Quarantine management
  ├── statistics/             # Mail flow statistics
  └── version/                # Version information
```

## Authentication

PMG uses the same authentication system as PVE:

### API Token Authentication

```bash
# Create API token via CLI
pmgum user token add root@pam automation --privsep 0
```

```bash
curl -H "Authorization: PVEAPIToken=root@pam!automation=<token>" \
  https://pmg1:8006/api2/json/config/rule
```

### Ticket Authentication

```bash
curl -k -d "username=root@pam&password=<password>" \
  https://pmg1:8006/api2/json/access/ticket

# Use the returned ticket as a cookie
```

## Common Endpoints

### Rule Management (Content Filtering)

```bash
# List all rules
GET /api2/json/config/rules

# Get rule details
GET /api2/json/config/rules/<rule-id>

# Create a new rule
POST /api2/json/config/rules
  --data-binary '{
    "id": "100",
    "direction": "inbound",
    "priority": 10,
    "active": 1,
    "who": [
      {"type": "sender", "field": "from", "value": "*@example.com"}
    ],
    "what": [
      {"type": "spam", "action": "Quarantine"}
    ]
  }'

# Update a rule
PUT /api2/json/config/rules/<rule-id>
  --data "priority=5"
  --data "active=0"

# Delete a rule
DELETE /api2/json/config/rules/<rule-id>

# Reorder rules
POST /api2/json/config/rules/reorder
  --data-binary '{"order": ["100", "101", "102", "103"]}'
```

### Rule Object Types

```json
{
  "who": {
    "from":     "Match sender address",
    "to":       "Match recipient address",
    "from_domain": "Match sender domain",
    "to_domain":   "Match recipient domain",
    "ip":       "Match connecting IP address"
  },
  "what": {
    "spam":      "Spam score threshold",
    "virus":     "Virus detected",
    "attachment": "Attachment filename pattern",
    "size":      "Message size threshold",
    "header":    "Custom header regex",
    "body":      "Body content regex",
    "protocol":  "SMTP protocol check"
  },
  "action": {
    "Accept":    "Deliver normally",
    "Reject":    "Reject message",
    "Quarantine": "Quarantine message",
    "Mark":      "Add subject prefix spam flag",
    "Forward":   "Forward to specific address",
    "Notify":    "Send notification to admin"
  }
}
```

### Spam Configuration

```bash
# Get spam settings
GET /api2/json/config/spam

# Update SpamAssassin settings
PUT /api2/json/config/spam
  --data "spam_level=4.0"
  --data "spam_level_quar=8.0"
  --data "auto_learn=1"
  --data "rewrite_subject=1"
  --data "subject_tag=[SPAM]"

# Trigger sa-update
POST /api2/json/config/spam/update

# Train spam (report false positive/negative)
POST /api2/json/nodes/<node>/spam/learn
  --data "report=<email-file>"
  --data "learning=spam"

# Get bayes statistics
GET /api2/json/config/spam/bayes
```

### Virus Configuration

```bash
# Get ClamAV settings
GET /api2/json/config/virus

# Update virus scanner config
PUT /api2/json/config/virus
  --data "enable=1"
  --data "action=Quarantine"
  --data "max_size=25000000"

# Check ClamAV status
GET /api2/json/nodes/<node>/virus/status

# Trigger freshclam update
POST /api2/json/nodes/<node>/virus/update
```

### Quarantine Management

```bash
# List all quarantined messages (admin view)
GET /api2/json/quarantine/list
  --data "start=0"
  --data "limit=50"

# List quarantined messages for a user
GET /api2/json/quarantine/list-user
  --data "email=user@example.com"
  --data "start=0"
  --data "limit=50"

# Get quarantine message details
GET /api2/json/quarantine/message/<id>

# Release a quarantined message
POST /api2/json/quarantine/release
  --data "id=<message-id>"

# Delete a quarantined message
DELETE /api2/json/quarantine/<id>

# Report not-spam (train SpamAssassin)
POST /api2/json/quarantine/report-not-spam
  --data "id=<message-id>"

# List whitelist/blacklist
GET /api2/json/quarantine/whitelist
GET /api2/json/quarantine/blacklist

# Add to whitelist
POST /api2/json/quarantine/whitelist
  --data "email=trusted@example.com"

# Add to blacklist
POST /api2/json/quarantine/blacklist
  --data "email=spammer@example.com"

# User quarantine digest preferences
GET /api2/json/quarantine/digest-config
PUT /api2/json/quarantine/digest-config
  --data "interval=daily"
  --data "format=html"
```

### Mail Proxy Configuration

```bash
# Get SMTP proxy settings
GET /api2/json/config/mailproxy

# Update proxy config
PUT /api2/json/config/mailproxy
  --data "default_relay=<internal-mta>:25"
  --data "max_connections=200"
  --data "max_recipients=50"
  --data "max_message_size=50M"
  --data "greylisting=1"
  --data "greylist_timeout=300"

# Get transport configuration
GET /api2/json/config/transport

# Add transport rule
POST /api2/json/config/transport
  --data "domain=example.com"
  --data "relay=[mail.example.com]:25"
  --data "priority=10"
```

### DKIM Configuration

```bash
# List DKIM domains
GET /api2/json/config/dkim

# Add DKIM domain
POST /api2/json/config/dkim
  --data "domain=example.com"
  --data "selector=mail"
  --data "key_length=2048"

# Regenerate DKIM key
POST /api2/json/config/dkim/<domain>/regenerate

# Get DKIM public key (for DNS record)
GET /api2/json/config/dkim/<domain>/public-key

# DKIM verification results
GET /api2/json/statistics/dkim
```

### TLS Configuration

```bash
# Get TLS settings
GET /api2/json/config/tls

# Update TLS
PUT /api2/json/config/tls
  --data "tls_enable=1"
  --data "tls_cert_file=/etc/pmg/tls/server.crt"
  --data "tls_key_file=/etc/pmg/tls/server.key"

# Upload TLS certificate
POST /api2/json/nodes/<node>/cert/upload
  --data-urlencode "certificates@/path/to/fullchain.pem"
  --data-urlencode "key@/path/to/privkey.pem"
```

### LDAP Configuration

```bash
# List LDAP servers
GET /api2/json/config/ldap

# Add LDAP server
POST /api2/json/config/ldap
  --data-binary '{
    "id": "company-ldap",
    "server": "ldap.example.com",
    "port": 636,
    "protocol": "ldaps",
    "base_dn": "dc=example,dc=com",
    "bind_dn": "cn=admin,dc=example,dc=com"
  }'

# Test LDAP connection
POST /api2/json/config/ldap/<id>/test
  --data "username=testuser"
  --data "password=testpass"
```

### Statistics

```bash
# Mail flow statistics overview
GET /api2/json/statistics/mail

# Get detailed mail statistics
GET /api2/json/statistics/mail/detail
  --data "timespan=day"
  --data "start=<unix-timestamp>"
  --data "end=<unix-timestamp>"

# Spam statistics
GET /api2/json/statistics/spam

# Virus statistics
GET /api2/json/statistics/virus

# Top senders/recipients
GET /api2/json/statistics/top-senders
GET /api2/json/statistics/top-recipients
```

### Node Management

```bash
# Node status
GET /api2/json/nodes/<node>/status

# System logs
GET /api2/json/nodes/<node>/syslog
  --data "start=<unix-timestamp>"
  --data "limit=100"

# Service management
GET /api2/json/nodes/<node>/services
POST /api2/json/nodes/<node>/services/<service>/start
POST /api2/json/nodes/<node>/services/<service>/stop
POST /api2/json/nodes/<node>/services/<service>/restart

# Restart PMG services
POST /api2/json/nodes/<node>/pmgproxy/restart
POST /api2/json/nodes/<node>/pmg-smtp-filter/restart
```

### Blacklist/Whitelist Management

```bash
# Global blacklist
GET /api2/json/config/blacklist

# Add to blacklist
POST /api2/json/config/blacklist
  --data "address=spammer@example.com"
  --data "comment=Known spam source"

# Global whitelist
GET /api2/json/config/whitelist

# Remove from blacklist/whitelist
DELETE /api2/json/config/blacklist/<id>
```

### User and Permission Management

```bash
# List PMG administrators
GET /api2/json/access/users

# Create administrator
POST /api2/json/access/users
  --data "userid=admin@pmg"
  --data "password=secure"
  --data "enable=1"

# Create administrator (spam quarantine admin)
POST /api2/json/access/users
  --data "userid=quarantine-admin@pmg"
  --data "password=secure"
  --data "enable=1"
```

## Backup and Restore Configuration

```bash
# Backup PMG configuration
POST /api2/json/admin/backup
# Returns a download stream of the config archive

# Restore PMG configuration
POST /api2/json/admin/restore
  --data-urlencode "file@/path/to/pmg-backup.tar"
```

## Error Handling

Standard HTTP status codes are used:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Internal server error |

Error response:
```json
{
  "errors": {"field_name": "validation error message"}
}
```

## Best Practices

1. **Always test rules in simulation mode** before activating
2. **Monitor quarantine size** daily to prevent storage exhaustion
3. **Configure digest emails** to reduce user notification fatigue
4. **Use LDAP sync** for user management in enterprise environments
5. **Set up outbound filtering** to detect compromised accounts sending spam
6. **Regularly examine DANE/TLS reports** to ensure mail delivery reliability
7. **Keep SpamAssassin and ClamAV updated** via cron or periodic API calls

## References

- [Proxmox Mail Gateway Admin Guide](https://pmg.proxmox.com/pmg-docs/pmg-admin-guide.html)
- [Proxmox Mail Gateway API Viewer](https://pmg.proxmox.com/pmg-docs/api-viewer/)
- [SpamAssassin Configuration](https://spamassassin.apache.org/full/3.4.x/doc/Mail_SpamAssassin_Conf.html)
- [ClamAV Documentation](https://docs.clamav.net/)
- [Archmox PMG PKGBUILD](https://github.com/archmox/archmox/blob/main/packages/pmg/pmg-api/PKGBUILD)
