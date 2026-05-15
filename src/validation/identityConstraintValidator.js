import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import { parseQName } from "../resolver/schemaResolvers.js";
import { evaluateSelector as xpathEvaluateSelector, evaluateField as xpathEvaluateField } from "../utils/xpathEvaluator.js";

function localName(node) {
  return node?.localName || node?.nodeName || null;
}

function namespaceUri(node) {
  return node?.namespaceURI || null;
}

// XPath selector/field evaluation is delegated to `src/utils/xpathEvaluator.js`.

function collectOwnerXmlNodes(xmlRoot, ownerName, ownerNamespaceUri) {
  const matches = [];

  function traverse(node) {
    if (!node || node.nodeType !== 1) return;
    if (
      localName(node) === ownerName &&
      (ownerNamespaceUri == null || ownerNamespaceUri === namespaceUri(node))
    ) {
      matches.push(node);
    }
    for (const child of Array.from(node.children || [])) {
      traverse(child);
    }
  }

  traverse(xmlRoot);
  return matches;
}

function getConstraintOwnerNodes(schema, xmlRoot, constraint) {
  if (!constraint.ownerName) {
    return [xmlRoot];
  }

  return collectOwnerXmlNodes(
    xmlRoot,
    constraint.ownerName,
    constraint.ownerNamespaceUri,
  );
}

export function validateIdentityConstraints(schema, xmlRoot, getNodeLocation) {
  const issues = [];
  const keySets = new Map();

  function buildKeySet(constraint) {
    if (keySets.has(constraint.name)) {
      return keySets.get(constraint.name);
    }

    const set = new Set();
    const ownerNodes = getConstraintOwnerNodes(schema, xmlRoot, constraint);

    for (const ownerNode of ownerNodes) {
      const selected = xpathEvaluateSelector(schema, [ownerNode], constraint.selector?.xpath);
      for (const selectedNode of selected) {
        const tuple = constraint.fields.map((field) => xpathEvaluateField(schema, selectedNode, field.xpath));
        set.add(JSON.stringify(tuple));
      }
    }

    keySets.set(constraint.name, set);
    return set;
  }

  for (const constraint of schema.identityConstraints || []) {
    const ownerNodes = getConstraintOwnerNodes(schema, xmlRoot, constraint);
    if (!ownerNodes.length) {
      continue;
    }

    const valueIndex = new Map();
    const referenceKeyConstraint = schema.identityConstraints.find(
      (item) => item.kind === "key" && item.name === parseQName(constraint.refer || "").localName,
    );
    const referenceKeySet =
      constraint.kind === "keyref" && referenceKeyConstraint
        ? buildKeySet(referenceKeyConstraint)
        : null;

    for (const ownerNode of ownerNodes) {
      const selected = xpathEvaluateSelector(schema, [ownerNode], constraint.selector?.xpath);
      for (const selectedNode of selected) {
        const tuple = constraint.fields.map((field) => xpathEvaluateField(schema, selectedNode, field.xpath));
        const tupleKey = JSON.stringify(tuple);
        const rawLocation = getNodeLocation ? getNodeLocation(selectedNode) : null;
        const location = rawLocation || { line: constraint.line || 1, column: constraint.column || 1 };

        if (tuple.some((value) => value == null || value === "")) {
          if (constraint.kind === "key") {
            issues.push(
              createIssue({
                code: ISSUE_CODES.XML_KEY_NULL_VIOLATION,
                severity: "error",
                message: `xs:key '${constraint.name}' requires non-empty values for all fields.`,
                line: location.line,
                column: location.column,
                path: constraint.path,
                source: "xml",
                nodeKind: "element",
                name: constraint.name,
                details: {
                  selector: constraint.selector?.xpath,
                  fields: constraint.fields.map((field) => field.xpath),
                },
              }),
            );
          }
        }

        if (constraint.kind === "key" || constraint.kind === "unique") {
          if (valueIndex.has(tupleKey)) {
            issues.push(
              createIssue({
                code:
                  constraint.kind === "key"
                    ? ISSUE_CODES.XML_KEY_VIOLATION
                    : ISSUE_CODES.XML_UNIQUE_VIOLATION,
                severity: "error",
                message: `Duplicate ${constraint.kind} value for '${constraint.name}'.`,
                line: location.line,
                column: location.column,
                path: constraint.path,
                source: "xml",
                nodeKind: "element",
                name: constraint.name,
                details: {
                  selector: constraint.selector?.xpath,
                  fields: constraint.fields.map((field) => field.xpath),
                },
              }),
            );
          }
          valueIndex.set(tupleKey, true);
        }

        if (constraint.kind === "keyref" && referenceKeySet) {
          if (!referenceKeySet.has(tupleKey)) {
            issues.push(
              createIssue({
                code: ISSUE_CODES.XML_KEYREF_VIOLATION,
                severity: "error",
                message: `xs:keyref '${constraint.name}' references a missing key value.`,
                line: location.line,
                column: location.column,
                path: constraint.path,
                source: "xml",
                nodeKind: "element",
                name: constraint.name,
                details: {
                  refer: constraint.refer,
                  selector: constraint.selector?.xpath,
                  fields: constraint.fields.map((field) => field.xpath),
                },
              }),
            );
          }
        }
      }
    }
  }

  return issues;
}
