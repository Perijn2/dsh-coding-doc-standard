# Verification: language-pack-architecture

## Evidence

### Phase 1 — engine, codec, providers, Lua pilot (2026-10-31)

- `npm test`: 150 cases, 150 pass, 0 fail (135 pre-existing plus 15 new engine cases in `tests/engine.test.mjs`).
- `npx biome check src tests languages`: clean.
- `npm run verify` and `node scripts/install/verify-install.mjs`: bundle assets complete.
- `repo_conform doctor`: feature catalog validated, hook chain healthy.

Engine test coverage mapped to the test plan:

- PK-01/02/03/04 partial: `tests/engine.test.mjs` "loads the lua pilot pack", "excludes broken packs with a reason".
- CD-01/02/03/04/05: "skips the declared preamble", "decodes declared field spellings", "unit doc decoding extracts summary and sections".
- DC-01/02/03/04/05: "missing required header fields", "a multi-sentence brief summary passes", "usage must reference a discovered unit".
- UD-01/02/05 partial: "tree-sitter provider discovers lua functions", "regex provider discovers units", "an unavailable provider surfaces a typed skip".
- VP-02/03/04/05 partial: "profile resolution prefers pins over detection over defaults".
- FA-05: "a pack without a formatter runs no formatting pass".
- CD-07 partial: "a documented lua candidate passes the gate", "an undocumented lua candidate is denied through its pack" (pack covers the path; legacy checker and tree-sitter passes are skipped for covered languages).

### Incident recorded

The first `but commit` hung: the hook installer preserved the previous
gitbutler-commit-standard dispatcher as `commit-msg-user`, but that dispatcher
chains to `commit-msg-user` itself, so the managed hook's chain recursed
infinitely (1,256 orphaned bash processes). Fixed by removing the
self-referential chain block from the preserved hook. The installer should
sanitize this pattern when preserving foreign hooks.
