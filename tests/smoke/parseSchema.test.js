import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { validateResolvedValue } from "../../src/validation/valueValidator.js";
import { parseXsdDoc } from "../helpers/domCompat.js";

test("buildSchemaModel parses simple schema globals", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="note" type="xs:string"/>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });

  assert.ok(result.schema);
  assert.equal(result.issues.length, 0);
  assert.ok(result.schema.globals.elements["::note"]);
  assert.equal(result.schema.roots.length, 1);
  assert.equal(result.schema.roots[0].name, "note");
});

test("buildSchemaModel tracks schema version", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" version="1.1">
      <xs:element name="status" type="xs:string"/>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });

  assert.ok(result.schema);
  assert.equal(result.schema.schemaVersion, "1.1");
});

test("buildSchemaModel parses compound simple types for list and union", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:simpleType name="fruitList">
        <xs:list itemType="xs:integer"/>
      </xs:simpleType>
      <xs:simpleType name="statusOrCode">
        <xs:union memberTypes="xs:integer xs:date"/>
      </xs:simpleType>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });

  assert.ok(result.schema);
  assert.equal(result.issues.length, 0);

  const fruitList = result.schema.globals.simpleTypes["::fruitList"];
  const statusOrCode = result.schema.globals.simpleTypes["::statusOrCode"];

  assert.ok(fruitList);
  assert.equal(fruitList.kind, "simpleType");
  assert.equal(fruitList.contentKind, "list");
  assert.equal(fruitList.itemType, "xs:integer");

  assert.ok(statusOrCode);
  assert.equal(statusOrCode.kind, "simpleType");
  assert.equal(statusOrCode.contentKind, "union");
  assert.deepEqual(statusOrCode.memberTypes, ["xs:integer", "xs:date"]);
});

test("validateResolvedValue supports list and union simple types", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:simpleType name="fruitList">
        <xs:list itemType="xs:integer"/>
      </xs:simpleType>
      <xs:simpleType name="statusOrCode">
        <xs:union memberTypes="xs:integer xs:date"/>
      </xs:simpleType>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  const schema = result.schema;

  const validList = validateResolvedValue(schema, schema.globals.simpleTypes["::fruitList"], "1 2");
  const invalidList = validateResolvedValue(schema, schema.globals.simpleTypes["::fruitList"], "1 apple");
  const validUnion = validateResolvedValue(schema, schema.globals.simpleTypes["::statusOrCode"], "42");
  const validUnionDate = validateResolvedValue(schema, schema.globals.simpleTypes["::statusOrCode"], "2024-01-01");
  const invalidUnion = validateResolvedValue(schema, schema.globals.simpleTypes["::statusOrCode"], "ready");

  assert.equal(validList.ok, true);
  assert.equal(invalidList.ok, false);
  assert.equal(validUnion.ok, true);
  assert.equal(validUnionDate.ok, true);
  assert.equal(invalidUnion.ok, false);
});
