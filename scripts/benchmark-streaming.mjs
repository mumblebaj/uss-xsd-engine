import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser as XmldomDOMParser } from "@xmldom/xmldom";
import {
  validateXmlStream,
  validateXmlStreams,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const fixturesDir = path.join(rootDir, "benchmarks", "fixtures");

function ensureQuerySelector(doc) {
  if (!doc || typeof doc !== "object") return;
  if (typeof doc.querySelector === "function") return;

  Object.defineProperty(doc, "querySelector", {
    value(selector) {
      if (selector === "parsererror") {
        const nodes = this.getElementsByTagName?.("parsererror") || [];
        return nodes[0] || null;
      }

      const nodes = this.getElementsByTagName?.(selector) || [];
      return nodes[0] || null;
    },
  });
}

function normalizeChildrenTree(node) {
  if (!node || typeof node !== "object") return;

  if (!Object.prototype.hasOwnProperty.call(node, "children")) {
    try {
      Object.defineProperty(node, "children", {
        get() {
          return Array.from(this.childNodes || []).filter((child) => child.nodeType === 1);
        },
      });
    }
    catch {
      // Ignore nodes where properties cannot be defined.
    }
  }

  for (const child of Array.from(node.childNodes || [])) {
    normalizeChildrenTree(child);
  }
}

function installDomParserPolyfill() {
  globalThis.DOMParser = class DOMParserWithCompat {
    parseFromString(text, mimeType) {
      const doc = new XmldomDOMParser().parseFromString(text, mimeType);
      ensureQuerySelector(doc);
      normalizeChildrenTree(doc.documentElement);
      return doc;
    }
  };
}

function parseArgs(argv) {
  const out = {
    xsdPath: path.join(fixturesDir, "streaming-benchmark.xsd"),
    xmlPath: path.join(fixturesDir, "large-valid.xml"),
    concurrency: 2,
    maxBufferBytes: 1024 * 1024,
    includeParallel: true,
    minThroughputMBps: null,
    maxPeakRssMB: null,
    minParallelThroughputMBps: null,
    requireOk: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--xsd") {
      out.xsdPath = path.resolve(rootDir, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--xml") {
      out.xmlPath = path.resolve(rootDir, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--concurrency") {
      out.concurrency = Math.max(1, Number(argv[i + 1]) || out.concurrency);
      i += 1;
      continue;
    }
    if (arg === "--max-buffer-bytes") {
      out.maxBufferBytes = Math.max(1, Number(argv[i + 1]) || out.maxBufferBytes);
      i += 1;
      continue;
    }
    if (arg === "--no-parallel") {
      out.includeParallel = false;
      continue;
    }
    if (arg === "--min-throughput-mbps") {
      out.minThroughputMBps = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--max-peak-rss-mb") {
      out.maxPeakRssMB = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--min-parallel-throughput-mbps") {
      out.minParallelThroughputMBps = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--allow-errors") {
      out.requireOk = false;
    }
  }

  return out;
}

function evaluateThresholds({ out, args }) {
  const checks = [];

  if (Number.isFinite(args.minThroughputMBps)) {
    checks.push({
      name: "single.minThroughputMBps",
      target: args.minThroughputMBps,
      actual: Number(out.single?.throughputMBps || 0),
      passed: Number(out.single?.throughputMBps || 0) >= args.minThroughputMBps,
      comparator: ">=",
    });
  }

  if (Number.isFinite(args.maxPeakRssMB)) {
    checks.push({
      name: "single.maxPeakRssMB",
      target: args.maxPeakRssMB,
      actual: Number(out.single?.peakRssMB || 0),
      passed: Number(out.single?.peakRssMB || 0) <= args.maxPeakRssMB,
      comparator: "<=",
    });
  }

  if (args.includeParallel && Number.isFinite(args.minParallelThroughputMBps)) {
    checks.push({
      name: "parallel.minThroughputMBps",
      target: args.minParallelThroughputMBps,
      actual: Number(out.parallel?.throughputMBps || 0),
      passed:
        Number(out.parallel?.throughputMBps || 0) >= args.minParallelThroughputMBps,
      comparator: ">=",
    });
  }

  if (args.requireOk) {
    checks.push({
      name: "single.ok",
      target: true,
      actual: Boolean(out.single?.ok),
      passed: Boolean(out.single?.ok),
      comparator: "===",
    });

    if (args.includeParallel) {
      checks.push({
        name: "parallel.ok",
        target: true,
        actual: Boolean(out.parallel?.ok),
        passed: Boolean(out.parallel?.ok),
        comparator: "===",
      });
    }
  }

  const passed = checks.every((check) => check.passed);
  return { passed, checks };
}

function formatMB(valueBytes) {
  return Number((valueBytes / (1024 * 1024)).toFixed(2));
}

async function runSingleStreamBenchmark({ xsdText, xmlPath, options }) {
  const started = process.hrtime.bigint();
  let peakRss = process.memoryUsage().rss;
  let lastResult = null;

  const xmlStream = fs.createReadStream(xmlPath);
  for await (const result of validateXmlStream({
    xsdText,
    xmlStream,
    options,
  })) {
    lastResult = result;
    const rss = process.memoryUsage().rss;
    if (rss > peakRss) peakRss = rss;
  }

  const finished = process.hrtime.bigint();
  const elapsedMs = Number(finished - started) / 1_000_000;
  const bytes = Number(lastResult?.data?.progress?.bytes || 0);
  const throughputMBps = elapsedMs > 0 ? (bytes / (1024 * 1024)) / (elapsedMs / 1000) : 0;

  return {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    bytes,
    throughputMBps: Number(throughputMBps.toFixed(2)),
    issues: Number(lastResult?.issues?.length || 0),
    ok: Boolean(lastResult?.ok),
    peakRssBytes: peakRss,
    peakRssMB: formatMB(peakRss),
  };
}

async function runParallelBenchmark({ xsdText, xmlPath, options, concurrency }) {
  const started = process.hrtime.bigint();
  const streams = Array.from({ length: concurrency }, () => fs.createReadStream(xmlPath));
  const results = await validateXmlStreams({
    xsdText,
    xmlStreams: streams,
    options,
    concurrency,
  });
  const finished = process.hrtime.bigint();

  const elapsedMs = Number(finished - started) / 1_000_000;
  const totalBytes = results.reduce(
    (sum, result) => sum + Number(result?.data?.progress?.bytes || 0),
    0,
  );
  const totalIssues = results.reduce((sum, result) => sum + Number(result?.issues?.length || 0), 0);
  const throughputMBps = elapsedMs > 0 ? (totalBytes / (1024 * 1024)) / (elapsedMs / 1000) : 0;

  return {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    streams: concurrency,
    totalBytes,
    throughputMBps: Number(throughputMBps.toFixed(2)),
    totalIssues,
    ok: results.every((item) => item.ok),
  };
}

async function main() {
  installDomParserPolyfill();

  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.xsdPath)) {
    throw new Error(`Missing XSD fixture: ${args.xsdPath}`);
  }

  if (!fs.existsSync(args.xmlPath)) {
    throw new Error(
      `Missing XML fixture: ${args.xmlPath}. Run 'npm run fixtures:streaming' first.`,
    );
  }

  const xsdText = fs.readFileSync(args.xsdPath, "utf8");
  const xmlStats = fs.statSync(args.xmlPath);
  const options = {
    rootElementName: "root",
    maxBufferBytes: args.maxBufferBytes,
  };

  const single = await runSingleStreamBenchmark({
    xsdText,
    xmlPath: args.xmlPath,
    options,
  });

  const out = {
    fixture: {
      xsdPath: path.relative(rootDir, args.xsdPath),
      xmlPath: path.relative(rootDir, args.xmlPath),
      xmlSizeBytes: xmlStats.size,
      xmlSizeMB: formatMB(xmlStats.size),
    },
    options,
    single,
  };

  if (args.includeParallel) {
    out.parallel = await runParallelBenchmark({
      xsdText,
      xmlPath: args.xmlPath,
      options,
      concurrency: args.concurrency,
    });
  }

  out.thresholds = evaluateThresholds({ out, args });

  console.log("Streaming benchmark results:");
  console.log(JSON.stringify(out, null, 2));

  if (!out.thresholds.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
