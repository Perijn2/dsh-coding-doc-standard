# Platform Support

Author: Perijn Huijser

## Supported baseline

The package, documentation checker, and npm-pinned Biome/Prettier formatter
profiles support every platform that can run Node 20 and Python 3. Ruff is
provisioned into DSH-owned data on the current platform.

## Native Doxygen

Pinned native Doxygen `1.18.0` resolves per host from `src/policy/tools.json`.
Each entry pins the official release archive, its SHA-256 digest, the path of the
executable inside that archive, and the managed executable name:

| Host | Official archive | Managed executable |
| --- | --- | --- |
| Windows x64 | `doxygen-1.18.0.windows.x64.bin.zip` | `doxygen.exe` |
| Linux x64 (glibc) | `doxygen-1.18.0.linux.bin.tar.gz` | `doxygen` |
| macOS Apple silicon | `doxygen-1.18.0-mac-arm.zip` | `doxygen` |
| macOS Intel | `doxygen-1.18.0-mac-intel.zip` | `doxygen` |

`npm run provision-tools` selects the asset for `process.platform` /
`process.arch`, streams it into a staging directory while verifying the digest,
extracts it with the platform-native archiver (`Expand-Archive` on Windows, `tar`
elsewhere), copies the executable into
`~/.dsh/plugins/coding-doc-standard/tools/doxygen-1.18.0/`, marks it executable
on Unix hosts, and confirms `doxygen --version` reports the pinned version.

`scripts/verify.mjs` and the tests resolve the same path through
`src/policy/platform.mjs`, so provisioning and verification cannot disagree about
which binary is installed.

### Unsupported hosts

The official 1.18.0 release publishes no Linux arm64 and no musl/Alpine build;
the Linux archive is a glibc ELF binary (`/lib64/ld-linux-x86-64.so.2`). On a
host with no pinned asset, `npm run provision-tools` warns and still completes the
formatter setup, and `verify --doxygen` fails closed with the supported host list
instead of running an unverified binary.

### Adding a platform

Add the official release asset URL, its SHA-256 digest, the in-archive executable
path, and the managed executable name under
`doxygen.assets["<platform>-<arch>"]` in `src/policy/tools.json`. No code change
is needed when `extractArchive` already handles the archive format.
