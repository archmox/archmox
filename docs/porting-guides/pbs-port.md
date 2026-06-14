# PBS Porting Guide: Debian to Arch Linux PKGBUILDs

## Overview

The Proxmox Backup Server (PBS) is a modern, Rust-based backup solution featuring content-addressable storage, inline deduplication, client-side encryption, and incremental backup support. Unlike PVE which is predominantly Perl, PBS is primarily written in Rust with a smaller Perl component for the API and web interface layer.

This guide documents the process of porting PBS from Debian `.deb` packages to Arch Linux PKGBUILDs, covering the Rust build pipeline, PostgreSQL integration, the pxar archive format, and the FUSE mount layer.

## Package Architecture

PBS consists of the following packages:

| PKGBUILD | Type | Language | Purpose |
|----------|------|----------|---------|
| `proxmox-rs` | Core | Rust | Shared Rust library (toolkit, API macros, HTTP types) |
| `pxar` | Core | Rust | High-performance archive format implementation |
| `proxmox-fuse-rs` | Core | Rust | FUSE filesystem for mounting backup snapshots |
| `proxmox-backup` | Main | Rust/Perl | Server daemon, CLI tools, web UI |
| `proxmox-backup-qemu` | Plugin | Rust | QEMU integration for live VM backup |

### Shared Dependencies

All PBS packages depend on `proxmox-rs`, which provides the foundational Rust types and utilities used across the entire Proxmox ecosystem. The `proxmox-rs` crate is a workspace of multiple sub-crates:

```
proxmox-rs/
  ├── proxmox-auth-api       # Authentication API types
  ├── proxmox-compression    # Compression utilities (zstd, lz4)
  ├── proxmox-crypt          # Encryption primitives
  ├── proxmox-http           # HTTP client/server types
  ├── proxmox-io             # I/O utilities
  ├── proxmox-lang           # Language-level utilities
  ├── proxmox-rest-server    # REST server framework
  ├── proxmox-router         # API routing macros
  ├── proxmox-schema         # API schema generation
  ├── proxmox-section-config # Configuration file parsing
  ├── proxmox-sys            # System utilities
  ├── proxmox-tape           # Tape backup support
  └── proxmox-time           # Time-related utilities
```

## Rust Build Pipeline

### Cargo Workspace Structure

The PBS source tree is organized as a Cargo workspace. The `proxmox-backup` crate (`packages/pbs/proxmox-backup/`) contains:

```
proxmox-backup/
  ├── Cargo.toml          # Workspace and crate definitions
  ├── Cargo.lock          # Locked dependency versions
  ├── src/
  │   ├── bin/
  │   │   ├── proxmox-backup-server.rs   # Main server binary
  │   │   ├── proxmox-backup-client.rs   # CLI client
  │   │   ├── proxmox-backup-manager.rs  # Management tool
  │   │   └── proxmox-tape.rs           # Tape management
  │   ├── server/         # Server implementation
  │   ├── client/         # Client implementation
  │   ├── api2/           # REST API endpoints (v2)
  │   ├── backup/         # Backup/chunking engine
  │   ├── tools/          # CLI tool implementations
  │   └── config/         # Configuration parsing
  ├── perl/               # Perl bindings for the API
  ├── www/                # Web UI (JavaScript/ExtJS)
  └── debian/             # Original Debian packaging (reference)
```

### PKGBUILD Build Function

The standard build procedure for PBS Rust packages:

```bash
build() {
  cd "${srcdir}/archmox-${pkgver}/packages/pbs/proxmox-backup"
  cargo build --release --frozen
}

check() {
  cd "${srcdir}/archmox-${pkgver}/packages/pbs/proxmox-backup"
  cargo test --release --frozen
}

package() {
  cd "${srcdir}/archmox-${pkgver}/packages/pbs/proxmox-backup"
  cargo install --root="${pkgdir}/usr" --frozen
  # Install Perl modules
  make DESTDIR="${pkgdir}" install-perl
  # Install web assets
  make DESTDIR="${pkgdir}" install-www
  # Install systemd services
  install -Dm644 debian/proxmox-backup.service \
    "${pkgdir}/usr/lib/systemd/system/proxmox-backup.service"
  install -Dm644 LICENSE "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
}
```

The `--frozen` flag ensures the build uses the exact dependency versions from `Cargo.lock`, which is critical for reproducibility.

### Rust Dependency Vendoring

Proxmox packages often depend on crates that are not on crates.io (internal crates, or patched versions). These are vendored in a `vendor/` directory or fetched from Proxmox's Git repositories. The PKGBUILD must handle this by:

1. Adding all Git dependencies as `source=()` entries
2. Using a vendoring script to populate the `.cargo/config.toml`
3. Or using `cargo` with the `--frozen` flag and a bundled vendor directory

For Archmox, the preferred approach is to bundle all dependencies in the source tarball and use `--frozen`.

## pxar Archive Format

`pxar` (Proxmox Archive) is a high-performance archive format designed specifically for VM backup workloads. Key characteristics:

- **Sparse file support**: Efficiently handles sparse files by storing hole metadata
- **Extended attributes**: Preserves POSIX ACLs, SELinux contexts, and user xattrs
- **Metadata-first**: Directories and metadata are stored first, allowing instant navigation
- **Chunked**: Large archives are divided into fixed-size chunks for deduplication
- **FUSE mountable**: Backups can be mounted as a filesystem for file-level restore

The `pxar` crate (`packages/pbs/pxar/`) provides:
- `pxar` — Core archive format library
- `proxmox-backup-qemu` — QEMU integration using pxar for live backup
- CLI tools for creating, extracting, and mounting pxar archives

### PKGBUILD for pxar

```bash
pkgname=archmox-pxar
depends=('archmox-proxmox-rs' 'glibc' 'gcc-libs' 'zstd' 'lz4' 'libsodium')
makedepends=('rust' 'cargo' 'pkg-config' 'cmake')

build() {
  cd "${srcdir}/archmox-${pkgver}/packages/pbs/pxar"
  cargo build --release --frozen
}
```

## PostgreSQL Integration

PBS uses PostgreSQL as its metadata database, storing:

- **Backup groups**: Logical groupings of backups (e.g., a VM or CT)
- **Snapshots**: Individual backup point-in-time snapshots
- **Chunk metadata**: Mapping of cryptographic hashes to chunk locations
- **Verification state**: Results of integrity verification jobs
- **Prune state**: Retention policy tracking
- **User and permission data**: Access control configuration

The database schema is managed via SQL migration files in `proxmox-backup/src/server/schema/`. On Arch Linux:

1. Install `postgresql` and `postgresql-libs` from the standard repos
2. Initialize the database with `initdb -D /var/lib/postgresql/data`
3. Start and enable PostgreSQL: `systemctl enable --now postgresql`
4. Create the PBS database user and database:
   ```sql
   CREATE USER proxmox WITH PASSWORD 'proxmox';
   CREATE DATABASE proxmox-backup OWNER proxmox;
   ```

PBS connects to PostgreSQL via `libpq` (Rust's `postgres` crate or C `libpq` bindings).

## FUSE Snapshot Mounting

`proxmox-fuse-rs` provides a FUSE filesystem that allows browsing backup snapshots without restoring them:

```
mount point: /mnt/backup/<datastore>/<backup-id>/
contents:
  ├── <snapshot-id>/
  │   ├── catalog         # Binary catalog file (directory structure)
  │   ├── index.json      # Metadata as JSON
  │   ├── pxar-<index>.did # Dynamic index files
  │   └── pxar-<index>.fidx # Fixed index files
  └── ...
```

The FUSE implementation reads chunk indices and dynamically reconstructs file contents. This requires `libfuse3` and the `fuse3` package on Arch Linux.

## Web UI Build

The PBS web interface is a JavaScript/ExtJS application in `www/`. It uses the same build pipeline as PVE:

1. ExtJS framework from `proxmox-widget-toolkit`
2. PBS-specific views and controllers
3. Compiled with Sencha CMD or a simplified make-based build

For Archmox, the Sencha CMD dependency is replaced with a direct JavaScript bundling approach:
- Copy `www/` files directly to `/usr/share/proxmox-backup/www/`
- Serve static files via the built-in Rust HTTP server (no nginx required)

## File System Layout

PBS files are installed to:

```
/usr/bin/
  ├── proxmox-backup-server    # Main daemon
  ├── proxmox-backup-client    # CLI client (used by PVE for backups)
  ├── proxmox-backup-manager   # Node management CLI
  └── proxmox-tape             # Tape management
/usr/lib/
  └── proxmox-backup/          # Internal libraries and plugins
/usr/share/
  ├── proxmox-backup/
  │   ├── www/                 # Web UI
  │   └── i18n/                # Translations
  └── perl5/
      └── vendor_perl/
          └── Proxmox/
              └── Backup/      # Perl API modules
/etc/proxmox-backup/
  └── backup-server.toml       # Main configuration
/var/lib/proxmox-backup/       # Default datastore path
/usr/lib/systemd/system/
  └── proxmox-backup.service   # Systemd service
```

## Backup Datastore Structure

Datastores are the storage pools that hold backup data. Each datastore has:

```
/<datastore-path>/
  ├── .chunks/                 # Content-addressable chunk storage
  │   ├── aa/                  # First two hex chars of hash
  │   │   └── <full-hex-hash>  # Compressed, optionally encrypted chunk
  │   └── ...
  ├── .locks/                  # Lock files for concurrent access
  ├── .gc-tmp/                 # Garbage collection temporary directory
  └── <backup-type>/           # e.g., vm, ct, host
      └── <backup-id>/         # e.g., 100, myhost
          ├── <snapshot-id>/   # e.g., 2026-06-13T00:00:00Z
          │   ├── catalog.pcat # File catalog
          │   ├── index.json   # Snapshot metadata
          │   └── ...          # Index files referencing chunks
          └── ...
```

## Verification

After porting, verify the PBS installation:

1. Start PostgreSQL and create the database
2. Run `proxmox-backup-manager datastore create <name> <path>`
3. Start the backup server: `systemctl start proxmox-backup`
4. Access the web UI at `https://<hostname>:8007/`
5. Create a backup job and verify completion
6. Test file-level restore via FUSE mount: `proxmox-backup-client mount ...`
7. Run `proxmox-backup-manager verify --datastore <name>`

## References

- [Proxmox Backup Server Documentation](https://pbs.proxmox.com/docs/)
- [Proxmox Backup Server Git Repository](https://git.proxmox.com/?p=proxmox-backup.git)
- [pxar Archive Format Specification](https://git.proxmox.com/?p=pxar.git)
- [Rust PKGBUILD Guidelines](https://wiki.archlinux.org/title/Rust_package_guidelines)
