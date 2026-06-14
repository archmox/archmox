# PBS API Reference Overview

## Introduction

The Proxmox Backup Server (PBS) provides a RESTful API for managing backup datastores, jobs, snapshots, verification, and remote sync operations. The API is implemented in Rust (using the `proxmox-router` crate) and is accessed via HTTPS on port 8007.

This document provides an overview of the PBS API, authentication methods, and commonly used endpoints.

## API Structure

### Base URL

```
https://<pbs-host>:8007/api2/json/
```

### API Path Hierarchy

```
/api2/json/
  ├── access/                 # User authentication and tokens
  ├── admin/                  # Datastore administration
  │   └── datastore/
  │       ├── <name>/         # Individual datastore operations
  │       └── ...
  ├── config/                 # Server configuration
  │   ├── datastore/          # Datastore definitions
  │   ├── remote/             # Remote PBS instances
  │   ├── verify/             # Verify jobs
  │   ├── prune/              # Prune jobs
  │   ├── garbage-collection/ # GC jobs
  │   └── sync/               # Sync jobs
  ├── nodes/                  # Node-level status
  └── version/                # Version information
```

## Authentication

### API Token Authentication

```bash
# Create an API token
proxmox-backup-manager user create-token root@pam \
  my-token --privsep false

# Response:
# Token: root@pam!my-token = <secret-key>
```

Use in requests:

```bash
curl -H "Authorization: PBEAPIToken root@pam!my-token=<secret>" \
  https://pbs1:8007/api2/json/admin/datastore
```

### Ticket Authentication

```bash
# Obtain a ticket
curl -k -d "username=root@pam&password=<password>" \
  https://pbs1:8007/api2/json/access/ticket

# Use the ticket cookie
curl -k -b "PBSAuthCookie=<ticket>" \
  https://pbs1:8007/api2/json/version
```

## Common Endpoints

### Datastore Management

```bash
# List all datastores
GET /api2/json/admin/datastore

# Get datastore status (usage, chunk count)
GET /api2/json/admin/datastore/<name>/status

# Get datastore statistics
GET /api2/json/admin/datastore/<name>/statistics

# List all backup groups in a datastore
GET /api2/json/admin/datastore/<name>/.pmx-backup-ns/backup-list

# List snapshots in a backup group
GET /api2/json/admin/datastore/<name>/<backup-id>/snapshots

# Get snapshot information
GET /api2/json/admin/datastore/<name>/.pmx-backup-ns/<backup-id>/<snapshot-id>
```

### Backup Operations

```bash
# Start a new backup (from PVE side)
POST /api2/json/admin/datastore/<name>/<backup-id>/snapshot
  --data "backup-time=<unix-timestamp>"

# Upload backup data (chunked)
POST /api2/json/upload-chunk?id=<chunk-id> --data-binary @chunk.bin

# Close backup (finalize)
POST /api2/json/admin/datastore/<name>/<backup-id>/<snapshot-id>/close

# Restore a backup
POST /api2/json/admin/datastore/<name>/.pmx-backup-ns/<backup-id>/<snapshot-id>/download
  --data "archive=pxar/<filename>.pxar"

# List backup files
GET /api2/json/admin/datastore/<name>/.pmx-backup-ns/<backup-id>/<snapshot-id>/files
```

### Backup Job Management

```bash
# List backup jobs
GET /api2/json/config/jobs

# Create a backup job
POST /api2/json/config/jobs
  --data-binary '{
    "id": "vm-daily",
    "type": "backup",
    "store": "main",
    "ns": "/vms",
    "schedule": "daily 02:00",
    "notify": "always"
  }'

# Run a job immediately
POST /api2/json/config/jobs/<id>/run

# Delete a job
DELETE /api2/json/config/jobs/<id>
```

### Verifying Jobs

```bash
# List verify jobs
GET /api2/json/config/verify

# Create a verify job
POST /api2/json/config/verify
  --data "id=weekly-verify"
  --data "datastore=main"
  --data "schedule=weekly sun 03:00"

# Manual verify
POST /api2/json/admin/datastore/<name>/verify
  --data "backup-id=<backup-id>"
  --data "backup-time=<timestamp>"

# Get verify results
GET /api2/json/admin/datastore/<name>/verify
```

### Prune Jobs

```bash
# List prune jobs
GET /api2/json/config/prune

# Create a prune job
POST /api2/json/config/prune
  --data "id=monthly-prune"
  --data "datastore=main"
  --data "schedule=daily"
  --data "keep-last=7"
  --data "keep-daily=30"
  --data "keep-weekly=8"

# Manual prune
POST /api2/json/admin/datastore/<name>/prune
  --data "backup-id=<backup-id>"
  --data "keep-last=7"

# Simulate prune (dry-run)
POST /api2/json/admin/datastore/<name>/prune
  --data "backup-id=<backup-id>"
  --data "dry-run=1"
```

### Garbage Collection

```bash
# Start garbage collection
POST /api2/json/admin/datastore/<name>/garbage-collection/start

# Get GC status
GET /api2/json/admin/datastore/<name>/garbage-collection/status

# List GC jobs
GET /api2/json/config/garbage-collection

# Create a GC schedule
POST /api2/json/config/garbage-collection
  --data "id=weekly-gc"
  --data "datastore=main"
  --data "schedule=sun 04:00"
```

### Remote Sync

```bash
# List remote PBS instances
GET /api2/json/config/remote

# Create a remote
POST /api2/json/config/remote
  --data-binary '{
    "name": "offsite",
    "host": "pbs-offsite.example.com",
    "port": 8007,
    "fingerprint": "xx:xx:xx:xx:..."
  }'

# List sync jobs
GET /api2/json/config/sync

# Create sync job
POST /api2/json/config/sync
  --data "id=offsite-sync"
  --data "remote=offsite"
  --data "remote-datastore=backup"
  --data "local-datastore=main"
  --data "schedule=daily 05:00"

# Run sync
POST /api2/json/config/sync/<id>/run
```

### Tapes

```bash
# List tape drives
GET /api2/json/admin/tape/drive

# List tape media pools
GET /api2/json/admin/tape/media-pool

# Create a backup to tape
POST /api2/json/admin/tape/backup
  --data "pool=monthly-archive"

# Restore from tape
POST /api2/json/admin/tape/restore
  --data "media-set-label=SET-2026-06"
```

### User and Access Management

```bash
# List users
GET /api2/json/access/users

# Create user
POST /api2/json/access/users
  --data "userid=admin@pbs"
  --data "password=secure"

# List API tokens
GET /api2/json/access/users/<userid>/token

# Create API token
POST /api2/json/access/users/<userid>/token
  --data "tokenid=automation"
  --data "privsep=false"

# List permissions
GET /api2/json/access/acl

# Set permissions (ACL)
PUT /api2/json/access/acl
  --data "path=/datastore/main"
  --data "userid=admin@pbs"
  --data "role=DatastoreAdmin"
```

### Node Status

```bash
# Node status
GET /api2/json/nodes/<hostname>/status

# System information
GET /api2/json/nodes/<hostname>/apt/versions

# List services
GET /api2/json/nodes/<hostname>/services

# Get task log
GET /api2/json/nodes/<hostname>/tasks/<upid>/log
```

### Chunk and Catalog Operations

```bash
# Get chunk information
HEAD /api2/json/admin/datastore/<name>/chunk/<chunk-hash>

# Download catalog (file listing for a snapshot)
GET /api2/json/admin/datastore/<name>/catalog/<backup-id>/<snapshot-id>/download
```

## Backup Client API

The backup client communicates with the PBS server using a lower-level protocol:

```bash
# Initialize connection
POST /api2/json/upload-chunk

# Register a backup
POST /api2/json/admin/datastore/<name>/<backup-id>/snapshot
  --data-binary '{
    "backup-time": "<unix-timestamp>",
    "backup-type": "vm",
    "backup-id": "100"
  }'

# Upload data chunks
POST /api2/json/upload-chunk?id=<chunk-digest>
  --data-binary @<data-chunk>

# Finish backup
POST /api2/json/admin/datastore/<name>/<backup-id>/<snapshot-id>/close
```

## Streaming Endpoints

PBS supports streaming for large data transfers:

```bash
# Stream download (proxied, supports partial content)
GET /api2/json/admin/datastore/<name>/<ns>/<backup-id>/<snapshot-id>/download
  --data "archive-type=index"
  --data "archive-name=pxar/<filename>.pxar"

# Stream upload
POST /api2/json/admin/datastore/<name>/<ns>/<backup-id>/<snapshot-id>/upload
  --data-binary @<data>
```

## API Version

```bash
# Get API version
GET /api2/json/version
# Response: {"data": {"version": "4.0.0", "release": "1", "repoid": "..."}}
```

## Error Handling

PBS API uses standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Internal server error |

Error response format:
```json
{
  "errors": {
    "field": "error message"
  }
}
```

## Best Practices

1. **Use API tokens** with minimal required permissions (principle of least privilege)
2. **Chunk large uploads** at 4MB boundaries for optimal performance
3. **Monitor GC status** after deletion-heavy operations
4. **Set up verify schedules** to catch corruption early
5. **Use remote sync** for off-site disaster recovery
6. **Test restores regularly** — a backup that can't be restored is worthless

## References

- [Proxmox Backup Server API Viewer](https://pbs.proxmox.com/docs/api-viewer/)
- [Proxmox Backup Server Documentation](https://pbs.proxmox.com/docs/)
- [PBS Rust Implementation](https://git.proxmox.com/?p=proxmox-backup.git)
- [Archmox PBS PKGBUILD](https://github.com/archmox/archmox/blob/main/packages/pbs/proxmox-backup/PKGBUILD)
