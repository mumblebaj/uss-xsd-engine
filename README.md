# uss-xsd-engine

Browser-first XSD engine for schema diagnostics, tree extraction, sample XML generation, and XML validation.

---

![npm](https://img.shields.io/npm/v/uss-xsd-engine)
![dw](https://img.shields.io/npm/dw/uss-xsd-engine)
![dm](https://img.shields.io/npm/dm/uss-xsd-engine)
![dy](https://img.shields.io/npm/dy/uss-xsd-engine)
[![Jsdelivr](https://data.jsdelivr.com/v1/package/npm/uss-xsd-engine/badge)](https://www.jsdelivr.com/package/npm/uss-xsd-engine)

---

If you appreciate this library and you want to support my work:

<a href="https://www.buymeacoffee.com/mumblebaj" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Beer" style="height: 45px !important;width: 180px !important;" ></a>

---

> 📦 Latest release: See full details in [GitHub Releases](https://github.com/mumblebaj/uss-xsd-engine/releases)

---

Consult the Api Documentation for detailed usage and features:

> 📄 API Documentation: See full details in [API DOCUMENTATION](https://github.com/mumblebaj/uss-xsd-engine/blob/main/API_DOCUMENTATION.md)

---

## 🚀 Overview

`uss-xsd-engine` is a standalone JavaScript engine designed to process XML Schema (XSD) directly in the browser.

It is built to power tools like USS XSD Studio while remaining lightweight and reusable as:

- a browser/CDN script
- an npm package
- an embedded validation/generation engine

---

## ✨ Features

### ✅ Schema Processing
- Parse XSD into a structured internal model
- Namespace-aware schema resolution
- Support for global elements, types, groups, and attribute groups

### ✅ Schema Diagnostics
- Unknown types and references detection
- Missing base types
- Restriction validation (subset + occurrence narrowing)
- Facet validation (including pattern support for date/time)
- Default/fixed conflict detection
- Include/import diagnostics

### ✅ Schema Tree Extraction
- Semantic tree representation of XSD
- Expandable references and structure traversal
- Useful for UI rendering and schema exploration

### ✅ Sample XML Generation
- Minimal (mandatory-only) mode
- Full traversal (limited expansion)
- Namespace-aware output (`xmlns`, prefixes)
- Supports:
  - sequences
  - choices (first-branch strategy)
  - extensions
  - restrictions (first-pass)
- Honors:
  - `fixed` values
  - `default` values
- Depth-limited generation with cycle-safe recursion
- Controlled choice and repeated element expansion

### ✅ XML Validation
- Validate XML against XSD structure
- Namespace-aware validation
- Content model validation:
  - sequence
  - choice
  - all
- Mixed content enforcement
- Attribute validation
- Facet validation (pattern, length, numeric, etc.)
- Wildcard support for `xs:any` and `xs:anyAttribute`
- `processContents` support (`strict`, `lax`, `skip`)
- Namespace constraint handling including `##any`, `##other`, `##targetNamespace`, exclusions via `notNamespace` and `notQName`
- Restriction enforcement (runtime)
- Fixed value enforcement
- Identity constraints runtime validation (`xs:key`, `xs:keyref`, `xs:unique`)

### ✅ Streaming Validation (v0.3.0)
- Incremental async API: `validateXmlStream(...)`
- Chunk-based Node.js interface: `createStreamValidator(...)`
- Checkpoint/resume for resumable validation workflows
- Parallel multi-stream validation: `validateXmlStreams(...)`
- Streaming diagnostics export helper: `createStreamingDiagnosticsExporter(...)`
- Memory-bounded parser option via `maxBufferBytes`

### ✅ Include / Import (Groundwork)
- Recognizes `xs:include` and `xs:import`
- Supports caller-provided external schemas
- Merges external schema definitions into runtime model
- Emits warnings when referenced schemas are not provided

---

## 📦 Installation

### npm

```bash
npm install uss-xsd-engine
```

```JavaScript
import {
  getSchemaDiagnostics,
  extractSchemaTree,
  generateSampleXml,
  validateXml,
  validateXmlStream,
  createStreamValidator,
  validateXmlStreams,
  createStreamingDiagnosticsExporter
} from "uss-xsd-engine";

const result = validateXml(schema, xml);
console.log(result.issues);
```

### CDN/Browser

```HTML
<script src="https://unpkg.com/uss-xsd-engine@latest/dist/uss-xsd-engine.standalone.js"></script>

or

<script src="https://cdn.jsdelivr.net/npm/uss-xsd-engine@latest/dist/uss-xsd-engine.esm.min.js"></script>

<script>
  const result = UssXsdEngine.getSchemaDiagnostics({ xsdText });
</script>
```

### Public API
All endpoints follow a consistent result format:

```JavaScript
{
  ok: boolean,
  data: any,
  issues: Issue[],
  summary: {
    errorCount: number,
    warningCount: number,
    infoCount: number
  }
}
```

---

`getSchemaDiagnostics({ xsdText, options? })`
Analyze schema and return:

- issues (errors/warnings)
- roots
- supported/unsupported features
- schema statistics

---

`extractSchemaTree({ xsdText, options? })`
Returns a structured tree respresentation of the schema

---

`generateSampleXml({ xsdText, options? })`

Generates example XML from XSD.

- Options:
- `mode`:  `"minimal"` (default) or `"full"`
- `targetPrefix`: namespace prefix (default `"tns"`)
- `includeOptionalAttributes`: boolean
- `maxDepth`: number — limit recursive complex type expansion (default: 3)
- `maxChoiceBranches`: number — limit how many choice branches are expanded (default: 1)
- `expandRepeatingElements`: number — limit repeated element expansion for `maxOccurs > 1` (default: 2)
- `externalDocuments`: map of schemaLocation → XSD text

---

`validateXml({ xsdText, xmlText, options? })`

Validates XML against schema.

Options:
- `rootElementName`
- `externalDocuments`

---

`validateXmlStream({ xsdText, xmlStream, options?, checkpoint? })`

Validates XML incrementally from a stream source.

Returns `AsyncIterator<Result>` where each yielded result contains:
- incremental issues
- current element path
- progress (`bytes`, `elements`)

---

`createStreamValidator({ xsdText, options?, checkpoint? })`

Chunk-oriented streaming validator interface for Node.js streams.

Methods:
- `validateChunk(chunk)`
- `finalize()`
- `checkpoint()`
- `resume(checkpoint)`

---

`validateXmlStreams({ xsdText, xmlStreams, options?, checkpoints?, concurrency? })`

Validates multiple XML streams in parallel and returns an array of final results.

---

`createStreamingDiagnosticsExporter({ format?, includeData?, includeSummary? })`

Collects/exports streaming diagnostics in `ndjson`, `json`, or `array` format.

---

### 📚 External Schema Support

You can provide external schemas manually:

```JavaScript
const externalDocuments = {
  "common.xsd": "...",
  "common-import.xsd": "..."
};

validateXml({
  xsdText,
  xmlText,
  options: {
    externalDocuments
  }
});
```

---

## 🤔 Why uss-xsd-engine?

Most XML/XSD libraries were designed for server-side environments, require heavy dependencies, or lack meaningful diagnostics.

**uss-xsd-engine** is built differently — with a focus on modern, browser-first use cases and developer experience.

---

### 🌐 Browser-First by Design

* Runs fully in the browser
* No native dependencies or network fetching required
* Perfect for tools like USS, editors, and client-side validation

---

### 🧭 Precise Error Diagnostics

* Line/column support for both:

  * XML parsing errors
  * Schema validation errors
* Click-to-navigate support (e.g. Monaco Editor integration)
* Fine-grained mapping:

  * elements
  * attributes
  * values

➡️ Debug XML like you debug code

---

### 🌐 Namespace-Aware Everything

* Proper handling of `targetNamespace`
* Prefix-aware sample XML generation
* Multi-schema support with correct namespace boundaries

➡️ No more ambiguity in complex schema environments

---

### 🔁 Real Multi-Schema Support

* Recursive `xs:include` and `xs:import` resolution
* Handles deep schema graphs (A → B → C)
* Circular-safe resolution

➡️ Works with real-world schemas (not just simple examples)

---

### 🧩 Practical XML Generation

* Generates usable sample XML
* Respects:

  * structure
  * required elements
  * namespaces
* Designed for real testing, not just demos

---

### ⚡ Lightweight & Modular

* No heavy runtime dependencies
* Designed for CDN + npm usage
* Easy to embed into any tool or workflow

---

### 🧠 Built for Tooling

* Tree extraction for UI rendering
* Structured diagnostics pipeline
* Clean API surface for integration

➡️ Not just a library — a foundation for schema tooling

---

## 🚀 When to Use This Engine

Use **uss-xsd-engine** if you need:

* In-browser XML validation against XSD
* Schema-driven XML generation
* Developer-friendly diagnostics
* Multi-schema (include/import) support
* A lightweight alternative to server-side XML tools

---

💡 This engine is actively evolving — built to power real tools, not just validate specs.

---

## ⚠️ Supported vs Not Fully Supported
### ✅ Supported (v0.3.0)
- XSD parsing into an internal schema model
- Namespace-aware resolution (elements, types, attributes, groups)
- Extensions (`xs:extension`)
- Restrictions (subset enforcement, occurrence narrowing, attribute constraints)
- Facet validation:
  - length, numeric, pattern, enumeration, digits
- Default / fixed semantics (schema + XML validation)
- Include/import:
  - manual provision via `externalDocuments`
  - recursive resolution
  - strict namespace enforcement
- Chameleon includes (namespace adoption for no-targetNamespace schemas)
- Namespace-aware sample XML generation:
  - minimal + representative modes
  - pattern-aware generation (e.g., UETR, BIC)
- XML validation:
  - structural validation (sequence, choice, all, groups)
  - identity constraints (`xs:key`, `xs:keyref`, `xs:unique`)
  - simpleContent + complexContent enforcement
  - mixed content handling
  - restriction validation (pass 2)
- Root and nested `simpleContent` validation alignment
- XML parse diagnostics with line/column support
- Semantic XML diagnostics with line/column support
- Attribute, value, and text source mapping
- Namespace-aware schema tree extraction
- Imported schema isolation with namespace-safe lookup
- QName resolution:
  - prefixed + default namespace handling
  - no cross-namespace leakage
- Streaming validation APIs:
  - `validateXmlStream(...)`
  - `createStreamValidator(...)`
  - `validateXmlStreams(...)`
  - `createStreamingDiagnosticsExporter(...)`
- Resumable validation with checkpoint/restore
- Memory-bound parser guard with `maxBufferBytes`
- Streaming benchmark tooling:
  - fixture generation (`fixtures:streaming`, `fixtures:streaming:target100`)
  - benchmark runner with threshold checks (`benchmark:streaming`)

---

## ❌ Not Supported Yet
- Automatic network fetching of schemas
  - (engine is intentionally browser-first and caller-driven)
- Full W3C spec completeness
  - (focus is practical + real-world coverage)
- Complete XSD 1.0/1.1 coverage targets planned for Phase 5 (for example full list/union support and advanced 1.1 assertions)
- All Phase 4 benchmark targets are not guaranteed on every runtime/environment out of the box

---

## ⚡ Streaming API Quickstart

Async iterator API:

```javascript
import fs from "node:fs";
import { validateXmlStream } from "uss-xsd-engine";

for await (const result of validateXmlStream({
  xsdText,
  xmlStream: fs.createReadStream("./large.xml"),
  options: { rootElementName: "root" }
})) {
  if (!result.ok) {
    console.log(result.issues);
  }
}
```

Chunk-based interface:

```javascript
import fs from "node:fs";
import { createStreamValidator } from "uss-xsd-engine";

const validator = createStreamValidator({ xsdText, options: { maxBufferBytes: 1024 * 1024 } });
const stream = fs.createReadStream("./large.xml");

stream.on("data", (chunk) => {
  const result = validator.validateChunk(chunk);
  if (result.issues.length) console.log(result.issues);
});

stream.on("end", () => {
  console.log(validator.finalize());
});
```

Parallel validation and diagnostics export:

```javascript
import fs from "node:fs";
import {
  validateXmlStreams,
  createStreamingDiagnosticsExporter,
} from "uss-xsd-engine";

const exporter = createStreamingDiagnosticsExporter({ format: "ndjson" });

const results = await validateXmlStreams({
  xsdText,
  xmlStreams: [
    fs.createReadStream("./a.xml"),
    fs.createReadStream("./b.xml"),
  ],
  concurrency: 2,
});

results.forEach((result, idx) => exporter.write(result, { streamIndex: idx }));
console.log(exporter.flush());
```

---

## 🚀 Streaming Benchmark Quickstart

Phase 4.3 includes benchmark tooling for streaming validation throughput and memory checks.

Generate fixtures:

```bash
npm run fixtures:streaming
```

Generate target-size fixtures (100MB profile):

```bash
npm run fixtures:streaming:target100
```

Run benchmark:

```bash
npm run benchmark:streaming -- --xml benchmarks/fixtures/large-valid-small.xml --concurrency 2
```

Run benchmark with pass/fail thresholds (non-zero exit code when checks fail):

```bash
npm run benchmark:streaming -- \
  --xml benchmarks/fixtures/large-valid-target.xml \
  --min-throughput-mbps 10 \
  --max-peak-rss-mb 50
```

Use preset target command:

```bash
npm run benchmark:streaming:target
```

---

## 🧪 Playground

The repository includes `playground.html` for:

- testing schemas
- validating XML
- generating sample XML
- debugging diagnostics

The playground uses the built bundle to simulate real-world usage.

---

## 📌 Versioning

This project follows incremental feature delivery:

`0.1.x` → foundational engine (current phase)
`0.2.x` → expanded spec coverage
`1.0.0` → stable production-ready engine

---

## 🤝 Contributing

This project is currently evolving rapidly. Contributions and feedback are welcome.

---

## 📄 License

MIT

---
