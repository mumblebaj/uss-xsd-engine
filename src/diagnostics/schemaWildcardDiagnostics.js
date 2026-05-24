/**
 * Wildcard diagnostics for xs:any and xs:anyAttribute
 * Validates wildcard namespace constraints and processContents directives
 */

import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";

/**
 * Validate wildcard namespace constraint syntax
 * @param {string|null} namespace - Namespace attribute value
 * @param {string} path - XPath in schema
 * @returns {object|null} - Issue if invalid, null if valid
 */
export function validateWildcardNamespace(namespace, path) {
  if (!namespace) return null;
  
  const trimmed = namespace.trim();
  if (!trimmed) return null;
  
  // Valid namespace patterns:
  // - ##any
  // - ##other
  // - ##targetNamespace
  // - Single namespace URI
  // - Space-separated namespace URIs
  const parts = trimmed.split(/\s+/);
  
  for (const part of parts) {
    if (part === "##any" || part === "##other" || part === "##targetNamespace") {
      // Valid special values
      continue;
    }
    
    // Should be a valid namespace URI (URL-like or urn:)
    if (!part.includes(":") && part !== "") {
      return createIssue({
        code: "INVALID_WILDCARD_NAMESPACE",
        severity: "warning",
        message: `Invalid namespace in wildcard constraint: '${part}'. Expected ##any, ##other, ##targetNamespace, or a valid namespace URI.`,
        path
      });
    }
  }
  
  return null;
}

/**
 * Validate processContents directive
 * @param {string|null} processContents - processContents attribute value
 * @param {string} path - XPath in schema
 * @returns {object|null} - Issue if invalid, null if valid
 */
export function validateProcessContents(processContents, path) {
  if (!processContents) return null;
  
  const trimmed = processContents.trim();
  if (trimmed === "strict" || trimmed === "lax" || trimmed === "skip") {
    return null;
  }
  
  return createIssue({
    code: "INVALID_PROCESS_CONTENTS",
    severity: "error",
    message: `Invalid processContents value: '${processContents}'. Must be 'strict', 'lax', or 'skip'.`,
    path
  });
}

/**
 * Validate a single wildcard node (xs:any or xs:anyAttribute)
 * @param {object} wildcardNode - Wildcard node from schema
 * @param {string} nodeName - "any" or "anyAttribute"
 * @returns {object[]} - Array of issues
 */
function validateSingleWildcard(wildcardNode, nodeName) {
  const issues = [];
  
  // Validate namespace constraint
  const nsIssue = validateWildcardNamespace(wildcardNode.namespace, wildcardNode.path);
  if (nsIssue) {
    issues.push(nsIssue);
  }
  
  // Validate processContents directive
  const pcIssue = validateProcessContents(wildcardNode.processContents, wildcardNode.path);
  if (pcIssue) {
    issues.push(pcIssue);
  }
  
  // Validate notNamespace if present
  if (wildcardNode.notNamespace && wildcardNode.notNamespace.length > 0) {
    // notNamespace is only valid for ##other constraint
    if (wildcardNode.namespace !== "##other" && wildcardNode.namespace !== "##targetNamespace") {
      issues.push(
        createIssue({
          code: "INVALID_NOT_NAMESPACE_USAGE",
          severity: "warning",
          message: `notNamespace is only meaningful with ##other or ##targetNamespace namespace constraint.`,
          path: wildcardNode.path
        })
      );
    }
  }
  
  // Validate notQName if present
  if (wildcardNode.notQName && wildcardNode.notQName.length > 0) {
    // notQName should contain valid QNames
    for (const qname of wildcardNode.notQName) {
      // Basic QName validation: should not be empty
      if (!qname || qname.trim() === "") {
        issues.push(
          createIssue({
            code: "INVALID_NOT_QNAME",
            severity: "warning",
            message: `Empty QName in notQName constraint.`,
            path: wildcardNode.path
          })
        );
        break; // Only report once per wildcard
      }
    }
  }
  
  return issues;
}

/**
 * Find all wildcard nodes in a content model recursively
 * @param {object} node - Content model node
 * @param {object[]} wildcards - Array to collect wildcards
 */
function findWildcardsInContent(node, wildcards) {
  if (!node) return;
  
  if (node.kind === "any" || node.kind === "anyAttribute") {
    wildcards.push(node);
    return;
  }
  
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      findWildcardsInContent(child, wildcards);
    }
  }
}

/**
 * Find all wildcard nodes in complex type attributes
 * @param {object[]} attributes - Array of attribute declarations
 * @param {object[]} wildcards - Array to collect wildcards
 */
function findWildcardsInAttributes(attributes, wildcards) {
  if (!attributes || !Array.isArray(attributes)) return;
  
  for (const attr of attributes) {
    if (attr.kind === "anyAttribute") {
      wildcards.push(attr);
    }
  }
}

/**
 * Run wildcard diagnostics on schema
 * @param {object} schema - Parsed schema model
 * @returns {object[]} - Array of issues
 */
export function runWildcardDiagnostics(schema) {
  const issues = [];
  const wildcards = [];
  
  // Find wildcards in global elements with content models
  for (const elem of Object.values(schema.globals.elements || {})) {
    if (elem.inlineType?.content) {
      findWildcardsInContent(elem.inlineType.content, wildcards);
    }
    if (elem.inlineType?.attributes) {
      findWildcardsInAttributes(elem.inlineType.attributes, wildcards);
    }
  }
  
  // Find wildcards in complex types
  for (const complexType of Object.values(schema.globals.complexTypes || {})) {
    if (complexType.content) {
      findWildcardsInContent(complexType.content, wildcards);
    }
    if (complexType.attributes) {
      findWildcardsInAttributes(complexType.attributes, wildcards);
    }
  }
  
  // Find wildcards in groups
  for (const group of Object.values(schema.globals.groups || {})) {
    if (group.content) {
      findWildcardsInContent(group.content, wildcards);
    }
  }
  
  // Validate each wildcard
  for (const wildcard of wildcards) {
    const wildcardIssues = validateSingleWildcard(wildcard, wildcard.kind);
    issues.push(...wildcardIssues);
  }
  
  return issues;
}

