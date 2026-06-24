import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
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
