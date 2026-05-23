# uss-xsd-engine API Documentation

## Overview

`uss-xsd-engine` is a browser-first JavaScript library for processing XML Schema Definition (XSD) files. It provides comprehensive tools for schema diagnostics, tree extraction, sample XML generation, and XML validation against XSD schemas.

## Internal Architecture

The library follows a layered architecture with clear separation of concerns:

### Core Modules

#### Parser (`src/parser/`)
- **`parseXsd.js`**: Parses XSD text into DOM document
- **`buildSchemaModel.js`**: Builds internal schema model from parsed DOM

#### Model (`src/model/`)
- **`schemaModel.js`**: Core schema data structures
- **`schemaQueries.js`**: Query utilities for schema navigation
- **`xsdBuiltin.js`**: Built-in XSD type definitions

#### Diagnostics (`src/diagnostics/`)
- **`schemaDiagnostics.js`**: Main diagnostic runner
- **`schemaDefaultFixedDiagnostics.js`**: Default/fixed value validation
- **`schemaFacetDiagnostics.js`**: Facet constraint validation
- **`schemaImportDiagnostics.js`**: Include/import validation
- **`schemaIdentityConstraintDiagnostics.js`**: Identity constraint diagnostics for `xs:key`, `xs:keyref`, and `xs:unique`
- **`schemaRestrictionDiagnostics.js`**: Restriction validation
- **`validateXml.js`**: XML validation diagnostics
- **`validateXsd.js`**: Schema validation diagnostics
- **`createIssue.js`**: Issue creation utilities
- **`issueCodes.js`**: Standardized issue codes

#### Validation (`src/validation/`)
- **`builtinTypeValidators.js`**: Built-in type validation
- **`facetUtils.js`**: Facet validation utilities
- **`structureValidator.js`**: XML structure validation
- **`identityConstraintValidator.js`**: Identity constraint enforcement during XML validation
- **`validateXmlAgainstSchema.js`**: Main XML validation orchestrator
- **`valueValidator.js`**: Value constraint validation
- **`xmlDiagnostics.js`**: XML parsing diagnostics
- **`xmlSourceMap.js`**: Source mapping for XML

#### Generator (`src/generator/`)
- **`generateXml.js`**: Sample XML generation
- **`sampleValueFactory.js`**: Sample value generation
- **`xmlWriter.js`**: XML output formatting

#### Tree (`src/tree/`)
- **`extractTree.js`**: Schema tree extraction
- **`treeNodeBuilders.js`**: Tree node construction

#### Resolver (`src/resolver/`)
- **`schemaResolvers.js`**: Schema reference resolution

#### Utils (`src/utils/`)
- **`errors.js`**: Error handling utilities
- **`result.js`**: Result object construction
- **`xpathEvaluator.js`**: Simplified XPath evaluation for identity constraint selectors and fields

### Data Flow

1. **Input Processing**: XSD/XML text → DOM parsing
2. **Model Building**: DOM → Internal schema model
3. **Resolution**: Resolve references and external schemas
4. **Diagnostics**: Analyze schema for issues
5. **Validation/Generation**: Process XML or generate samples
6. **Output**: Structured result with issues and data

## Public API

All API functions return a consistent result object:

```javascript
{
  ok: boolean,        // true if no errors
  data: any,          // result data (varies by function)
  issues: Issue[],    // array of diagnostic issues
  summary: {
    errorCount: number,
    warningCount: number,
    infoCount: number
  },
  version: string     // engine version
}
```

### Issue Object Structure

```javascript
{
  code: string,       // unique issue code (e.g., "UNKNOWN_TYPE")
  severity: "error" | "warning" | "info",
  message: string,    // human-readable message
  path?: string,      // XPath-like path in schema/XML
  line?: number,      // line number (1-based)
  column?: number,    // column number (1-based)
  context?: any       // additional context data
}
```

## API Functions

### getSchemaDiagnostics

Analyzes an XSD schema and returns comprehensive diagnostics information.

**Parameters:**
- `xsdText` (string): The XSD schema content as a string
- `options` (object, optional):
  - `includeWarnings` (boolean): Include warning-level issues (default: true)
  - `includeFeatureSummary` (boolean): Include supported/unsupported feature summary
  - `includeRoots` (boolean): Include root element information
  - `externalDocuments` (object): Map of schemaLocation → XSD text for external schemas

**Returns:**
- `data`: Object containing:
  - `roots`: Array of root element names
  - `schemaStats`: Schema statistics (element counts, etc.)
  - `supportedFeatures`: Array of supported XSD features
  - `unsupportedFeatures`: Array of unsupported XSD features

**Example:**
```javascript
import { getSchemaDiagnostics } from 'uss-xsd-engine';

const result = getSchemaDiagnostics({
  xsdText: `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="note" type="xs:string"/>
  </xs:schema>`,
  options: {
    includeWarnings: true,
    externalDocuments: {
      'common.xsd': '...external schema...'
    }
  }
});

if (result.ok) {
  console.log('Schema is valid');
  console.log('Root elements:', result.data.roots);
} else {
  console.log('Issues found:', result.issues);
}
```

### extractSchemaTree

Extracts a hierarchical tree representation of the XSD schema structure.

**Parameters:**
- `xsdText` (string): The XSD schema content
- `options` (object, optional):
  - `externalDocuments` (object): External schema documents

**Returns:**
- `data`: Tree structure representing the schema hierarchy

**Example:**
```javascript
import { extractSchemaTree } from 'uss-xsd-engine';

const result = extractSchemaTree({
  xsdText: schemaText
});

if (result.ok) {
  console.log('Schema tree:', result.data);
}
```

### generateSampleXml

Generates sample XML based on the XSD schema.

**Parameters:**
- `xsdText` (string): The XSD schema content
- `options` (object, optional):
  - `mode` ("minimal" | "full"): Generation mode (default: "minimal")
  - `targetPrefix` (string): Namespace prefix for generated XML (default: "tns")
  - `includeOptionalAttributes` (boolean): Include optional attributes
  - `externalDocuments` (object): External schema documents

**Returns:**
- `data`: Generated XML string

**Example:**
```javascript
import { generateSampleXml } from 'uss-xsd-engine';

const result = generateSampleXml({
  xsdText: schemaText,
  options: {
    mode: 'full',
    targetPrefix: 'example'
  }
});

if (result.ok) {
  console.log('Generated XML:', result.data);
}
```

### validateXml

Validates XML against an XSD schema.

**Parameters:**
- `xsdText` (string): The XSD schema content
- `xmlText` (string): The XML content to validate
- `options` (object, optional):
  - `rootElementName` (string): Expected root element name
  - `externalDocuments` (object): External schema documents

**Returns:**
- `data`: Object containing:
  - `xmlValid` (boolean): Whether the XML is valid
  - `rootElement` (string): Detected root element name
  - Additional validation metadata

**Example:**
```javascript
import { validateXml } from 'uss-xsd-engine';

const result = validateXml({
  xsdText: `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="note">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="to" type="xs:string"/>
          <xs:element name="from" type="xs:string"/>
          <xs:element name="body" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>`,
  xmlText: `<note>
    <to>Alice</to>
    <from>Bob</from>
    <body>Hello!</body>
  </note>`
});

if (result.ok && result.data.xmlValid) {
  console.log('XML is valid against schema');
} else {
  console.log('Validation issues:', result.issues);
}

### Identity Constraint Example

Generates validation issues for `xs:key`, `xs:keyref`, and `xs:unique` constraints.

```javascript
import { validateXml } from 'uss-xsd-engine';

const schemaText = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="catalog">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="book" maxOccurs="unbounded">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="isbn" type="xs:string"/>
              <xs:element name="author" type="xs:string"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:key name="uniqueBook">
        <xs:selector xpath="book"/>
        <xs:field xpath="isbn"/>
      </xs:key>
      <xs:keyref name="authorKeyRef" refer="uniqueBook">
        <xs:selector xpath="book"/>
        <xs:field xpath="isbn"/>
      </xs:keyref>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

const xmlText = `<catalog>
  <book>
    <isbn>978-1</isbn>
    <author>Alice</author>
  </book>
  <book>
    <isbn>978-1</isbn>
    <author>Bob</author>
  </book>
</catalog>`;

const result = validateXml({ xsdText: schemaText, xmlText });

if (!result.ok) {
  console.log('Identity constraint issues:');
  result.issues.forEach((issue) => {
    console.log(`- ${issue.code}: ${issue.message}`);
  });
}
```

## Supported XSD Features

### Schema Processing
- XSD parsing into internal model
- Namespace-aware resolution
- Global elements, types, groups, attribute groups

### Schema Diagnostics
- Unknown types/references detection
- Missing base types
- Restriction validation (subset + occurrence narrowing)
- Facet validation (length, numeric, pattern, enumeration, digits)
- Default/fixed conflict detection
- Include/import diagnostics

### Schema Tree Extraction
- Semantic tree representation
- Expandable references
- UI rendering support

### Sample XML Generation
- Minimal mode (mandatory elements only)
- Full mode (limited expansion)
- Namespace-aware output
- Sequence, choice, extension, restriction support
- Fixed/default value honoring

### XML Validation
- Structure validation (sequence, choice, all, groups)
- Simple/complex content enforcement
- Mixed content handling
- Attribute validation
- Facet validation
- Restriction enforcement
- Identity constraint enforcement for `xs:key`, `xs:keyref`, and `xs:unique`

### Include/Import Support
- `xs:include` and `xs:import` recognition
- External schema provision via `externalDocuments`
- Recursive resolution
- Namespace-aware merging

## Usage Patterns

### Browser Usage
```html
<script src="https://cdn.jsdelivr.net/npm/uss-xsd-engine@latest/dist/uss-xsd-engine.standalone.js"></script>
<script>
  const result = UssXsdEngine.validateXml({
    xsdText: schema,
    xmlText: xml
  });
</script>
```

### Node.js Usage
```javascript
import { validateXml } from 'uss-xsd-engine';

const result = validateXml({ xsdText, xmlText });
```

### External Schemas
```javascript
const externalDocuments = {
  'common.xsd': `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <!-- common types -->
</xs:schema>`,
  'types.xsd': `<!-- more schemas -->`
};

const result = getSchemaDiagnostics({
  xsdText: mainSchema,
  options: { externalDocuments }
});
```

## Common Issue Codes

The library uses standardized issue codes for consistent error reporting:

### Schema Issues
- `XSD_PARSE_ERROR`: Failed to parse XSD document
- `DUPLICATE_GLOBAL_*`: Duplicate global declarations
- `UNKNOWN_TYPE`: Reference to undefined type
- `UNKNOWN_REF`: Reference to undefined element/group
- `MISSING_BASE_TYPE`: Base type not found in restriction/extension
- `INVALID_CONSTRAINT_SELECTOR`: Identity constraint selector XPath syntax invalid
- `INVALID_CONSTRAINT_FIELD`: Identity constraint field XPath syntax invalid
- `UNKNOWN_KEY_REFERENCE`: `xs:keyref` references unknown key
- `DUPLICATE_CONSTRAINT_NAME`: Duplicate identity constraint name in the same scope
- `UNSUPPORTED_FEATURE`: Feature not yet implemented
- `INVALID_OCCURS_RANGE`: Invalid minOccurs/maxOccurs values
- `INVALID_DEFAULT_FIXED_COMBINATION`: Conflicting default/fixed values

### XML Validation Issues
- `XML_PARSE_ERROR`: Failed to parse XML document
- `XML_ROOT_ELEMENT_MISMATCH`: Root element doesn't match schema
- `XML_UNKNOWN_ROOT_ELEMENT`: Root element not defined in schema
- `XML_UNEXPECTED_ELEMENT`: Element not allowed at this position
- `XML_MISSING_REQUIRED_ELEMENT`: Required element missing
- `XML_CHOICE_NOT_SATISFIED`: Choice group requirements not met
- `XML_UNEXPECTED_ATTRIBUTE`: Attribute not allowed
- `XML_MISSING_REQUIRED_ATTRIBUTE`: Required attribute missing
- `XML_INVALID_TEXT_FOR_COMPLEX_TYPE`: Text content not allowed
- `XML_VALUE_INVALID`: Value doesn't match type constraints
- `XML_ENUMERATION_MISMATCH`: Value not in allowed enumeration
- `XML_KEY_VIOLATION`: Duplicate key or unique value violation
- `XML_KEY_NULL_VIOLATION`: Key constraint field value is missing or empty
- `XML_KEYREF_VIOLATION`: Keyref points to a missing reference value
- `XML_UNIQUE_VIOLATION`: Duplicate unique constraint value

### Facet Validation Issues
- `XML_PATTERN_MISMATCH`: Value doesn't match pattern
- `XML_LENGTH_MISMATCH`: Length constraint violated
- `XML_MIN_LENGTH_VIOLATION`: Minimum length not met
- `XML_MAX_LENGTH_VIOLATION`: Maximum length exceeded
- `XML_MIN_INCLUSIVE_VIOLATION`: Value below minimum
- `XML_MAX_INCLUSIVE_VIOLATION`: Value above maximum
- `XML_TOTAL_DIGITS_VIOLATION`: Total digits constraint violated
- `XML_FRACTION_DIGITS_VIOLATION`: Fraction digits constraint violated

### Content Model Issues
- `XML_MIXED_CONTENT_NOT_ALLOWED`: Mixed content not permitted
- `XML_RESTRICTION_VIOLATION`: Restriction constraints violated
- `XML_ALL_DUPLICATE_ELEMENT`: Duplicate element in `xs:all` group
- `XML_CHOICE_MULTIPLE_BRANCHES`: Multiple choice branches selected

## Performance Considerations

- Designed for browser execution
- No heavy dependencies
- Efficient parsing and validation algorithms
- Suitable for real-time schema processing

## Limitations

- Not a complete XSD 1.0/1.1 validator
- Some advanced features still in development
- Identity constraint support is available, but XPath evaluation is intentionally simplified to common selector/field patterns and may not cover full XPath 1.0 semantics
- Streaming validation not implemented

## Examples and Best Practices

### Complete Workflow Example

```javascript
import { getSchemaDiagnostics, validateXml, generateSampleXml } from 'uss-xsd-engine';

// 1. Validate schema
const schemaResult = getSchemaDiagnostics({
  xsdText: schemaText,
  options: { includeWarnings: true }
});

if (!schemaResult.ok) {
  console.error('Schema issues:', schemaResult.issues);
  return;
}

// 2. Generate sample XML
const sampleResult = generateSampleXml({
  xsdText: schemaText,
  options: { mode: 'minimal' }
});

if (sampleResult.ok) {
  console.log('Sample XML:', sampleResult.data);
}

// 3. Validate XML against schema
const validationResult = validateXml({
  xsdText: schemaText,
  xmlText: xmlText
});

console.log('Validation result:', validationResult.ok ? 'Valid' : 'Invalid');
if (!validationResult.ok) {
  validationResult.issues.forEach(issue => {
    console.log(`- ${issue.severity}: ${issue.message}`);
  });
}
```

### Handling External Schemas

```javascript
const externalDocuments = {
  'common.xsd': `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="AddressType">
    <xs:sequence>
      <xs:element name="street" type="xs:string"/>
      <xs:element name="city" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`,
  'types.xsd': `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="CountryCode">
    <xs:restriction base="xs:string">
      <xs:pattern value="[A-Z]{2}"/>
    </xs:restriction>
  </xs:simpleType>
</xs:schema>`
};

const result = validateXml({
  xsdText: mainSchemaText,
  xmlText: xmlText,
  options: { externalDocuments }
});
```

### Error Handling Best Practices

```javascript
function processResult(result) {
  if (result.ok) {
    return result.data;
  }

  // Group issues by severity
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
  }

  // Handle warnings
  if (warnings.length > 0) {
    console.warn('Warnings:', warnings.map(w => w.message));
  }

  return result.data;
}
```

### Performance Tips

- Cache parsed schemas for repeated validation
- Use minimal mode for sample generation when possible
- Provide external documents explicitly rather than relying on auto-resolution
- Validate schemas once, then reuse for multiple XML validations

### Browser Integration

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/uss-xsd-engine@latest/dist/uss-xsd-engine.standalone.js"></script>
</head>
<body>
  <textarea id="xsdInput" placeholder="Paste XSD here"></textarea>
  <textarea id="xmlInput" placeholder="Paste XML here"></textarea>
  <button onclick="validate()">Validate</button>
  <pre id="output"></pre>

  <script>
    function validate() {
      const result = UssXsdEngine.validateXml({
        xsdText: document.getElementById('xsdInput').value,
        xmlText: document.getElementById('xmlInput').value
      });

      document.getElementById('output').textContent = JSON.stringify(result, null, 2);
    }
  </script>
</body>
</html>
```
</content>
<file_path="c:\Users\User\Documents\NodeJs\uss-xsd-engine\API_DOCUMENTATION.md