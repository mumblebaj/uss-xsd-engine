/**
 * Wildcard validation for xs:any and xs:anyAttribute
 * Matches elements/attributes against namespace constraints and processContents directives
 */

/**
 * Check if a namespace matches a wildcard namespace constraint
 * @param {string|null} elementNamespace - Element's namespace URI
 * @param {string|null} wildcardNamespace - Wildcard namespace constraint
 * @param {string|null} targetNamespace - Schema's target namespace
 * @returns {boolean} - True if matches
 */
export function namespaceMatches(elementNamespace, wildcardNamespace, targetNamespace) {
  if (!wildcardNamespace) return true;
  
  // ##any matches any namespace
  if (wildcardNamespace === "##any") return true;
  
  // ##targetNamespace matches target namespace
  if (wildcardNamespace === "##targetNamespace") {
    return elementNamespace === targetNamespace;
  }
  
  // ##other matches any namespace except target
  if (wildcardNamespace === "##other") {
    return elementNamespace !== targetNamespace;
  }
  
  // Array of namespaces - check if element's namespace is in the list
  if (Array.isArray(wildcardNamespace)) {
    return wildcardNamespace.includes(elementNamespace);
  }
  
  // Exact namespace match
  return elementNamespace === wildcardNamespace;
}

/**
 * Check if a name is excluded by notNamespace constraint
 * @param {string|null} elementNamespace - Element's namespace URI
 * @param {string[]} notNamespace - List of excluded namespaces
 * @returns {boolean} - True if excluded
 */
export function isExcludedByNotNamespace(elementNamespace, notNamespace) {
  if (!notNamespace || notNamespace.length === 0) return false;
  return notNamespace.includes(elementNamespace);
}

/**
 * Check if a QName is excluded by notQName constraint
 * @param {string} qName - QName to check
 * @param {string[]} notQName - List of excluded QNames
 * @returns {boolean} - True if excluded
 */
export function isExcludedByNotQName(qName, notQName) {
  if (!notQName || notQName.length === 0) return false;
  return notQName.includes(qName);
}

/**
 * Build QName from local name and namespace
 * @param {string} localName - Element/attribute local name
 * @param {string|null} namespaceUri - Element/attribute namespace URI
 * @returns {string} - QName representation
 */
export function buildQName(localName, namespaceUri) {
  if (!namespaceUri || namespaceUri === "") {
    return localName;
  }
  return `{${namespaceUri}}${localName}`;
}

/**
 * Check if an element matches a wildcard constraint
 * @param {string} elementLocalName - Local name of the element
 * @param {string|null} elementNamespace - Namespace of the element
 * @param {object} wildcardNode - xs:any node from schema
 * @param {string|null} targetNamespace - Schema's target namespace
 * @returns {boolean} - True if element matches wildcard
 */
export function elementMatchesWildcard(
  elementLocalName,
  elementNamespace,
  wildcardNode,
  targetNamespace
) {
  if (!wildcardNode || wildcardNode.kind !== "any") {
    return false;
  }
  
  // Check namespace constraint
  if (!namespaceMatches(elementNamespace, wildcardNode.namespace, targetNamespace)) {
    return false;
  }
  
  // Check notNamespace exclusion
  if (isExcludedByNotNamespace(elementNamespace, wildcardNode.notNamespace)) {
    return false;
  }
  
  // Check notQName exclusion
  const qName = buildQName(elementLocalName, elementNamespace);
  if (isExcludedByNotQName(qName, wildcardNode.notQName)) {
    return false;
  }
  
  return true;
}

/**
 * Check if an attribute matches a wildcard constraint
 * @param {string} attrLocalName - Local name of the attribute
 * @param {string|null} attrNamespace - Namespace of the attribute
 * @param {object} wildcardNode - xs:anyAttribute node from schema
 * @param {string|null} targetNamespace - Schema's target namespace
 * @returns {boolean} - True if attribute matches wildcard
 */
export function attributeMatchesWildcard(
  attrLocalName,
  attrNamespace,
  wildcardNode,
  targetNamespace
) {
  if (!wildcardNode || wildcardNode.kind !== "anyAttribute") {
    return false;
  }
  
  // Check namespace constraint
  if (!namespaceMatches(attrNamespace, wildcardNode.namespace, targetNamespace)) {
    return false;
  }
  
  // Check notNamespace exclusion
  if (isExcludedByNotNamespace(attrNamespace, wildcardNode.notNamespace)) {
    return false;
  }
  
  // Check notQName exclusion
  const qName = buildQName(attrLocalName, attrNamespace);
  if (isExcludedByNotQName(qName, wildcardNode.notQName)) {
    return false;
  }
  
  return true;
}

/**
 * Determine how to handle wildcard content based on processContents directive
 * @param {string|null} processContents - "strict", "lax", or "skip"
 * @returns {string} - Normalized processContents value
 */
export function normalizeProcessContents(processContents) {
  if (processContents === "lax" || processContents === "skip") {
    return processContents;
  }
  return "strict";
}

/**
 * Check if wildcard validation should be strict
 * @param {string|null} processContents - "strict", "lax", or "skip"
 * @returns {boolean} - True if strict validation is required
 */
export function isStrictWildcardValidation(processContents) {
  return normalizeProcessContents(processContents) === "strict";
}

/**
 * Check if wildcard validation should be skipped
 * @param {string|null} processContents - "strict", "lax", or "skip"
 * @returns {boolean} - True if validation should be completely skipped
 */
export function shouldSkipWildcardValidation(processContents) {
  return normalizeProcessContents(processContents) === "skip";
}
