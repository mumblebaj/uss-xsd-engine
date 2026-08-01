import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { installDomParserPolyfill, parseXsdDoc } from "../helpers/domCompat.js";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { validateXmlAgainstSchema } from "../../src/validation/validateXmlAgainstSchema.js";
import { extractSchemaTree } from "../../src/api/extractSchemaTree.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";

installDomParserPolyfill();

function parseSchemaFromText(xsdText) {
  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  assert.ok(result.schema, "schema model should be built");
  return result.schema;
}

test("phase 5.4: abstract elements are rejected when used as concrete instance content", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="head" type="xs:string" abstract="true"/>
      <xs:element name="root">
        <xs:complexType>
          <xs:sequence>
            <xs:element ref="head"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const result = validateXmlAgainstSchema(
    schema,
    "<root><head>value</head></root>",
    { rootElementName: "root" },
    { DOMParser },
  );

  assert.ok(
    result.issues.some((issue) => issue.code === ISSUE_CODES.XML_ABSTRACT_ELEMENT),
    "abstract elements should be rejected in instance validation",
  );
});

test("phase 5.4: substitution-group members validate where the head element is expected", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="head" type="xs:string"/>
      <xs:element name="member" substitutionGroup="head" type="xs:string"/>
      <xs:element name="root">
        <xs:complexType>
          <xs:sequence>
            <xs:element ref="head"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const result = validateXmlAgainstSchema(
    schema,
    "<root><member>value</member></root>",
    { rootElementName: "root" },
    { DOMParser },
  );

  assert.equal(result.issues.length, 0, "substitution-group members should validate like the head element");
});

test("phase 5.5: schema tree extraction exposes annotation metadata", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="root">
        <xs:annotation>
          <xs:documentation>Root element</xs:documentation>
          <xs:appinfo>generated</xs:appinfo>
        </xs:annotation>
        <xs:complexType>
          <xs:sequence>
            <xs:element name="child" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const treeResult = extractSchemaTree({ xsdText: xsd });

  assert.ok(treeResult.ok);
  assert.ok(treeResult.data?.tree?.[0]);
  assert.equal(treeResult.data.tree[0].annotation?.documentation?.text, "Root element");
  assert.equal(treeResult.data.tree[0].annotation?.appinfo?.text, "generated");
});

test("phase 5.4: final types block extension or restriction derivation", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:complexType name="Base" final="extension restriction">
        <xs:sequence>
          <xs:element name="value" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="Derived">
        <xs:complexContent>
          <xs:extension base="Base">
            <xs:sequence>
              <xs:element name="extra" type="xs:string"/>
            </xs:sequence>
          </xs:extension>
        </xs:complexContent>
      </xs:complexType>
      <xs:element name="root" type="Derived"/>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const result = validateXmlAgainstSchema(
    schema,
    "<root><value>ok</value><extra>more</extra></root>",
    { rootElementName: "root" },
    { DOMParser },
  );

  assert.ok(
    result.issues.some((issue) => issue.code === ISSUE_CODES.XML_FINAL_TYPE_VIOLATION),
    "final types should be rejected when a blocked derivation is attempted",
  );
});
