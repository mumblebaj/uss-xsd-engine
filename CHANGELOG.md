# Changelog

## [0.2.0]

## Identity Constraints Support ⭐

### Summary
Full support for XML identity constraints with runtime validation, including `xs:key`, `xs:keyref`, and `xs:unique`.

The engine now validates identity constraints at both schema-definition time and XML runtime, enabling proper enforcement of uniqueness and foreign-key-like relationships in XML documents.

### What Changed

#### Playground & Version Fixes
- Added a cache-busting bundle loader to `playground.html` so the browser always loads the latest `dist/uss-xsd-engine.standalone.js` build.
- Updated runtime engine version propagation to match `package.json` v0.2.0.

#### Identity Constraint Types
Full support for three constraint categories:

1. **`xs:unique`** - Ensures field values are unique within selected elements
2. **`xs:key`** - Ensures field values are unique and non-null (candidate key)
3. **`xs:keyref`** - Ensures field values reference existing key values (foreign key)

#### Schema Validation
New diagnostics detect constraint definition issues:

- `INVALID_CONSTRAINT_SELECTOR`: Invalid selector XPath syntax
- `INVALID_CONSTRAINT_FIELD`: Invalid field XPath syntax
- `UNKNOWN_KEY_REFERENCE`: keyref refers to non-existent key
- `DUPLICATE_CONSTRAINT_NAME`: Multiple constraints with same name in scope

#### XML Runtime Validation
Runtime validation now detects:

- `XML_KEY_VIOLATION`: Duplicate key value found
- `XML_KEY_NULL_VIOLATION`: Key field has null/missing value
- `XML_KEYREF_VIOLATION`: keyref value not found in referenced key
- `XML_UNIQUE_VIOLATION`: Duplicate value in unique constraint

Violations include precise line/column locations in error messages.

#### XPath Support for Constraints
New XPath evaluator supports a practical subset of XPath sufficient for identity constraints:

**Supported features:**
- Relative paths: `element`, `element/subelement`, `@attribute`
- Predicates (numeric): `element[1]`, `element[2]`
- Predicates (attribute): `element[@attr='value']`
- Wildcards: `element/*`, `*/@attr`
- Axes: `child::`, `descendant::`, `@` (attribute axis)
- **NEW:** Descendant-or-self operator: `//` (e.g., `.//item`, `.//data/value`)
- Namespace-aware QName matching with prefix resolution

**Namespace handling:**
- Dual fallback resolution (schema context + node context)
- Compatible with both standard DOM and xmldom polyfill (Node.js)
- Proper prefix resolution for namespaced elements

#### Multi-Field Constraints
Constraints can now validate tuples of values:

```XML
<xs:key name="ProductKey">
  <xs:selector xpath=".//product"/>
  <xs:field xpath="category"/>
  <xs:field xpath="@id"/>
</xs:key>
```

This validates that the combination of `category` and `@id` is unique.

### Example

#### Schema Definition
```XML
<xs:schema>
  <xs:element name="warehouse">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="product" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="sku" type="xs:string"/>
              <xs:element name="desc" type="xs:string"/>
            </xs:sequence>
            <xs:attribute name="id" type="xs:ID"/>
          </xs:complexType>
        </xs:element>
        <xs:element name="order" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="lineItem" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:attribute name="productRef" type="xs:IDREF"/>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>

    <!-- Each product must have unique SKU -->
    <xs:unique name="uniqueSku">
      <xs:selector xpath=".//product"/>
      <xs:field xpath="sku"/>
    </xs:unique>

    <!-- product IDs are candidate keys -->
    <xs:key name="productKey">
      <xs:selector xpath=".//product"/>
      <xs:field xpath="@id"/>
    </xs:key>

    <!-- orderline productRef must reference product IDs -->
    <xs:keyref name="productRef" refer="productKey">
      <xs:selector xpath=".//lineItem"/>
      <xs:field xpath="@productRef"/>
    </xs:keyref>
  </xs:element>
</xs:schema>
```

#### XML Validation
```XML
<warehouse>
  <product id="P1"><sku>ABC123</sku></product>
  <product id="P2"><sku>ABC123</sku></product>  <!-- ❌ Duplicate SKU -->
  <order>
    <lineItem productRef="P3"/>  <!-- ❌ P3 not in product keys -->
  </order>
</warehouse>
```

Result: Both violations detected with line/column information.

### Internal Changes

**Files Created:**
- `src/utils/xpathEvaluator.js` - XPath expression evaluator (330+ lines)
- `src/diagnostics/schemaIdentityConstraintDiagnostics.js` - Schema-level constraint validation
- `src/validation/identityConstraintValidator.js` - XML runtime constraint validation

**Files Modified:**
- `src/model/schemaModel.js` - Added `identityConstraints` array to schema model
- `src/parser/buildSchemaModel.js` - Added identity constraint parsing (lines 699+)
- `src/diagnostics/issueCodes.js` - Added 8 new issue codes for constraints
- `src/diagnostics/schemaDiagnostics.js` - Integrated constraint diagnostics
- `src/validation/validateXmlAgainstSchema.js` - Integrated runtime constraint validation
- `src/validation/xmlSourceMap.js` - Added node location tracking for constraints

**Tests Added:**
- `tests/smoke/identityConstraintDiagnostics.test.js` - Schema-level diagnostic tests (3 tests)
- `tests/integration/identityConstraintRuntime.test.js` - Runtime validation tests (2 tests)
- `tests/integration/identityConstraint_multi.test.js` - Multi-field constraint tests (1 test)

### Impact

- Enables validation of uniqueness and referential integrity in XML documents
- Proper XSD 1.0 specification compliance for identity constraints
- Supports real-world XML schema patterns
- No performance degradation (validation only runs on valid structural XML)

### Backwards Compatibility

- ✅ No breaking changes
- ✅ Fully backwards compatible
- ✅ Existing API unchanged
- ✅ New functionality is additive only

---

## [0.1.1]

## Enhanced External Schema Resolution (Import/Include)

### Summary
Improved how `uss-xsd-engine` resolves external schemas referenced via `xs:import` and `xs:include`.

The engine no longer relies solely on exact `schemaLocation` matching and now supports more flexible, real-world schema usage patterns.

### What Changed
#### `xs:import` Resolution Improvements

External schemas are now resolved using the following priority:

1. Exact `schemaLocation` match
2. Normalized path match (handles `\` vs `/`, duplicate slashes, etc.)
3. Filename (basename) match
4. Namespace match (`targetNamespace`) ← ⭐ NEW

This means:

If the `schemaLocation` does not match exactly, the engine will attempt to resolve the schema based on its declared `targetNamespace`.
This aligns with how `xs:import` is intended to work (namespace-driven).

### Ambiguity Handling

If multiple provided schemas share the same `targetNamespace`:

- The engine will raise a diagnostic
- It will not guess which schema to use

### `xs:include` Behavior

`xs:include` remains stricter:

Exact / normalized / basename matching supported
Namespace fallback not applied (by design)

### WHY this change
Previously, users had to match exact file paths like:

```XML
../../../../shared/.../MySchema.xsd
```

Now you can simply provide:

```JavaScript
externalDocuments = {
  "MySchema.xsd": "...",
}
```

...and the engine will correctly resolve imports using the namespace matching.

### Example

#### Before

```XML
<xs:import
  namespace="http://example.com/schema/MySchema/1.0"
  schemaLocation="../../../../shared/.../MySchema.xsd"/>
```

```JavaScript
externalDocuments = {
  "MySchema.xsd": "...",
}
```
Result: Import not provided

#### After
Same input:

```JavaScript
externalDocuments = {
  "MySchema.xsd": "...",
}
```
Result: Successfully resolved via `targetNamespace`

### Internal Changes
* Enhanced resolver in buildSchemaModel.js
* Updated diagnostics in schemaImportDiagnostics.js
* Removed strict dependency on schemaLocation as sole lookup key

### Impact
* Works with real-world schema packs (no folder reconstruction needed)
* Better browser-based usage (USS, etc.)
* Standards-aligned `xs:import` handling
* Improved developer experience

### Backwards Compatibility
* No breaking changes
* Existing exact-path behavior still supported


<details>

<summary>Update XML Generation</summary>

## [0.1.0]

## Update XML Generation

### Enhancements
- Fixed namespace declaration handling in generated XML (all used namespaces now correctly emitted at root)
- Improved namespace resolution across imported schemas
- Enhanced sample XML generation to traverse deeper into imported complex types
- Fixed unprefixed type resolution across same-namespace imports (prevents premature fallback to `example`)
- More realistic sample output for multi-schema, real-world XSD structures

### Improvements
- Better handling of cross-namespace element/type resolution
- More stable and consistent sample generation for complex schema graphs
- Maintained lightweight, browser-first architecture without over-engineering

### Result
- Sample XML is now structurally closer to real-world payloads
- Works reliably with deeply nested, multi-import XSDs
- Provides a stronger baseline for further manual or UI-driven expansion

</details>

<details>

<summary>Fix: Imported schea `targetNamespace` incorrectly resolved as empty</summary>

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

</details>

<details>

<summary>Release Candidate</summary>

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

</details>

<details>

<summary>XML Validation Correctness and Sample Generation</summary>

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

</details>

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