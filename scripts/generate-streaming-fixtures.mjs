import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const fixturesDir = path.join(rootDir, "benchmarks", "fixtures");

const DEFAULT_RECORDS = {
  small: 50_000,
  large: 300_000,
};

const APPROX_BYTES_PER_RECORD = 54;

function estimateRecordCountForTargetMB(targetSizeMB) {
  const targetBytes = Math.max(1, Number(targetSizeMB) || 1) * 1024 * 1024;
  return Math.max(1, Math.ceil(targetBytes / APPROX_BYTES_PER_RECORD));
}

function parseArgs(argv) {
  const out = {
    smallRecords: DEFAULT_RECORDS.small,
    largeRecords: DEFAULT_RECORDS.large,
    targetSizeMB: null,
    profile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--small-records") {
      out.smallRecords = Number(argv[i + 1]) || out.smallRecords;
      i += 1;
      continue;
    }
    if (arg === "--large-records") {
      out.largeRecords = Number(argv[i + 1]) || out.largeRecords;
      i += 1;
      continue;
    }
    if (arg === "--target-size-mb") {
      out.targetSizeMB = Number(argv[i + 1]) || out.targetSizeMB;
      i += 1;
      continue;
    }
    if (arg === "--profile") {
      out.profile = String(argv[i + 1] || "").trim();
      i += 1;
    }
  }

  if (out.profile === "target100") {
    out.targetSizeMB = 100;
  }

  if (Number.isFinite(out.targetSizeMB) && out.targetSizeMB > 0) {
    out.largeRecords = estimateRecordCountForTargetMB(out.targetSizeMB);
  }

  return out;
}

function writeFixture(filePath, recordCount, mode = "valid") {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("finish", resolve);

    stream.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<root>\n");

    for (let i = 0; i < recordCount; i += 1) {
      const id = i + 1;
      let code = `C${String(id).padStart(5, "0")}`;
      let value = `item-${id}`;

      if (mode === "invalid" && i % 7777 === 0) {
        // Deliberately violate code minLength to exercise error path in benchmarks.
        code = "x";
      }
      if (mode === "invalid" && i % 12345 === 0) {
        // Deliberately violate xs:int parsing occasionally.
        stream.write(`  <item id=\"bad-${id}\" code=\"${code}\">${value}</item>\n`);
        continue;
      }

      stream.write(`  <item id=\"${id}\" code=\"${code}\">${value}</item>\n`);
    }

    stream.end("</root>\n");
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(fixturesDir, { recursive: true });

  const smallValid = path.join(fixturesDir, "large-valid-small.xml");
  const largeValid = path.join(fixturesDir, "large-valid.xml");
  const largeInvalid = path.join(fixturesDir, "large-invalid.xml");
  const targetProfileValid = path.join(fixturesDir, "large-valid-target.xml");
  const targetProfileInvalid = path.join(fixturesDir, "large-invalid-target.xml");

  await writeFixture(smallValid, args.smallRecords, "valid");
  await writeFixture(largeValid, args.largeRecords, "valid");
  await writeFixture(largeInvalid, args.largeRecords, "invalid");

  if (Number.isFinite(args.targetSizeMB) && args.targetSizeMB > 0) {
    await writeFixture(targetProfileValid, args.largeRecords, "valid");
    await writeFixture(targetProfileInvalid, args.largeRecords, "invalid");
  }

  const files = [smallValid, largeValid, largeInvalid];
  if (Number.isFinite(args.targetSizeMB) && args.targetSizeMB > 0) {
    files.push(targetProfileValid, targetProfileInvalid);
  }

  const stats = files.map((file) => {
    const size = fs.statSync(file).size;
    return {
      file: path.relative(rootDir, file),
      sizeBytes: size,
      sizeMB: Number((size / (1024 * 1024)).toFixed(2)),
    };
  });

  console.log("Generated streaming fixtures:");
  for (const item of stats) {
    console.log(`- ${item.file}: ${item.sizeMB} MB (${item.sizeBytes} bytes)`);
  }

  if (Number.isFinite(args.targetSizeMB) && args.targetSizeMB > 0) {
    console.log(
      `Target profile requested: ${args.targetSizeMB} MB (estimated records=${args.largeRecords}, approx ${APPROX_BYTES_PER_RECORD} bytes/record).`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
