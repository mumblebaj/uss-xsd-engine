# uss-xsd-engine

Browser-first XSD parsing, validation, schema tree extraction, diagnostics, and sample XML generation engine for Universal Schema Studio (USS).

## Status

Early scaffold / plumbing phase.

## Public API

- `parseSchema(xsdString, options?)`
- `validateXml(xmlString, schemaModel, options?)`
- `generateSampleXml(schemaModel, rootElementName?, options?)`
- `extractSchemaTree(schemaModel, options?)`
- `getSchemaDiagnostics(schemaModel, options?)`

## Example

```js
import {
  parseSchema,
  validateXml
} from "./src/index.js";

const schemaResult = parseSchema(xsdText);

if (schemaResult.ok) {
  const validation = validateXml(xmlText, schemaResult.schemaModel);
  console.log(validation);
}
```

## Runtime

Current development target: browser environments.

The engine currently assumes a browser-like DOM environment with `DOMParser` available.
Node.js test/runtime support may be added later through an injected XML DOM implementation.