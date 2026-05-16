import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";
import { parseQName } from "../resolver/schemaResolvers.js";

function isValidConstraintXPath(xpath) {
  if (!xpath || typeof xpath !== "string") return false;

  const trimmed = xpath.trim();
  if (!trimmed) return false;
  // Allow descendant operator '//' and leading './' shorthand used commonly
  // Normalize leading './' then ensure there are no absolute paths or '///' sequences
  let normalized = trimmed;
  if (trimmed.startsWith("./")) {
    // Preserve leading '//' when using the common './/' shorthand
    if (trimmed.startsWith(".//")) normalized = trimmed.slice(1); // './/a' -> '//a'
    else normalized = trimmed.slice(2); // './a' -> 'a'
  }
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return false; // absolute single-slash paths not allowed
  if (normalized.includes("///")) return false; // too many consecutive slashes

  // Split on one or more slashes to collapse '//' into a single delimiter for validation
  let segments = normalized.split(/\/+/
  );
  // If path starts with '//' the split produces a leading empty segment — drop it
  if (normalized.startsWith("//")) segments = segments.slice(1);
  // If path ends with '//' drop trailing empty segment
  if (normalized.endsWith("//")) segments = segments.slice(0, -1);
  if (segments.some((segment) => segment.length === 0)) return false;

  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "*") continue;
    if (segment.startsWith("@")) {
      const attrName = segment.slice(1);
      if (!/^[A-Za-z_][\w.-]*$/.test(attrName)) return false;
      continue;
    }

    const parsed = parseQName(segment);
    if (!parsed.localName) return false;
  }

  return true;
}

function getConstraintKey(constraint) {
  return `${constraint.ownerPath || ""}::${constraint.name || ""}`;
}

function findReferencedKey(schema, refer) {
  if (!refer) return null;
  const referName = parseQName(refer).localName;
  return schema.identityConstraints.find(
    (constraint) => constraint.kind === "key" && constraint.name === referName,
  );
}

export function runIdentityConstraintDiagnostics(schema) {
  const issues = [];
  const seenNames = new Set();

  for (const constraint of schema.identityConstraints || []) {
    const key = getConstraintKey(constraint);

    if (seenNames.has(key)) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.DUPLICATE_CONSTRAINT_NAME,
          severity: "error",
          message: `Duplicate identity constraint name '${constraint.name}' in the same scope.`,
          line: constraint.line,
          column: constraint.column,
          path: constraint.path,
          source: "xsd",
          nodeKind: constraint.kind,
          name: constraint.name,
          details: {
            ownerPath: constraint.ownerPath,
            ownerName: constraint.ownerName,
          },
        }),
      );
    } else {
      seenNames.add(key);
    }

    if (!constraint.selector || !constraint.selector.xpath) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.INVALID_CONSTRAINT_SELECTOR,
          severity: "error",
          message: `Identity constraint '${constraint.name || constraint.kind}' is missing a selector xpath.`,
          line: constraint.line,
          column: constraint.column,
          path: constraint.path,
          source: "xsd",
          nodeKind: constraint.kind,
          name: constraint.name,
          details: {
            ownerPath: constraint.ownerPath,
            ownerName: constraint.ownerName,
          },
        }),
      );
    } else if (!isValidConstraintXPath(constraint.selector.xpath)) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.INVALID_CONSTRAINT_SELECTOR,
          severity: "error",
          message: `Invalid selector xpath '${constraint.selector.xpath}'.`,
          line: constraint.line,
          column: constraint.column,
          path: constraint.selector.path,
          source: "xsd",
          nodeKind: constraint.kind,
          name: constraint.name,
          details: {
            selector: constraint.selector.xpath,
            ownerPath: constraint.ownerPath,
          },
        }),
      );
    }

    if (!constraint.fields?.length) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.INVALID_CONSTRAINT_FIELD,
          severity: "error",
          message: `Identity constraint '${constraint.name || constraint.kind}' must declare at least one field.`,
          line: constraint.line,
          column: constraint.column,
          path: constraint.path,
          source: "xsd",
          nodeKind: constraint.kind,
          name: constraint.name,
          details: { ownerPath: constraint.ownerPath },
        }),
      );
    } else {
      for (const field of constraint.fields) {
        if (!field.xpath || !isValidConstraintXPath(field.xpath)) {
          issues.push(
            createIssue({
              code: ISSUE_CODES.INVALID_CONSTRAINT_FIELD,
              severity: "error",
              message: `Invalid field xpath '${field.xpath}'.`,
              line: field.line,
              column: field.column,
              path: field.path,
              source: "xsd",
              nodeKind: constraint.kind,
              name: constraint.name,
              details: {
                field: field.xpath,
                ownerPath: constraint.ownerPath,
              },
            }),
          );
        }
      }
    }

    if (constraint.kind === "keyref") {
      if (!constraint.refer) {
        issues.push(
          createIssue({
            code: ISSUE_CODES.UNKNOWN_KEY_REFERENCE,
            severity: "error",
            message: `xs:keyref '${constraint.name || "unnamed"}' is missing a refer attribute.`,
            line: constraint.line,
            column: constraint.column,
            path: constraint.path,
            source: "xsd",
            nodeKind: constraint.kind,
            name: constraint.name,
            details: { ownerPath: constraint.ownerPath },
          }),
        );
      } else if (!findReferencedKey(schema, constraint.refer)) {
        issues.push(
          createIssue({
            code: ISSUE_CODES.UNKNOWN_KEY_REFERENCE,
            severity: "error",
            message: `xs:keyref refers to unknown key '${constraint.refer}'.`,
            line: constraint.line,
            column: constraint.column,
            path: constraint.path,
            source: "xsd",
            nodeKind: constraint.kind,
            name: constraint.name,
            details: {
              refer: constraint.refer,
              ownerPath: constraint.ownerPath,
            },
          }),
        );
      }
    }
  }

  return issues;
}
