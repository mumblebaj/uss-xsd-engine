# uss-xsd-engine Copilot Instructions

This document defines coding standards, architectural constraints, and development workflows for the uss-xsd-engine project. All code generation and modifications must follow these guidelines.

---

## 1. Tech Stack Overview

### Language & Runtime
- **Primary Language**: JavaScript (ECMAScript Modules)
- **Node.js Version**: >=18 (required by package.json)
- **Module System**: ESM (import/export), not CommonJS
- **Browser Compatibility**: Browser-first design with DOM abstraction via @xmldom/xmldom

### Core Dependencies
- **@xmldom/xmldom**: ^0.8.0 - DOM compatibility layer for Node.js and browser
- **esbuild**: ^0.27.4 - Build bundling (ESM + IIFE formats)

### Build & Package
- **Build Tool**: esbuild (not webpack, parcel, or Vite)
- **Output Formats**:
  - `dist/uss-xsd-engine.esm.js` - ESM for npm imports
  - `dist/uss-xsd-engine.standalone.js` - IIFE for browser/CDN
- **Entry Point**: `src/index.js`
- **Package Type**: `"type": "module"` - all files are ESM

### Testing Framework
- **Test Runner**: Node.js native `node:test` (NOT Vitest, Jest, Mocha, or others)
- **Assertion Library**: `node:assert/strict` (strict equality assertions)
- **Test Command**: `npm test` runs `node --test "tests/**/*.test.js"`
- **Test File Pattern**: All test files must end with `.test.js`

### API Result Pattern
**Every public function MUST return a consistent result object:**
```javascript
{
  ok: boolean,           // true if no errors, false if any severity==="error"
  data: any,             // result-specific data (null on parse failure)
  issues: Issue[],       // array of diagnostic issues
  summary: {
    errorCount: number,
    warningCount: number,
    infoCount: number
  },
  version: string        // ENGINE_VERSION from src/version.js
}
```

**Issue Object Structure:**
```javascript
{
  code: string,          // from ISSUE_CODES enum (e.g., "UNKNOWN_TYPE")
  severity: "error" | "warning" | "info",
  message: string,       // human-readable description
  line: number | null,   // 1-based line number in source
  column: number | null, // 1-based column number in source
  path: string | null,   // XPath-like path in schema/XML structure
  source: "xsd" | "xml", // which artifact contains the issue
  nodeKind: string | null, // XML node type (e.g., "element", "attribute")
  name: string | null,   // name of affected node/type
  details: object        // optional context-specific data
}
```

---

## 2. Architecture & Directory Constraints

### Modular Layered Architecture
The project follows a strict layered design with no circular dependencies:

```
Input (XSD/XML Text)
    ↓
Parser (src/parser/)
    ↓
Model (src/model/)
    ↓
Diagnostics / Resolution (src/diagnostics/, src/resolver/)
    ↓
Validation / Generation (src/validation/, src/generator/)
    ↓
Result (utils/result.js) → Return to caller
```

### Directory Structure Rules

**`src/parser/`** - XSD and XML parsing only
- `parseXsd.js` - Parse XSD text → DOM document (returns `{ ok, doc, issues }`)
- `buildSchemaModel.js` - Build internal schema model from DOM
- ⚠️ **RULE**: Never import from `validation/`, `generator/`, or `diagnostics/` here

**`src/model/`** - Data structures and queries
- `schemaModel.js` - Factory functions for schema objects (`createEmptySchemaModel()`, `createElementDecl()`, etc.)
- `schemaQueries.js` - Query utilities for navigating schema
- `xsdBuiltin.js` - Built-in XSD type definitions
- ⚠️ **RULE**: Pure data structures only, no parsing or validation logic

**`src/diagnostics/`** - Issue detection at schema-build time
- `schemaDiagnostics.js` - Main diagnostic runner orchestrator
- `schemaDefaultFixedDiagnostics.js` - default/fixed value conflicts
- `schemaFacetDiagnostics.js` - facet constraint validation
- `schemaIdentityConstraintDiagnostics.js` - xs:key/keyref/unique schema diagnostics
- `schemaImportDiagnostics.js` - include/import validation
- `schemaRestrictionDiagnostics.js` - restriction validation
- `schemaWildcardDiagnostics.js` - wildcard processContents validation
- `createIssue.js` - Issue object factory
- `issueCodes.js` - Centralized ISSUE_CODES enum (source of truth for all code values)
- ⚠️ **RULE**: Schema-time diagnostics only; never add XML validation here

**`src/validation/`** - Runtime XML validation
- `validateXmlAgainstSchema.js` - Main validation orchestrator
- `structureValidator.js` - Content model validation (sequence/choice/all)
- `valueValidator.js` - Value constraint validation (length, pattern, facets)
- `builtinTypeValidators.js` - Built-in XSD type validators
- `identityConstraintValidator.js` - xs:key/keyref/unique runtime enforcement
- `facetUtils.js` - Facet validation utilities
- `xmlDiagnostics.js` - XML parse error handling
- `xmlSourceMap.js` - Source location tracking for XML
- `streamingValidator.js` - Async streaming validation API
- `streamingState.js` - Incremental validation state machine
- `xmlStreamParser.js` - Event-based XML parser wrapper
- ⚠️ **RULE**: XML-time validation only; never run schema diagnostics here

**`src/generator/`** - Sample XML generation
- `generateXml.js` - Main generation orchestrator
- `sampleValueFactory.js` - Sample value creation
- `xmlWriter.js` - XML formatting
- ⚠️ **RULE**: Never add validation logic here; pure generation only

**`src/tree/`** - Schema tree extraction (for UI rendering)
- `extractTree.js` - Tree extraction
- `treeNodeBuilders.js` - Tree node construction
- ⚠️ **RULE**: No diagnostics or validation

**`src/resolver/`** - Reference resolution only
- `schemaResolvers.js` - Resolve element types, attribute groups, etc.
- ⚠️ **RULE**: Resolution only, no validation

**`src/utils/`** - Shared utilities
- `result.js` - Result object factory (`makeResult()`)
- `errors.js` - Diagnostic creation helpers
- `xpathEvaluator.js` - Simplified XPath evaluation for identity constraints

**`src/api/`** - Public API entry points
- `getSchemaDiagnostics.js` - Main diagnostic API
- `validateXml.js` - Main validation API
- `extractSchemaTree.js` - Tree extraction API
- `generateSampleXml.js` - Sample generation API
- `parseSchema.js` - Legacy/deprecated (avoid)
- `parseXsd.js` - Legacy/deprecated (avoid)
- ⚠️ **RULE**: Only orchestration; delegate to model/parser/diagnostics/validation layers

### Directory Constraints - Where To Add Files
- **New validation logic** → `src/validation/` (coordinate with `validateXmlAgainstSchema.js`)
- **New schema diagnostics** → `src/diagnostics/` (add new `schema*.js` file, integrate into `schemaDiagnostics.js`)
- **New issue codes** → `src/diagnostics/issueCodes.js` (append to `ISSUE_CODES` enum)
- **New data structures** → `src/model/schemaModel.js` (add `create*` factory)
- **New XSD features** → May affect multiple layers; submit RFC in issues before implementation
- **Never**: Mix validation and diagnostics; circular imports; validation in generators

---

## 3. Spec-Driven Coding Mandate

**Before implementing any feature or API change, a markdown specification must exist.**

### Specification Requirements
All features MUST have a spec file before implementation begins:
- **Location**: `docs/specs/` or `.github/specs/` (create if needed)
- **Naming**: Descriptive kebab-case (e.g., `identity-constraints.md`, `streaming-checkpoint-resume.md`)
- **Format**: Markdown with standard sections

### Required Specification Sections
```markdown
# Feature Name

## Overview
(1-3 sentences describing what and why)

## Requirements
- REQ-1: [Specific behavior]
- REQ-2: [Specific behavior]
- REQ-3: [Edge case handling]

## API Changes
(If adding/modifying public functions)
```javascript
// Before (if modifying existing)
functionName({ param1, param2 }) → { ok, data, issues }

// After (if new or changed)
functionName({ newParam, oldParam = default }) → { ok, data: { field }, issues }
```
```

## Affected Modules
- src/module1.js (why)
- src/module2.js (why)

## Test Plan
- [ ] Schema-time parsing edge cases
- [ ] Runtime validation scenarios
- [ ] Streaming validation (if applicable)
- [ ] Integration tests

## Open Questions
(Clarify ambiguities before implementation)
```

### Copilot's Spec Requirement
When asked to implement a feature or fix a bug:
1. **FIRST**: Ask to see or create the specification
2. **Refuse code generation** if no spec exists (say: "I need a spec. Can you provide `docs/specs/feature-name.md`?")
3. **Reference spec sections** in code comments (e.g., `// REQ-1: XPath validation`)
4. **Update spec** when implementation deviates (with explanation)

### Existing Specs to Reference
- `UPGRADE_PLAN.md` - Long-term phased roadmap
- `API_DOCUMENTATION.md` - Public API contracts
- Test files (`tests/**/*.test.js`) - Implicit spec via test names and assertions

---

## 4. Error Handling & Validation Standards

### Issue Code Usage (MANDATORY)
Every diagnostic MUST use a code from `src/diagnostics/issueCodes.js`:
- Schema issues: `XSD_*`, `UNKNOWN_*`, `DUPLICATE_*` prefixes
- XML validation issues: `XML_*` prefix
- Facet/Restriction issues: `XSD_FACET_*`, `XSD_RESTRICTION_*`
- Never use `UNKNOWN_ERROR` or ad-hoc codes

### Issue Severity Classification
```javascript
{
  error:   // Spec violation, invalid structure, missing required constraints
  warning: // Non-conformant but recoverable, missing optional features
  info:    // Statistics, supportedFeatures, schema summary
}
```

### Validation Flow (Canonical)
```
1. Parse XSD text with parseXsd() → Issue: XSD_PARSE_ERROR
   ↓
2. Build schema model with buildSchemaModel() → Issues: DUPLICATE_*, UNKNOWN_*
   ↓
3. Run schema diagnostics with runSchemaDiagnostics() → Issues: XSD_FACET_*, XSD_RESTRICTION_*
   ↓
4. Parse XML text with parseXmlWithDiagnostics() → Issue: XML_PARSE_ERROR
   ↓
5. Validate structure with validateContentModel() → Issues: XML_UNEXPECTED_ELEMENT, XML_MISSING_REQUIRED_ELEMENT
   ↓
6. Validate values with validateElementValue() → Issues: XML_VALUE_INVALID, XML_PATTERN_MISMATCH
   ↓
7. Validate identity constraints with validateIdentityConstraints() → Issues: XML_KEY_VIOLATION, XML_KEYREF_VIOLATION
   ↓
8. Return result via makeResult({ data, issues })
```

### Error Handling DO's and DON'Ts
✅ DO:
- Return structured issues via result object
- Capture `line`, `column`, `path` for every issue
- Use `createIssue()` factory to build consistent objects
- Validate early and collect all issues (don't stop at first error)
- Document issue code in `issueCodes.js` comment

❌ DON'T:
- Throw exceptions in API functions (catch and return as error issue)
- Lose source location information
- Return bare error strings
- Skip validation to improve speed
- Add ad-hoc severity levels (only "error", "warning", "info")

### Namespace Handling (Critical for Security)
Every element/attribute/type resolution MUST account for:
- Target namespace (from schema `targetNamespace` attr)
- Declared prefixes and their URIs
- Default namespace
- No-namespace elements
- Name normalization: Use `::name` for no-namespace, `prefix:name` for qualified

Example from codebase:
```javascript
// DO: Namespace-aware
schema.globals.elements["::note"]     // no namespace
schema.globals.elements["tns:note"]   // tns prefix
schema.globals.types["xs:string"]     // xs prefix (builtin)

// DON'T: Ignore namespace
schema.globals.elements["note"]       // ambiguous!
```

---

## 5. Testing Requirements

### Testing Framework: node:test (Native Node.js)
- **Must use**: `import test from "node:test"`
- **Must use**: `import assert from "node:assert/strict"`
- **File pattern**: `tests/**/*.test.js`
- **Run command**: `npm test`

### Test Structure & Organization
Tests mirror `src/` directory structure:

```
src/parser/buildSchemaModel.js
  → tests/smoke/parseSchema.test.js (single-feature tests)

src/validation/identityConstraintValidator.js
  → tests/integration/identityConstraint*.test.js (multi-component tests)

src/validation/streamingValidator.js
  → tests/streaming/streamValidator.test.js (advanced features)
```

### Test Categories

**Smoke Tests** (`tests/smoke/`)
- Single XSD feature validation
- Simple XML validation scenarios
- One issue code or behavior per test
- Fast execution (<100ms each)
- Example: `test("buildSchemaModel parses simple schema globals", () => { ... })`

**Integration Tests** (`tests/integration/`)
- Multi-component workflows
- End-to-end validation scenarios
- Complex constraint validation
- Namespace and inheritance chains
- Example: `test("runtime identity constraint validation: keyref missing reference", () => { ... })`

**Streaming Tests** (`tests/streaming/`)
- Async/await patterns with streams
- Checkpoint/resume scenarios
- Memory and concurrency bounds
- Example: `test("validateXmlStream handles checkpoint resume", () => { ... })`

### Mandatory Test Patterns

**ALWAYS include helper to build schema model:**
```javascript
import { parseXsdDoc } from "../helpers/domCompat.js";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";

function schemaFromText(xsdText) {
  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  assert.ok(result.schema, "schema model should be built");
  return result.schema;
}
```

**ALWAYS use strict assertions:**
```javascript
// DO
assert.ok(result.schema, "message")
assert.equal(result.issues.length, 0)
assert.deepEqual(actual, expected)
assert.throws(() => { }, Error)

// DON'T
if (!result.schema) throw new Error("fail")
expect(result).toBe(true)  // Jest syntax
test.todo("skip this")
```

**ALWAYS validate result structure:**
```javascript
test("getSchemaDiagnostics returns valid result", () => {
  const result = getSchemaDiagnostics({ xsdText: ... });
  
  // Validate result shape
  assert.ok(typeof result.ok === "boolean");
  assert.ok(Array.isArray(result.issues));
  assert.ok(result.summary);
  assert.equal(typeof result.version, "string");
  
  // Check issue codes
  const codes = result.issues.map(i => i.code);
  assert.ok(codes.every(c => Object.values(ISSUE_CODES).includes(c)));
});
```

**ALWAYS test both success and failure paths:**
```javascript
test("validateXml returns xmlValid: true on correct XML", () => {
  const result = validateXml({ xsdText, xmlText });
  assert.equal(result.ok, true);
  assert.equal(result.data.xmlValid, true);
  assert.equal(result.issues.length, 0);
});

test("validateXml returns xmlValid: false and XML_UNEXPECTED_ELEMENT on invalid element", () => {
  const result = validateXml({ xsdText, xmlText: "<invalid/>" });
  assert.equal(result.ok, false);
  assert.equal(result.data.xmlValid, false);
  const codes = result.issues.map(i => i.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_UNEXPECTED_ELEMENT));
});
```

### DOM Compatibility in Tests
Use `tests/helpers/domCompat.js` for browser/Node.js compatibility:
```javascript
import { parseXsdDoc, installDomParserPolyfill } from "../helpers/domCompat.js";

// For browsers or Node + polyfill
installDomParserPolyfill();
const doc = parseXsdDoc(xsdText);

// Or pass DOMParser explicitly
const result = validateXmlAgainstSchema(schema, xmlText, {}, { DOMParser });
```

### Coverage Expectations
- **Schema parsing**: 100% of builtin types, all namespace scenarios
- **Validation**: Every issue code must have ≥1 passing + ≥1 failing test
- **Streaming**: Checkpoint/resume, multi-stream parallel, memory bounds
- **Integration**: End-to-end feature workflows (e.g., parse → diagnose → validate)

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
node --test tests/smoke/parseSchema.test.js

# Watch mode (not built-in; use a script or file watcher)
```

---

## 6. Coding Patterns & Conventions

### Naming Conventions
```javascript
// Functions
create*()      // Factory functions (createIssue, createElementDecl)
resolve*()     // Reference resolution (resolveType, resolveAttributeGroup)
build*()       // Model construction (buildSchemaModel)
validate*()    // Validation/checking (validateXmlAgainstSchema, validateContent)
run*()         // Orchestration (runSchemaDiagnostics)
get*()         // Data retrieval (getSchemaDiagnostics)
generate*()    // Generation (generateSampleXml)
extract*()     // Tree/data extraction (extractSchemaTree)
parse*()       // Parsing (parseXsd, parseXml)

// Files
*Model.js      // Data structures
*Validator.js  // Validation logic
*Diagnostics.js // Issue detection
*Resolvers.js  // Resolution
*Utils.js      // Utilities
*Test.js       // Tests
```

### Function Signatures
```javascript
// Schema-building functions: return { schema, issues }
parseXsd(xsdText) → { ok, doc, issues }
buildSchemaModel(doc, options) → { schema, issues }

// Public API functions: return result object
getSchemaDiagnostics({ xsdText, options }) → { ok, data, issues, summary, version }
validateXml({ xsdText, xmlText, options }) → { ok, data, issues, summary, version }

// Validators: return { data, issues }
validateXmlAgainstSchema(schema, xmlText, options, helpers) → { data, issues }

// Factories: return object
createIssue({ code, severity, message, ... }) → { code, severity, message, ... }
createElementDecl({ name, typeName, minOccurs, ... }) → { kind, name, typeName, ... }
```

### Comments & Documentation
```javascript
// DO: Explain WHY (XSD spec reference, complex logic)
// xs:key enforces uniqueness per selector context
// See: https://www.w3.org/TR/xmlschema11-1/#section-Identity-constraints

// DON'T: Repeat the code
const x = 5; // assign 5 to x

// DO: Reference spec/issue/RFC
// REQ-2: Identity constraints must validate keyrefs at runtime
// Keyrefs refer to xs:key or xs:unique, not vice versa (XSD 1.1 §3.11.3)
```

### Avoid Anti-Patterns
❌ Circular imports (Parser ↔ Diagnostics)
❌ Global state (use pure functions + return values)
❌ Exception-driven flow (return structured issues)
❌ Lossy transformations (preserve source location `line`, `column`, `path`)
❌ Namespace-agnostic lookups (always use `prefix:name` or `::name` form)
❌ Partial validation (collect all issues, don't return early)
❌ Hardcoded limits without configuration (use `options` object)

---

## 7. Common Tasks & Workflows

### Adding a New Issue Code
1. Add constant to `src/diagnostics/issueCodes.js`:
   ```javascript
   UNKNOWN_TYPE: "UNKNOWN_TYPE",
   // NEW CODE HERE
   ```
2. Document in comment with XSD reference
3. Use in validator/diagnostic via `createIssue({ code: ISSUE_CODES.YOUR_CODE })`
4. Add test in `tests/` covering both success + failure

### Adding a New Schema Diagnostic
1. **Spec**: Create `docs/specs/feature-name.md`
2. **Code**: Create `src/diagnostics/schemaFeatureDiagnostics.js`
3. **Integration**: Add call to `src/diagnostics/schemaDiagnostics.js`
4. **Tests**: Add `tests/smoke/` or `tests/integration/` tests
5. **API Docs**: Update `API_DOCUMENTATION.md`

### Adding a New XML Validation Rule
1. **Spec**: Create or update spec
2. **Validator**: Add validation logic to `src/validation/validatorName.js`
3. **Integration**: Call from `validateXmlAgainstSchema.js` after structure validation
4. **Issues**: Use issue codes from `ISSUE_CODES`
5. **Tests**: Add integration tests in `tests/integration/`
6. **Streaming**: Consider impact on `src/validation/streamingValidator.js` (checkpoint/resume)

### Debugging Failing Tests
```javascript
// 1. Run specific test
node --test tests/smoke/parseSchema.test.js

// 2. Add diagnostic output
console.log("Schema:", JSON.stringify(schema, null, 2));
console.log("Issues:", result.issues);

// 3. Check issue codes match expectations
result.issues.forEach(i => {
  console.log(`${i.code} at line ${i.line}: ${i.message}`);
});

// 4. Verify XPath/namespace resolution
console.log("Resolved type:", resolveType(schema, typeName));
```

---

## 8. Version Management
- **Current Version**: Read from `src/version.js`
- **Update version** when:
  - Releasing npm package (use `npm version` scripts)
  - API changes (breaking or additive)
  - Major features added (Phase 1, Phase 2, etc.)
- **Version in Results**: All API functions return `version: ENGINE_VERSION`

---

## References
- XSD 1.0 Spec: https://www.w3.org/TR/xmlschema-1/
- XSD 1.1 Spec: https://www.w3.org/TR/xmlschema11-1/
- Node.js test: https://nodejs.org/api/test.html
- esbuild: https://esbuild.github.io/
- @xmldom/xmldom: https://github.com/xmldom/xmldom

---

**Last Updated**: 2026-07-22  
**Maintained By**: uss-xsd-engine maintainers  
**Questions?** Open an issue on GitHub
