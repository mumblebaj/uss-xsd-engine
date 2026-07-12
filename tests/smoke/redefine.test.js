import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { installDomParserPolyfill, parseXsdDoc } from "../helpers/domCompat.js";

installDomParserPolyfill();

function buildSchemaWithExternalDocs(xsdText, externalDocuments = {}) {
  const doc = parseXsdDoc(xsdText);
  return buildSchemaModel(doc, { xsdText, externalDocuments });
}

function findDeclByName(bucket = {}, name) {
  return Object.values(bucket).find((item) => item?.name === name) || null;
}

test("redefine records external reference", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
               targetNamespace="http://example.com"
               elementFormDefault="qualified">
      <xs:redefine schemaLocation="base.xsd"/>
    </xs:schema>
  `;

  const result = buildSchemaWithExternalDocs(xsdText, {
    "base.xsd": `
      <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                 targetNamespace="http://example.com">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>
    `,
  });

  assert.ok(result.schema);
  assert.equal(result.schema.externalRefs.redefines.length, 1);
  assert.equal(result.schema.externalRefs.redefines[0].schemaLocation, "base.xsd");
});

test("redefine namespace mismatch emits issue", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
               targetNamespace="http://example.com/host">
      <xs:redefine schemaLocation="base.xsd"/>
    </xs:schema>
  `;

  const result = buildSchemaWithExternalDocs(xsdText, {
    "base.xsd": `
      <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                 targetNamespace="http://example.com/different">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>
    `,
  });

  const namespaceErrors = result.issues.filter(
    (issue) => issue.code === "XSD_REDEFINE_NAMESPACE_MISMATCH",
  );

  assert.ok(namespaceErrors.length > 0);
});

test("redefine overrides existing complex type and preserves original", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
               targetNamespace="http://example.com"
               elementFormDefault="qualified">
      <xs:include schemaLocation="base.xsd"/>

      <xs:redefine schemaLocation="base.xsd">
        <xs:complexType name="BaseType">
          <xs:complexContent>
            <xs:restriction base="BaseType">
              <xs:sequence>
                <xs:element name="value" type="xs:string"/>
                <xs:element name="extra" type="xs:int"/>
              </xs:sequence>
            </xs:restriction>
          </xs:complexContent>
        </xs:complexType>
      </xs:redefine>

      <xs:element name="root" type="BaseType"/>
    </xs:schema>
  `;

  const result = buildSchemaWithExternalDocs(xsdText, {
    "base.xsd": `
      <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                 targetNamespace="http://example.com">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>
    `,
  });

  assert.ok(result.schema);
  const baseType = findDeclByName(result.schema.globals.complexTypes, "BaseType");
  assert.ok(baseType);
  assert.equal(baseType.redefined, true);
  assert.ok(baseType.originalDefinition);
});

test("redefine non-existent type emits REDEFINE_INVALID_OVERRIDE", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
               targetNamespace="http://example.com">
      <xs:redefine schemaLocation="base.xsd">
        <xs:complexType name="NonExistentType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:redefine>
    </xs:schema>
  `;

  const result = buildSchemaWithExternalDocs(xsdText, {
    "base.xsd": `
      <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                 targetNamespace="http://example.com">
        <xs:complexType name="ExistingType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>
    `,
  });

  const invalidOverrideErrors = result.issues.filter(
    (issue) => issue.code === "REDEFINE_INVALID_OVERRIDE",
  );

  assert.ok(invalidOverrideErrors.length > 0);
});

test("redefine group override sets redefined marker", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
               targetNamespace="http://example.com">
      <xs:include schemaLocation="base.xsd"/>

      <xs:redefine schemaLocation="base.xsd">
        <xs:group name="ContentGroup">
          <xs:sequence>
            <xs:element name="title" type="xs:string"/>
            <xs:element name="description" type="xs:string"/>
          </xs:sequence>
        </xs:group>
      </xs:redefine>

      <xs:complexType name="Article">
        <xs:sequence>
          <xs:group ref="ContentGroup"/>
          <xs:element name="author" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:schema>
  `;

  const result = buildSchemaWithExternalDocs(xsdText, {
    "base.xsd": `
      <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                 targetNamespace="http://example.com">
        <xs:group name="ContentGroup">
          <xs:sequence>
            <xs:element name="title" type="xs:string"/>
          </xs:sequence>
        </xs:group>
      </xs:schema>
    `,
  });

  assert.ok(result.schema);
  const contentGroup = findDeclByName(result.schema.globals.groups, "ContentGroup");
  assert.ok(contentGroup);
  assert.equal(contentGroup.redefined, true);
});
