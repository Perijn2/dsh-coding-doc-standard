# Manual documentation probes

These files preserve manual write-gate experiments. They are validation inputs,
not a supported application or a set of golden examples. Some deliberately use
nonconforming names or incomplete documentation; the Compose image is illustrative
and is not provisioned by this repository.

Use `node scripts/dev/pack-probe.mjs <logical-path> <content-file>` to inspect pack
findings. The maintained, automatically checked examples live in each language
pack's `skill` directory. The root `doc_standard_probe.py` is a separate manual
Python documentation and retry demo.
