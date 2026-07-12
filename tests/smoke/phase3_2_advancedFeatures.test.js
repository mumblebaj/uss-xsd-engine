import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import {
  createAttributeDecl,
  createAttributeGroupDecl,
  createAttributeGroupRef,
  createComplexTypeDecl,
  createElementDecl,
  createEmptySchemaModel,
} from "../../src/model/schemaModel.js";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { validateXmlAgainstSchema } from "../../src/validation/validateXmlAgainstSchema.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";
import { parseXsdDoc } from "../helpers/domCompat.js";

function parseSchemaFromText(xsdText) {
  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  assert.ok(result.schema, "schema model should be built");
  return result.schema;
}

test("phase 3.2: restriction enforces prohibited attribute group members", () => {
  const schema = createEmptySchemaModel();

  schema.globals.attributeGroups["::BaseAttrs"] = createAttributeGroupDecl({
    name: "BaseAttrs",
    attributes: [
      createAttributeDecl({
        name: "legacy",
        use: "optional",
      }),
    ],
  });

  schema.globals.complexTypes["::BaseType"] = createComplexTypeDecl({
    name: "BaseType",
    attributes: [createAttributeGroupRef({ refName: "BaseAttrs" })],
  });

  schema.globals.complexTypes["::DerivedType"] = createComplexTypeDecl({
    name: "DerivedType",
    derivation: { kind: "restriction", baseTypeName: "BaseType" },
    attributes: [createAttributeGroupRef({ refName: "BaseAttrs", use: "prohibited" })],
  });

  schema.globals.elements["::root"] = createElementDecl({
    name: "root",
    typeName: "DerivedType",
  });

  const invalid = validateXmlAgainstSchema(
    schema,
    "<root legacy=\"x\"/>",
    { rootElementName: "root" },
    { DOMParser },
  );

  assert.ok(
    invalid.issues.some((issue) => issue.code === ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE),
    "legacy attribute must be rejected after restriction",
  );

  const valid = validateXmlAgainstSchema(
    schema,
    "<root/>",
    { rootElementName: "root" },
    { DOMParser },
  );

  assert.equal(
    valid.issues.some((issue) => issue.code === ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE),
    false,
  );
});

test("phase 3.2: complex type annotation and schemaVersion are captured", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" version="1.1">
      <xs:complexType name="CustomerType">
        <xs:annotation>
          <xs:documentation xml:lang="en">Customer record type</xs:documentation>
        </xs:annotation>
        <xs:sequence>
          <xs:element name="name" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const customerType = schema.globals.complexTypes["::CustomerType"];

  assert.equal(schema.schemaVersion, "1.1");
  assert.ok(customerType);
  assert.equal(customerType.annotation?.documentation?.text, "Customer record type");
  assert.equal(customerType.annotation?.documentation?.lang, "en");
});

test("phase 3.2: enumeration metadata includes annotation on restriction value", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:simpleType name="StatusType">
        <xs:restriction base="xs:string">
          <xs:enumeration value="ACTIVE">
            <xs:annotation>
              <xs:documentation>Active status</xs:documentation>
            </xs:annotation>
          </xs:enumeration>
          <xs:enumeration value="INACTIVE"/>
        </xs:restriction>
      </xs:simpleType>
    </xs:schema>
  `;

  const schema = parseSchemaFromText(xsd);
  const statusType = schema.globals.simpleTypes["::StatusType"];

  assert.ok(statusType);
  assert.equal(Array.isArray(statusType.enumerations), true);
  assert.equal(statusType.enumerations.length, 2);

  assert.equal(statusType.enumerations[0].value, "ACTIVE");
  assert.equal(
    statusType.enumerations[0].annotation?.documentation?.text,
    "Active status",
  );
  assert.equal(statusType.enumerations[1].value, "INACTIVE");
});
