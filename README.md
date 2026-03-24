# uss-xsd-engine

Browser-first XSD engine for schema diagnostics, tree extraction, sample XML generation, and XML validation.

---

![npm](https://img.shields.io/npm/v/uss-xsd-engine)
[![Jsdelivr](https://data.jsdelivr.com/v1/package/npm/uss-xsd-engine/badge)](https://www.jsdelivr.com/package/npm/uss-xsd-engine)

---

> 📦 Latest release: See full details in [GitHub Releases](https://github.com/mumblebaj/uss-xsd-engine/releases)

---

## 🚀 Overview

`uss-xsd-engine` is a standalone JavaScript engine designed to process XML Schema (XSD) directly in the browser.

It is built to power tools like USS XSD Studio while remaining lightweight, dependency-free, and reusable as:

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
- Restriction enforcement (runtime)
- Fixed value enforcement

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
  validateXml
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
All endpoints follow a consistant result format:

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
- `externalDocuments`: map of schemaLocation → XSD text

---

`validateXml({ xsdText, xmlText, options? })`

Validates XML against schema.

Options:
- `rootElementName`
- `externalDocuments`

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

## ⚠️ What This Is NOT (Yet)

* Full W3C spec-complete validator (edge cases still evolving)
* Streaming validator for very large XML
* Identity constraint (`xs:key`, etc.) enforcement

➡️ The focus is **practical correctness + usability**, with continuous expansion

---

💡 This engine is actively evolving — built to power real tools, not just validate specs.

---

## ⚠️ Supported vs Not Fully Supported
### ✅ Supported (v0.1.x / RC)
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

---

## ⚠️ Partially Supported / In Progress
- Deep sample XML expansion:
  - complex choice branching
  - recursion depth control
- Full restriction theorem validation:
  - advanced edge cases (beyond practical subset checks)
- Advanced wildcard handling:
  - `xs:any`
  - `xs:anyAttribute`
- Attribute namespace qualification edge cases

---

## ❌ Not Supported Yet
- Identity constraints:
  - `xs:key`
  - `xs:keyref`
  - `xs:unique`
- `xs:redefine`
- Automatic network fetching of schemas
  - (engine is intentionally browser-first and caller-driven)
- Full W3C spec completeness
  - (focus is practical + real-world coverage)
- Streaming / incremental validation for very large XML


---

## 🧪 Playground

The repository includes `playground.html` for:

- testing schemas
- validating XML
- generating sample XML
- debugging diagnostics

The playground uses the built bundle to simulate real-world usage.

---

## 🧱 Architecture

```ruby
src/
  api/
  parser/
  model/
  resolver/
  validation/
  generator/
  tree/
  diagnostics/
  utils/
  ```
  Design principles:
  - browser-first
  - dependency-light
  - layered architecture
  - shared semantic model across all features

  ---

  ## 🛣️ Roadmap
### Near-term
- Recursive include/import resolution
- Improved sample XML depth traversal
- Restriction enforcement (advanced cases)
- Better namespace output strategies

### Mid-term
- Identity constraints (key/keyref)
- Advanced wildcard handling
- Performance optimizations

### Long-term
- Full XSD spec coverage
- Streaming validation
- USS Pro / hosted engine capabilities

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
