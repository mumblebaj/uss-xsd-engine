# uss-xsd-engine

Browser-first XSD engine for parsing, diagnostics, schema tree extraction, sample XML generation, and XML validation.

## Goal

`uss-xsd-engine` is being built as a standalone engine that can eventually be shipped as:

- a browser/CDN bundle
- an npm package

The engine is intended to power USS XSD Studio and other browser-based XML/XSD tooling without pushing heavy schema logic into the host application.

## Current status

This project is in active development.

Current implemented capabilities:

- Parse XSD into an internal schema model
- Run schema diagnostics
- Extract a semantic schema tree
- Generate sample XML from XSD
- Validate XML against XSD
- First-pass namespace and prefix handling
- First-pass facet validation and sample generation support

## Current public API

```js
import {
  getSchemaDiagnostics,
  extractSchemaTree,
  generateSampleXml,
  validateXml
} from "./src/index.js";
```

`getSchemaDiagnostics({ xsdText, options? })`

Returns schema issues, roots, supported features, unsupported features, and schema statistics.

`extractSchemaTree({ xsdText, options? })`

Returns a semantic tree representation of the schema.

`generateSampleXml({ xsdText, options? })`

Generates example XML from the schema.

`validateXml({ xsdText, xmlText, options? })`

Validates XML against the schema and returns structured issues.

## Design principles

- Browser-first
- Dependency-light
- USS-friendly
- Shared semantic core
- Stable result and issue contracts
- Incremental implementation without drifting

### Result contract

All public endpoints return the same top-level shape:

```js
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

### Issue contract

```js
{
  code: string,
  severity: "error" | "warning" | "info",
  message: string,
  line: number | null,
  column: number | null,
  path: string | null,
  source: "xsd" | "xml" | "engine",
  nodeKind: string | null,
  name: string | null,
  details: Record<string, any>
}
```
### Playground
The repository includes `playground.html` for manual testing and iterative feature development.

Use it to test:

- schema diagnostics
- schema tree extraction
- sample XML generation
- XML validation
- namespace handling
- facet validation

### Project structure

```ruby
src/
  api/
  diagnostics/
  generator/
  model/
  parser/
  resolver/
  tree/
  utils/
  validation/
  ```

  ## Roadmap

  ### Completed foundations
  - Schema diagnostics
  - Tree extraction
  - Sample XML generation
  - XML validation
  - Namespace-aware core resolution
  - Facet validation pass 2

  ## Next candidates

  - XML validation depth pass 2
  - Mixed content support
  - Restriction inheritance improvements
  - Better choice/all edge cases
  - Namespace-aware sample XML output
  - Import/include support
  - Browser standalone bundle for CND release

  ## Development notes
  This project is intentionally being built milestone by milestone:
  1. define endpoint
  2. implement end-to-end
  3. stabilize
  4. move to next endpoint

  This keeps the engine practicle and prevents architectural drift.

  ## License

  ### MIT
  
