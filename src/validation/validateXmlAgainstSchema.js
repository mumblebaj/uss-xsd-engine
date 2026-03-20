import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import {
  getEffectiveAttributes,
  resolveGlobalElement,
  resolveType
} from "../resolver/schemaResolvers.js";
import { validateAttributes, validateContentModel } from "./structureValidator.js";
import { validateAttributeValue, validateElementValue } from "./valueValidator.js";

function elementChildren(xmlNode) {
  return Array.from(xmlNode?.children || []).filter((child) => child.nodeType === 1);
}

function localName(node) {
  return node?.localName || node?.nodeName || null;
}

function namespaceUri(node) {
  return node?.namespaceURI || null;
}

function parseXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return {
      ok: false,
      doc: null,
      issues: [
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: parserError.textContent?.trim() || "Failed to parse XML.",
          source: "xml"
        })
      ]
    };
  }

  return { ok: true, doc, issues: [] };
}

function determineRootElement(schema, xmlRootName, options) {
  if (options.rootElementName) {
    return resolveGlobalElement(schema, options.rootElementName);
  }
  return resolveGlobalElement(schema, xmlRootName);
}

export function validateXmlAgainstSchema(schema, xmlText, options = {}, helpers = {}) {
  const xmlParse = parseXml(xmlText);
  if (!xmlParse.ok || !xmlParse.doc) {
    return {
      data: { xmlValid: false },
      issues: xmlParse.issues
    };
  }

  const xmlRoot = xmlParse.doc.documentElement;
  const xmlRootName = localName(xmlRoot);
  const xmlRootNs = namespaceUri(xmlRoot);
  const issues = [...xmlParse.issues];

  if (!xmlRoot) {
    return {
      data: { xmlValid: false },
      issues: [
        ...issues,
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: "XML document has no document element.",
          source: "xml"
        })
      ]
    };
  }

  const schemaRoot = determineRootElement(schema, xmlRootName, options);

  if (!schemaRoot) {
    issues.push(
      createIssue({
        code: options.rootElementName
          ? ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH
          : ISSUE_CODES.XML_UNKNOWN_ROOT_ELEMENT,
        severity: "error",
        message: options.rootElementName
          ? `XML root '${xmlRootName}' does not match requested schema root '${options.rootElementName}'.`
          : `No matching global schema root found for XML root '${xmlRootName}'.`,
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: { xmlRootName, xmlRootNamespace: xmlRootNs }
      })
    );

    return {
      data: { xmlValid: false },
      issues
    };
  }

  if ((schemaRoot.name || schemaRoot.refName) !== xmlRootName) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH,
        severity: "error",
        message: `Expected XML root '${schemaRoot.name || schemaRoot.refName}' but found '${xmlRootName}'.`,
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: {
          expectedRoot: schemaRoot.name || schemaRoot.refName,
          actualRoot: xmlRootName
        }
      })
    );

    return {
      data: { xmlValid: false },
      issues
    };
  }

  if (schemaRoot.namespaceUri && xmlRootNs && schemaRoot.namespaceUri !== xmlRootNs) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH,
        severity: "error",
        message: "XML root namespace does not match schema root namespace.",
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: {
          expectedNamespace: schemaRoot.namespaceUri,
          actualNamespace: xmlRootNs
        }
      })
    );

    return {
      data: { xmlValid: false },
      issues
    };
  }

  const context = {
    schema,
    issues,
    createIssue,
    ISSUE_CODES,
    validateElementValue,
    validateAttributeValue,
    resolveAttributeGroup: helpers.resolveAttributeGroup
  };

  const resolvedRootType = resolveType(schema, schemaRoot.typeName) || schemaRoot.inlineType;

  if (resolvedRootType?.kind === "complexType") {
    validateAttributes(xmlRoot, getEffectiveAttributes(schema, resolvedRootType), {
      ...context,
      pathParts: [xmlRootName]
    });

    const children = elementChildren(xmlRoot);
    const content = resolvedRootType ? resolvedRootType.content || null : null;

    if (content) {
      const result = validateContentModel(children, content, context, [xmlRootName], 0, false);
      if (result.nextIndex < children.length) {
        for (let i = result.nextIndex; i < children.length; i += 1) {
          const childName = localName(children[i]);
          issues.push(
            createIssue({
              code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
              severity: "error",
              message: `Unexpected element '${childName}'.`,
              path: `/${xmlRootName}/${childName}`,
              source: "xml",
              nodeKind: "element",
              name: childName,
              details: {
                namespaceUri: namespaceUri(children[i])
              }
            })
          );
        }
      }
    }
  }
  else {
    const valueResult = validateElementValue(schema, schemaRoot, (xmlRoot.textContent || "").trim());
    if (!valueResult.ok) {
      issues.push(
        createIssue({
          code: ISSUE_CODES[valueResult.code] || valueResult.code,
          severity: "error",
          message: valueResult.message,
          path: `/${xmlRootName}`,
          source: "xml",
          nodeKind: "element",
          name: xmlRootName,
          details: {}
        })
      );
    }
  }

  return {
    data: {
      xmlValid: !issues.some((issue) => issue.severity === "error")
    },
    issues
  };
}