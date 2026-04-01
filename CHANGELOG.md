# Changelog

## [0.1.0-rc.2]

## Critical Fix

### 1. Fix: Imported schea `targetNamespace` incorrectly resolved as empty

#### Problem
Imported schemas (`xs:import`) were beig built with

```JavaScript
_overrideTargetNamespace: undefined
```
Because the property existed, this logic:
```JavaScript
if (hasOwnProperty("_overrideTargetNamespace"))
```
forced the engine to use `undefined` instead of the actual:
```XML
targetNamespace="..."
```

#### Symptoms
- `XSD_IMPORT_NAMESPACE_MISMATCH`
- Imported namespace reported as `''` or null
- All cross-namespace resolution failed

#### Fix
Only apply `_overrideTargetNamespace` when needed (chameleon include):

```JavaScript
...(shouldApplyChameleonInclude
  ? { _overrideTargetNamespace: schema.targetNamespace }
  : {})
```

#### Result
- Imported schemas retain correct namespace
- Namespace comparison works correctly
- Import resolution behaves per XSD spec

### 2. Fix: Imported schemas not participating in type resolution

#### Problem
Even when imports were parsed, they were not reliabily available during resolution because:
* Namespace was broken (see fix #1)
* Imported schemas were not properly useable in resolver

#### Fix
Ensure imported schemas are preserved and traversed via:

```JavaScript
schema.importSchemas
```
and resolved via:

```JavaScript
lookupInImportedSchemas(...)
```

#### Result
* Cross-namespace type resolution works
* `xs:extension base="ns:Type"` resolves correctly
* Deep schema graphs now function

### 3. Fix: False namespace mismatch error

#### Problem
Namespace comparison logic:

```JavaScript
declaredNs === importedNs
```
was failing due to `importedNs` being `undefined`

#### Result after fix
* Correct namespace comparison
* No false mismatch errors
* Proper XSD import semantics

## Behavioral Improvements

### Proper seperationof `xs:include` vs `xs:import`

|Feature	|Behavior |
|:-|:-:|
|`xs:include`	|Merges globals into host schema|
|`xs:import`	|Registers schema in `importedSchemas`|

#### Why this matters
* Includes = same namespace → merge
* Imports = different namesapce → isolate + resolve

#### Result
* Standards-compliant schema composition
* Correct namesapce isolation
* Scalable multi-schema support

### Recursive schema graph resolution
Engine now correctly supports:
* multi-level imports
* chained extensions
* cross-file type inheritance

Example now supported:

```XML
A → imports B
B → imports C
C → defines BaseType
A → extends BaseType
```

## Impact

### Before
* Imports appeared loaded but unusable
* Namespace mismatches
* Base types unresolved
* Large schemas failed

### After
* Imports fully functional
* Namespace-aware resolution working
* Complex schema sets supported
* Sample XML generation works across imports

## Breaking / Important Usage Notes

### 1. External documents must be provided
Imports require explicit external schema input:

```JavaScript
getSchemaDiagnostics({
  xsdText,
  options: {
    externalDocuments: {
      "EnterpriseMessage-1.0.xsd": "...schema text..."
    }
  }
});
```

#### Important
* Key must match `schemaLocation`
* Case-sensitive
* No automatic fetching

### 2. Correct API usage (object-based)

#### Correct

```JavaScript
getSchemaDiagnostics({
  xsdText,
  options: {
    externalDocuments
  }
});
```

#### Incorrect

```JavaScript
getSchemaDiagnostics(xsdText, options)
```

### 3. All engine calls must receive externalDocuments
For consistency:

```JavaScript
extractSchemaTree({ xsdText, options })
generateSampleXml(xsdText, options)
validateXml(xsdText, xmlText, options)
```
Always pass the same `externalDocuments`


## [0.1.0-rc.1]

## 🎉 Release Candidate

This marks the first Release Candidate (RC) of `uss-xsd-engine` — a browser-first XML Schema (XSD) engine designed for validation, tooling, and developer workflows.

This is release locks in the functionality. This will remain in RC for 2 weeks.

Any feedback or issues during this phase will be greatly appreciated.

### ✨ Highlights
- ✅ Browser-first architecture (no heavy dependencies)
- ✅ XSD parsing into internal schema model
- ✅ XML validation against XSD
- ✅ Sample XML generation
- ✅ Schema tree extraction
- ✅ Schema diagnostics support

### 🧠 Advanced Features
- Namespace-aware resolution and validation
- Namespace-aware sample XML generation
- Mixed content handling
- Extension support (`xs:extension`)
- Restriction enforcement (pass 2)
- Facet/value validation
- Recursive include/import handling (caller-provided schemas)
- Attribute and value-level validation
- Source-mapped diagnostics (line/column support)

```JavaScript
getSchemaDiagnostics(...)
extractSchemaTree(...)
generateSampleXml(...)
validateXml(...)
```

### ⚠️ Stability

This is a Release Candidate:

- Core APIs are considered stable
- No breaking changes are expected before `v0.1.0`
- Minor fixes and improvements may still occur


### 🚧 Known limitations (current scope)
- Identity constraints (`xs:key`, `xs:keyref`, `xs:unique`) not yet supported
- Advanced wildcard handling (`xs:any`, `xs:anyAttribute`) partial
- Some deep restriction edge cases still under refinement

## 🙌 Feedback

Early feedback is welcome — especially around:

- large/complex schemas
- namespace-heavy use cases
- performance observations

## [0.1.0-beta.5]

## 🧪 uss-xsd-engine v0.1.0-beta.5

This release introduces significant improvements to XML validation correctness and sample XML generation, particularly for real-world financial schemas such as ISO 20022 (CBPR+).

### ✨ Highlights
`simpleContent` Support (Major Enhancement)
* Added full support for `xs:complexType/xs:simpleContent`
* Correctly validates elements that:
  * contain text content derived from a base simple type
  * include attributes via `xs:extension`
* Fixes validation issues for common financial patterns such as:

```XML
<IntrBkSttlmAmt Ccy="ZAR">123.45</IntrBkSttlmAmt>
```

#### Improved XML Validation Semantics
* Correct handling of text content for:
  * `simpleContent` (allowed and validated)
  * non-mixed complex types (text correctly rejected)
* Eliminates false positives for:
  * `XML_MIXED_CONTENT_NOT_ALLOWED` on valid simpleContent elements

---

### 🧬 Sample XML Generation Improvements
`simpleContent` Generation
Complex types using `simpleContent` now generate:
text values (from base simple type)
attributes
Example improvement:

```XML
<!-- Before -->
<IntrBkSttlmAmt Ccy="ZAR"/>

<!-- After -->
<IntrBkSttlmAmt Ccy="ZAR">123.45</IntrBkSttlmAmt>
```

* Minimal Mode Enhancements
* Prevents empty complex elements when content exists
* Generates a representative child path when:
  * all children are optional
  * minimal mode would otherwise produce empty nodes
* Example:

```XML
<!-- Before -->
<Dbtr/>

<!-- After -->
<Dbtr>
  <Nm>example</Nm>
</Dbtr>
```

---

### 🧪 Validation Improvements
* Enhanced consistency between:
  * root-level validation
  * nested structure validation (`structureValidator`)
* Unified handling of:
  * text nodes
  * element content rules
* Improved attribute + value validation alignment

---

### Real-World Schema Compatibility

Validated against:

* ISO 20022 CBPR+ `pacs.008.001.08`

Key improvements:

* Amount + currency handling (`simpleContent`)
* Pattern validation (e.g. UETR)
* Numeric facet enforcement (`fractionDigits`, `totalDigits`)
* Complex structure traversal

---

### Internal Improvements
* Added `contentModel` tracking to schema model (`simple` vs `complex`)
* Improved consistency across:
  * parser
  * resolver
  * validator
  * generator

---

<details>

<summary>XSD Engine Evolution (Validation, Source Mapping, Namespaces)</summary>

## [0.1.0-beta.4] — XSD Engine Evolution (Validation, Source Mapping, Namespaces)

### 🚀 Major Enhancements

#### XML Validation Improvements

* Added **accurate line/column support for XML parse errors**
* Integrated parser diagnostics into validation pipeline (`validateXml`)
* XML parsing now returns structured diagnostics instead of raw parser output

#### Semantic Validation Source Mapping

* Added **line/column support for schema validation issues**
* Validation errors now map to:

  * unexpected elements → element location
  * missing required elements → parent/container location
  * root mismatches → root element location
* Enables Monaco editor navigation (click → jump to location)

#### Attribute & Value-Level Precision

* Introduced fine-grained source mapping:

  * attribute errors → attribute name position
  * attribute value violations → value position
  * simple type violations → text content position
* Improved UX for debugging XML validation issues

---

### 🌐 Namespace Awareness (Tree + Sample XML)

#### Schema Tree Extraction

* Added `namespaceUri` to all tree nodes
* Tree labels now reflect namespace context:

  * avoids ambiguity across multiple schemas
  * supports multi-schema visualisation
* Enables future namespace-aware tooling in USS

#### Sample XML Generation

* Introduced **namespace-aware XML output**
* Added dynamic namespace prefix mapping:

  * root schema → `tns` (or configurable prefix)
  * imported schemas → `ns1`, `ns2`, etc.
* Generated XML now correctly reflects:

  * multiple namespaces
  * cross-schema element origins

---

### 🔁 Recursive Include/Import Resolution

* Implemented **recursive schema resolution**
* External schemas now resolved transitively:

  * A → B → C (fully supported)
* Added circular reference protection using visited tracking
* Eliminates false:

  * unknown types
  * unresolved references
* Maintains browser-first design (no network fetching)

---

### 🧠 Internal Improvements

* Removed unused `SUPPORTED_NODE_FEATURES` (dead code cleanup)
* Improved separation of concerns:

  * parsing
  * diagnostics
  * validation
  * source mapping
* Strengthened consistency of issue creation pipeline

---

### ⚡ Developer Experience

* Engine now provides **fully navigable validation diagnostics**
* Improved reliability when integrating with:

  * Monaco editor
  * USS Studio
* More predictable behavior in multi-schema environments

---

### 🧩 Foundations for Next Phase

This release prepares the engine for:

* Namespace-aware import enforcement (strict mode)
* Advanced multi-schema validation
* Enhanced USS UI features (highlighting, navigation, quick-fix suggestions)

---

## 📝 Notes

* No breaking API changes
* Existing methods remain stable:

  * `getSchemaDiagnostics`
  * `extractSchemaTree`
  * `generateSampleXml`
  * `validateXml`

---

## 🔜 Next Planned Milestone

* Namespace-aware import enforcement (strict mode)
* Improved schema boundary validation
* Prefix-aware diagnostics

---

</details>