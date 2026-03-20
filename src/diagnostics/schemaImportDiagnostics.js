import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";

export function runImportDiagnostics(schema, options = {}) {
  const issues = [];
  const externalDocuments = options.externalDocuments || {};

  for (const ref of schema.externalRefs.includes || []) {
    if (!ref.schemaLocation) continue;
    if (externalDocuments[ref.schemaLocation]) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.XSD_INCLUDE_NOT_PROVIDED,
        severity: "warning",
        message: `Included schema '${ref.schemaLocation}' was referenced but not provided to the engine.`,
        source: "xsd",
        nodeKind: "include",
        name: ref.schemaLocation,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        details: {
          schemaLocation: ref.schemaLocation
        }
      })
    );
  }

  for (const ref of schema.externalRefs.imports || []) {
    if (!ref.schemaLocation) continue;
    if (externalDocuments[ref.schemaLocation]) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.XSD_IMPORT_NOT_PROVIDED,
        severity: "warning",
        message: `Imported schema '${ref.schemaLocation}' was referenced but not provided to the engine.`,
        source: "xsd",
        nodeKind: "import",
        name: ref.schemaLocation,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        details: {
          schemaLocation: ref.schemaLocation,
          namespace: ref.namespace
        }
      })
    );
  }

  return issues;
}