# Migration from the Legacy Skill

Author: Perijn Huijser

1. Install this package through its declared bundle patch.
2. Do not add a manual loader row to a profile patch.
3. Copy the skill through `scripts/install.mjs`.
4. Remove legacy Bash diagnostics, bundled formatter binaries, environment scans,
   duplicate policy defaults, and profile-patch installer logic.
5. Enable detailed formatter, linter, and Compose verification in CI after the
   write-hook behavior is proven with fixtures.
