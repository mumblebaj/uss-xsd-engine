# Streaming Benchmarks

This folder contains fixtures and scripts for Phase 4.3 streaming validation benchmarking.

## Generate Fixtures

```bash
npm run fixtures:streaming
```

This creates:
- `benchmarks/fixtures/large-valid-small.xml`
- `benchmarks/fixtures/large-valid.xml`
- `benchmarks/fixtures/large-invalid.xml`

Generate a target-sized profile (100MB preset):

```bash
npm run fixtures:streaming:target100
```

This additionally creates:
- `benchmarks/fixtures/large-valid-target.xml`
- `benchmarks/fixtures/large-invalid-target.xml`

## Run Benchmark

```bash
npm run benchmark:streaming
```

Run with threshold checks (non-zero exit code on failure):

```bash
npm run benchmark:streaming -- \
  --xml benchmarks/fixtures/large-valid-small.xml \
  --min-throughput-mbps 3 \
  --max-peak-rss-mb 200
```

Target preset (expects 100MB target fixture):

```bash
npm run benchmark:streaming:target
```

Optional flags:

```bash
node scripts/benchmark-streaming.mjs \
  --xml benchmarks/fixtures/large-valid-small.xml \
  --concurrency 2 \
  --max-buffer-bytes 1048576
```

## Notes

- These benchmarks report throughput and peak RSS memory usage.
- `maxBufferBytes` allows evaluating memory-bounded parser behavior.
- Use the invalid fixture to evaluate diagnostics-heavy scenarios.
- Threshold checks are available via:
  - `--min-throughput-mbps`
  - `--max-peak-rss-mb`
  - `--min-parallel-throughput-mbps`
  - `--allow-errors` (skip `ok===true` requirement)
