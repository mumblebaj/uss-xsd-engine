import { createIssue } from "./createIssue.js";

function checkDefaultFixedConflict(node, issues) {
  if (node.defaultValue != null && node.fixedValue != null) {
    issues.push(
      createIssue({
        code: "XSD_DEFAULT_AND_FIXED_CONFLICT",
        severity: "warning",
        message: "Element/attribute cannot have both 'default' and 'fixed'.",
        source: "xsd",
        nodeKind: node.kind,
        name: node.name || node.refName,
        line: node.line,
        column: node.column
      })
    );
  }
}

export function runDefaultFixedDiagnostics(schema) {
  const issues = [];

  for (const el of Object.values(schema.globals.elements || {})) {
    checkDefaultFixedConflict(el, issues);
  }

  for (const type of Object.values(schema.globals.complexTypes || {})) {
    for (const attr of type.attributes || []) {
      if (attr.kind === "attribute") {
        checkDefaultFixedConflict(attr, issues);
      }
    }
  }

  return issues;
}