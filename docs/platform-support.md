# Platform Support

Author: Perijn Huijser

## Supported baseline

The package, documentation checker, and npm-pinned Biome/Prettier formatter
profiles support every platform that can run Node 20 and Python 3. Ruff is
provisioned into DSH-owned data on the current platform.

## Native Doxygen

Pinned native Doxygen `1.18.0` is currently supported on **Windows x64** only.
Its official archive is SHA-256 verified before extraction. On other platforms,
`npm run provision-tools` completes the supported formatter setup and reports
that native Doxygen is unavailable; `verify --doxygen` then reports the missing
native tool clearly.

Adding Linux and macOS support requires adding the official release asset URL and
verified SHA-256 for each architecture to `src/policy/tools.json`, plus an
archive-extraction implementation appropriate to that platform.
