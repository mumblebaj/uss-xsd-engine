import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";

function normalizeSchemaPath(value) {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function getSchemaPathBasename(value) {
  const normalized = normalizeSchemaPath(value);
  if (!normalized) return null;

  const parts = normalized.split("/");
  return parts[parts.length - 1] || null;
}

function getExternalDocumentEntries(externalDocuments) {
  return Object.entries(externalDocuments || {}).map(([key, text]) => ({
    key,
    normalizedKey: normalizeSchemaPath(key),
    basename: getSchemaPathBasename(key),
    text,
  }));
}

function getDeclaredTargetNamespaceFromText(xsdText) {
  if (typeof xsdText !== "string" || !xsdText.trim()) {
    return null;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xsdText, "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) return null;

    const root = doc?.documentElement || null;
    if (!root || root.localName !== "schema") return null;

    return root.hasAttribute("targetNamespace")
      ? root.getAttribute("targetNamespace")
      : null;
  } catch {
    return null;
  }
}

function hasMatchingExternalDocument(ref, externalDocuments) {
  const entries = getExternalDocumentEntries(externalDocuments);
  const requestedLocation = ref?.schemaLocation || null;
  const normalizedRequestedLocation = normalizeSchemaPath(requestedLocation);
  const requestedBasename = getSchemaPathBasename(requestedLocation);

  if (
    requestedLocation &&
    Object.prototype.hasOwnProperty.call(externalDocuments, requestedLocation)
  ) {
    return true;
  }

  if (
    normalizedRequestedLocation &&
    entries.some((entry) => entry.normalizedKey === normalizedRequestedLocation)
  ) {
    return true;
  }

  if (
    requestedBasename &&
    entries.some((entry) => entry.basename === requestedBasename)
  ) {
    return true;
  }

  if (ref?.kind === "import" && ref.namespace) {
    return entries.some((entry) => {
      const declaredTargetNamespace = getDeclaredTargetNamespaceFromText(
        entry.text,
      );
      return (declaredTargetNamespace || null) === (ref.namespace || null);
    });
  }

  return false;
}

export function runImportDiagnostics(schema, options = {}) {
  const issues = [];
  const externalDocuments = options.externalDocuments || {};

  for (const ref of schema.externalRefs.includes || []) {
    if (!ref.schemaLocation) continue;
    if (hasMatchingExternalDocument(ref, externalDocuments)) continue;

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
          schemaLocation: ref.schemaLocation,
        },
      }),
    );
  }

  for (const ref of schema.externalRefs.imports || []) {
    if (!ref.schemaLocation) continue;
    if (hasMatchingExternalDocument(ref, externalDocuments)) continue;

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
          namespace: ref.namespace,
        },
      }),
    );
  }

  return issues;
}