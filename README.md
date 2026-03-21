# uss-xsd-engine

Browser-first XSD engine for schema diagnostics, tree extraction, sample XML generation, and XML validation.

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
```

### CDN/Browser

```HTML
<script src="https://unpkg.com/uss-xsd-engine@0.1.0-beta.2/dist/uss-xsd-engine.standalone.js"></script>

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

## ⚠️ Supported vs Not Fully Supported
### ✅ Supported (v0.1.x)
- Most common XSD structures
- Namespace-aware resolution
- Extensions (`xs:extension`)
- Restrictions (subset + occurrence checks)
- Facet validation (including pattern)
- Default / fixed semantics
- Include/import (manual provision)
- Sample XML generation (practical coverage)
- XML validation (core structure + facets)

---

## ⚠️ Partially Supported / In Progress
- Deep sample XML expansion (choice branching, recursion depth)
- Full restriction theorem validation (advanced edge cases)
- Namespace preservation strategies in generation
- Advanced wildcard (`xs:any`, `xs:anyAttribute`)
- Attribute namespace qualification
- Recursive include/import graph resolution

---

## ❌ Not Supported Yet
- Identity constraints (`xs:key`, `xs:keyref`, `xs:unique`)
- Automatic network fetching of schemas
- Full W3C spec conformance (edge-case completeness)
- Streaming validation for very large XML
- Chameleon includes

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
