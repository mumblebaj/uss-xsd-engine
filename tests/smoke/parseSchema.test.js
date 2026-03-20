import test from "node:test";
import assert from "node:assert/strict";

import { parseSchema } from "../../src/index.js";

// Replace this import with whichever DOMParser implementation
// you decide to use in your local test setup.
import { DOMParser } from "@xmldom/xmldom";

const result = validateValueAgainstSimpleType(
  schemaModel,
  "Max35Text",
  "THIS VALUE IS DEFINITELY LONGER THAN THIRTY FIVE CHARACTERS",
  { path: "/Document/Cdtr/Nm" }
);

console.log(result);

test("parseSchema returns ok result for non-empty XSD string", () => {
  const xsd = `
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="note" type="xs:string"/>
    </xs:schema>
  `;

  const result = parseSchema(xsd, { DOMParser });

  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.ok(result.schemaModel);
  assert.ok(result.schemaModel.elements instanceof Map);
  assert.ok(Array.isArray(result.schemaModel.rootElements));
  assert.equal(result.schemaModel.rootElements.length, 1);
});