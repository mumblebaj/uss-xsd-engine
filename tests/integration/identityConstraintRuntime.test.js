import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { createEmptySchemaModel, createElementDecl, createIdentityConstraint } from "../../src/model/schemaModel.js";
import { validateXmlAgainstSchema } from "../../src/validation/validateXmlAgainstSchema.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";

test("runtime identity constraint validation: keyref missing reference", () => {
  const schema = createEmptySchemaModel();

  // register a global element 'books' so resolver can find the root
  schema.globals.elements["::books"] = createElementDecl({
    name: "books",
    namespaceUri: null,
    identityConstraints: [],
    path: "/schema/element",
  });

  const key = createIdentityConstraint({
    kind: "key",
    name: "bookKey",
    selector: { xpath: "book", path: "/schema/element/key/selector" },
    fields: [{ xpath: "@id", line: 1, column: 1, path: "/schema/element/key/field" }],
    ownerName: "books",
    ownerNamespaceUri: null,
    ownerPath: "/schema/element",
    line: 1,
    column: 1,
    path: "/schema/element/key",
  });

  const keyref = createIdentityConstraint({
    kind: "keyref",
    name: "bookRef",
    selector: { xpath: "ref", path: "/schema/element/keyref/selector" },
    fields: [{ xpath: "@ref", line: 1, column: 1, path: "/schema/element/keyref/field" }],
    refer: "bookKey",
    ownerName: "books",
    ownerNamespaceUri: null,
    ownerPath: "/schema/element",
    line: 1,
    column: 1,
    path: "/schema/element/keyref",
  });

  schema.identityConstraints.push(key, keyref);

  const xmlText = `<?xml version="1.0"?>\n<books>\n  <book id="1"/>\n  <ref ref="2"/>\n</books>`;

  const res = validateXmlAgainstSchema(schema, xmlText, { rootElementName: "books" }, { DOMParser });
  const codes = res.issues.map((i) => i.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_KEYREF_VIOLATION), `Expected XML_KEYREF_VIOLATION in ${JSON.stringify(codes)}`);
});
