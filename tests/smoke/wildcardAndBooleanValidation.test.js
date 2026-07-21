import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { validateXmlAgainstSchema } from "../../src/validation/validateXmlAgainstSchema.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";
import { parseXsdDoc, installDomParserPolyfill } from "../helpers/domCompat.js";

installDomParserPolyfill();
const DOM_PARSER_IMPL = globalThis.DOMParser;

function schemaFromText(xsdText) {
  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  assert.ok(result.schema, "schema model should be built");
  return result.schema;
}

test("xs:any with maxOccurs=unbounded accepts multiple wildcard children in sequence", () => {
  const xsdText = `
    <xs:schema
      xmlns:xs="http://www.w3.org/2001/XMLSchema"
      targetNamespace="urn:test:saa"
      xmlns:saa="urn:test:saa"
      elementFormDefault="qualified">
      <xs:complexType name="SwAny" mixed="true">
        <xs:sequence>
          <xs:any namespace="##any" processContents="skip" minOccurs="0" maxOccurs="unbounded"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="DataPDUType">
        <xs:sequence>
          <xs:element name="Body" type="saa:SwAny" minOccurs="0"/>
        </xs:sequence>
      </xs:complexType>
      <xs:element name="DataPDU" type="saa:DataPDUType"/>
    </xs:schema>
  `;

  const xmlText = `
    <saa:DataPDU xmlns:saa="urn:test:saa">
      <saa:Body>
        <AppHdr xmlns="urn:iso:head"/>
        <Document xmlns="urn:iso:doc"/>
      </saa:Body>
    </saa:DataPDU>
  `;

  const schema = schemaFromText(xsdText);
  const result = validateXmlAgainstSchema(
    schema,
    xmlText,
    { rootElementName: "DataPDU" },
    { DOMParser: DOM_PARSER_IMPL },
  );

  const unexpectedElementIssues = result.issues.filter(
    (issue) => issue.code === ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
  );

  assert.equal(
    unexpectedElementIssues.length,
    0,
    "Wildcard body should accept both AppHdr and Document children",
  );
});

test("non-streaming boolean builtin validation rejects uppercase TRUE", () => {
  const xsdText = `
    <xs:schema
      xmlns:xs="http://www.w3.org/2001/XMLSchema"
      targetNamespace="urn:test:boolean"
      xmlns:t="urn:test:boolean"
      elementFormDefault="qualified">
      <xs:element name="flag" type="xs:boolean"/>
    </xs:schema>
  `;

  const xmlText = `<t:flag xmlns:t="urn:test:boolean">TRUE</t:flag>`;

  const schema = schemaFromText(xsdText);
  const result = validateXmlAgainstSchema(
    schema,
    xmlText,
    { rootElementName: "flag" },
    { DOMParser: DOM_PARSER_IMPL },
  );

  assert.ok(
    result.issues.some((issue) => issue.code === ISSUE_CODES.XML_VALUE_INVALID),
    "Uppercase TRUE must be rejected for xs:boolean",
  );
});

test("boolean validation is enforced inside selected xs:choice branch", () => {
  const xsdText = `
    <xs:schema
      xmlns:xs="http://www.w3.org/2001/XMLSchema"
      targetNamespace="urn:test:choice"
      xmlns:t="urn:test:choice"
      elementFormDefault="qualified">
      <xs:complexType name="BranchA">
        <xs:sequence>
          <xs:element name="flag" type="xs:boolean"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="HeaderType">
        <xs:choice>
          <xs:element name="A" type="t:BranchA"/>
          <xs:element name="B" type="xs:string"/>
        </xs:choice>
      </xs:complexType>
      <xs:element name="root" type="t:HeaderType"/>
    </xs:schema>
  `;

  const xmlText = `
    <t:root xmlns:t="urn:test:choice">
      <t:A>
        <t:flag>TRUE</t:flag>
      </t:A>
    </t:root>
  `;

  const schema = schemaFromText(xsdText);
  const result = validateXmlAgainstSchema(
    schema,
    xmlText,
    { rootElementName: "root" },
    { DOMParser: DOM_PARSER_IMPL },
  );

  assert.ok(
    result.issues.some((issue) => issue.code === ISSUE_CODES.XML_VALUE_INVALID),
    "Uppercase TRUE inside a matched choice branch must be rejected",
  );
});
