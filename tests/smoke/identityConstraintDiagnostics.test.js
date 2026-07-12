import test from "node:test";
import assert from "node:assert/strict";
import { runIdentityConstraintDiagnostics } from "../../src/diagnostics/schemaIdentityConstraintDiagnostics.js";

const baseSchema = {
  identityConstraints: [
    {
      kind: "key",
      name: "bookKey",
      selector: { xpath: "book", path: "/schema/element/key/selector" },
      fields: [{ xpath: "@id", line: 1, column: 1, path: "/schema/element/key/field" }],
      refer: null,
      ownerName: "books",
      ownerNamespaceUri: null,
      ownerPath: "/schema/element",
      line: 1,
      column: 1,
      path: "/schema/element/key",
    },
  ],
};

test("runs identity constraint diagnostics for missing selector", () => {
  const schema = {
    identityConstraints: [
      {
        kind: "key",
        name: "missingSelector",
        selector: null,
        fields: [{ xpath: "@id", line: 1, column: 1, path: "/schema/element/key/field" }],
        refer: null,
        ownerName: "books",
        ownerNamespaceUri: null,
        ownerPath: "/schema/element",
        line: 1,
        column: 1,
        path: "/schema/element/key",
      },
    ],
  };

  const issues = runIdentityConstraintDiagnostics(schema);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "INVALID_CONSTRAINT_SELECTOR");
});

test("runs identity constraint diagnostics for duplicate names", () => {
  const schema = {
    identityConstraints: [
      { ...baseSchema.identityConstraints[0], name: "duplicate" },
      { ...baseSchema.identityConstraints[0], name: "duplicate", path: "/schema/element/key[2]" },
    ],
  };

  const issues = runIdentityConstraintDiagnostics(schema);
  assert.ok(issues.some((issue) => issue.code === "DUPLICATE_CONSTRAINT_NAME"));
});

test("runs identity constraint diagnostics for missing keyref reference", () => {
  const schema = {
    identityConstraints: [
      {
        kind: "keyref",
        name: "missingKeyRef",
        selector: { xpath: "book", path: "/schema/element/keyref/selector" },
        fields: [{ xpath: "@id", line: 1, column: 1, path: "/schema/element/keyref/field" }],
        refer: "bookKey",
        ownerName: "books",
        ownerNamespaceUri: null,
        ownerPath: "/schema/element",
        line: 1,
        column: 1,
        path: "/schema/element/keyref",
      },
    ],
  };

  const issues = runIdentityConstraintDiagnostics(schema);
  assert.ok(issues.some((issue) => issue.code === "UNKNOWN_KEY_REFERENCE"));
});
