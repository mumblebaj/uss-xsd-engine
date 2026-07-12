import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { createEmptySchemaModel, createElementDecl, createIdentityConstraint } from "../../src/model/schemaModel.js";
import { validateXmlAgainstSchema } from "../../src/validation/validateXmlAgainstSchema.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";

test("runtime identity constraint validation: multi-field key and unique detection", () => {
  const schema = createEmptySchemaModel();
  schema.globals.elements["::orders"] = createElementDecl({ name: "orders", namespaceUri: null, identityConstraints: [], path: "/schema/element" });

  // key composed of order/@id and order/item/@sku
  const key = createIdentityConstraint({
    kind: "key",
    name: "orderKey",
    selector: { xpath: "order", path: "/schema/element/key/selector" },
    fields: [
      { xpath: "@id", line: 1, column: 1, path: "/schema/element/key/field[1]" },
      { xpath: "item/@sku", line: 1, column: 1, path: "/schema/element/key/field[2]" },
    ],
    ownerName: "orders",
    ownerPath: "/schema/element",
  });

  const unique = createIdentityConstraint({
    kind: "unique",
    name: "skuUnique",
    selector: { xpath: "order/item", path: "/schema/element/unique/selector" },
    fields: [{ xpath: "@sku", line: 1, column: 1, path: "/schema/element/unique/field" }],
    ownerName: "orders",
    ownerPath: "/schema/element",
  });

  schema.identityConstraints.push(key, unique);

  const xmlText = `<?xml version="1.0"?>\n<orders>\n  <order id="1">\n    <item sku="A"/>\n  </order>\n  <order id="2">\n    <item sku="A"/>\n  </order>\n</orders>`;

  const res = validateXmlAgainstSchema(schema, xmlText, { rootElementName: "orders" }, { DOMParser });
  const codes = res.issues.map((i) => i.code);
  // Expect unique violation for sku 'A'
  assert.ok(codes.includes(ISSUE_CODES.XML_UNIQUE_VIOLATION), `Expected XML_UNIQUE_VIOLATION in ${JSON.stringify(codes)}`);
});

test("runtime identity constraint validation: namespace-aware QName matching", () => {
  const schema = createEmptySchemaModel();
  // create a namespaced root element declaration in schema
  schema.globals.elements["http://example.com/ns::root"] = createElementDecl({ name: "root", namespaceUri: "http://example.com/ns", identityConstraints: [], path: "/schema/element" });

  const key = createIdentityConstraint({
    kind: "key",
    name: "nsKey",
    selector: { xpath: "ns:item", path: "/schema/element/key/selector" },
    fields: [{ xpath: "@id", line: 1, column: 1, path: "/schema/element/key/field" }],
    ownerName: "root",
    ownerNamespaceUri: "http://example.com/ns",
    ownerPath: "/schema/element",
  });

  schema.identityConstraints.push(key);

  const xmlText = `<?xml version='1.0'?>\n<ns:root xmlns:ns='http://example.com/ns'>\n  <ns:item id='x'/>\n  <ns:item id='x'/>\n</ns:root>`;

  const res = validateXmlAgainstSchema(schema, xmlText, {}, { DOMParser });
  const codes = res.issues.map((i) => i.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_KEY_VIOLATION), `Expected XML_KEY_VIOLATION in ${JSON.stringify(codes)}`);
});
