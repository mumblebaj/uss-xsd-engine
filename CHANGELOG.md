# Changelog

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