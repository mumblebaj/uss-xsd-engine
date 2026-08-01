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

test("phase 5.6: substitution-group chains validate through intermediate members", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
      targetNamespace="urn:test:phase56"
      xmlns:t="urn:test:phase56"
      elementFormDefault="qualified">
      <xs:element name="head" type="xs:string"/>
      <xs:element name="mid" substitutionGroup="t:head" type="xs:string"/>
      <xs:element name="leaf" substitutionGroup="t:mid" type="xs:string"/>
      <xs:element name="root">
        <xs:complexType>
          <xs:sequence>
            <xs:element ref="t:head"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  `;

  const schema = schemaFromText(xsdText);
  const result = validateXmlAgainstSchema(
    schema,
    `<t:root xmlns:t="urn:test:phase56"><t:leaf>value</t:leaf></t:root>`,
    { rootElementName: "root" },
    { DOMParser: DOM_PARSER_IMPL },
  );

  assert.equal(result.issues.length, 0, "substitution-group chain members should validate like the head element");
});

test("phase 5.6: unexpected attributes are still rejected when no wildcard permits them", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
      targetNamespace="urn:test:phase56-attr"
      xmlns:t="urn:test:phase56-attr"
      elementFormDefault="qualified">
      <xs:complexType name="TypeA">
        <xs:attribute name="id" type="xs:string"/>
      </xs:complexType>
      <xs:element name="root" type="t:TypeA"/>
    </xs:schema>
  `;

  const schema = schemaFromText(xsdText);
  const result = validateXmlAgainstSchema(
    schema,
    `<t:root xmlns:t="urn:test:phase56-attr" extra="value"/>`,
    { rootElementName: "root" },
    { DOMParser: DOM_PARSER_IMPL },
  );

  assert.ok(
    result.issues.some((issue) => issue.code === ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE),
    "unexpected attributes should still be reported when no wildcard allows them",
  );
});
