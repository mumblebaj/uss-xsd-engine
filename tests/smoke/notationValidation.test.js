import test from "node:test";
import assert from "node:assert/strict";
import { buildSchemaModel } from "../../src/parser/buildSchemaModel.js";
import { validateNotationUsage } from "../../src/validation/notationValidator.js";
import { parseXsdDoc } from "../helpers/domCompat.js";

test("buildSchemaModel parses notation declarations", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:notation name="png" public="image/png" system="/images/logo.png"/>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });

  assert.ok(result.schema);
  assert.equal(result.issues.length, 0);
  assert.ok(result.schema.globals.notations["::png"]);
});

test("validateNotationUsage rejects values that do not match notation constraints", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:notation name="png" public="image/png" system="/images/logo.png"/>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  const notation = result.schema.globals.notations["::png"];

  const valid = validateNotationUsage(result.schema, "/images/logo.png", notation);
  const invalid = validateNotationUsage(result.schema, "image/jpeg", notation);

  assert.equal(valid.ok, true);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "XML_NOTATION_VIOLATION");
});

test("buildSchemaModel preserves processing-instruction annotations", () => {
  const xsdText = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="note"><?pi source="generated"?></xs:element>
    </xs:schema>
  `;

  const doc = parseXsdDoc(xsdText);
  const result = buildSchemaModel(doc, { xsdText });
  const decl = result.schema.globals.elements["::note"];

  assert.ok(result.schema);
  assert.ok(decl.annotation);
  assert.equal(decl.annotation.processingInstructions.length, 1);
  assert.equal(decl.annotation.processingInstructions[0].target, "pi");
  assert.equal(decl.annotation.processingInstructions[0].data, "source=\"generated\"");
});
