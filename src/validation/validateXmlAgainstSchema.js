import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveGlobalElement,
  resolveType,
} from "../resolver/schemaResolvers.js";
import {
  validateAttributes,
  validateContentModel,
} from "./structureValidator.js";
import {
  validateElementValue,
  validateAttributeValue,
} from "./valueValidator.js";
import { parseXmlWithDiagnostics } from "./xmlDiagnostics.js";
import { createXmlSourceLocator } from "./xmlSourceMap.js";

function elementChildren(xmlNode) {
  return Array.from(xmlNode?.children || []).filter(
    (child) => child.nodeType === 1,
  );
}

function localName(node) {
  return node?.localName || node?.nodeName || null;
}

function namespaceUri(node) {
  return node?.namespaceURI || null;
}

function determineRootElement(schema, xmlRootName, xmlRootNs, options) {
  if (options.rootElementName) {
    return resolveGlobalElement(schema, options.rootElementName);
  }

  const candidates = Object.values(schema?.globals?.elements || {});
  return (
    candidates.find(
      (decl) =>
        decl.name === xmlRootName &&
        (decl.namespaceUri || null) === (xmlRootNs || null),
    ) ||
    candidates.find(
      (decl) =>
        decl.name === xmlRootName &&
        (decl.namespaceUri == null || decl.namespaceUri === ""),
    ) ||
    null
  );
}

function diagnosticsToIssues(diagnostics = []) {
  return diagnostics.map((diagnostic) =>
    createIssue({
      code: ISSUE_CODES.XML_PARSE_ERROR,
      severity: diagnostic?.severity || "error",
      message: diagnostic?.message || "Failed to parse XML.",
      line:
        Number.isFinite(diagnostic?.line) && diagnostic.line > 0
          ? diagnostic.line
          : 1,
      column:
        Number.isFinite(diagnostic?.column) && diagnostic.column > 0
          ? diagnostic.column
          : 1,
      source: diagnostic?.source || "xml",
    }),
  );
}

function toLocationFields(location) {
  return {
    line: location?.line ?? null,
    column: location?.column ?? null,
  };
}

export function validateXmlAgainstSchema(
  schema,
  xmlText,
  options = {},
  helpers = {},
) {
  const xmlParse = parseXmlWithDiagnostics(xmlText, "xml", {
    DOMParser: helpers.DOMParser || options.DOMParser,
  });

  const parseIssues = diagnosticsToIssues(xmlParse.diagnostics || []);

  if (!xmlParse.document) {
    return {
      data: { xmlValid: false },
      issues: parseIssues,
    };
  }

  const locator = createXmlSourceLocator(xmlText, xmlParse.document);

  const xmlRoot = xmlParse.document.documentElement;
  const xmlRootName = localName(xmlRoot);
  const xmlRootNs = namespaceUri(xmlRoot);
  const issues = [...parseIssues];

  if (!xmlRoot) {
    return {
      data: { xmlValid: false },
      issues: [
        ...issues,
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: "XML document has no document element.",
          line: 1,
          column: 1,
          source: "xml",
        }),
      ],
    };
  }

  const schemaRoot = determineRootElement(
    schema,
    xmlRootName,
    xmlRootNs,
    options,
  );

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
        ...toLocationFields(locator.getNodeLocation(xmlRoot)),
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: { xmlRootName, xmlRootNamespace: xmlRootNs },
      }),
    );

    return {
      data: { xmlValid: false },
      issues,
    };
  }

  if ((schemaRoot.name || schemaRoot.refName) !== xmlRootName) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH,
        severity: "error",
        message: `Expected XML root '${schemaRoot.name || schemaRoot.refName}' but found '${xmlRootName}'.`,
        ...toLocationFields(locator.getNodeLocation(xmlRoot)),
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: {
          expectedRoot: schemaRoot.name || schemaRoot.refName,
          actualRoot: xmlRootName,
        },
      }),
    );

    return {
      data: { xmlValid: false },
      issues,
    };
  }

  if (
    schemaRoot.namespaceUri &&
    xmlRootNs &&
    schemaRoot.namespaceUri !== xmlRootNs
  ) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH,
        severity: "error",
        message: "XML root namespace does not match schema root namespace.",
        ...toLocationFields(locator.getNodeLocation(xmlRoot)),
        source: "xml",
        nodeKind: "element",
        name: xmlRootName,
        details: {
          expectedNamespace: schemaRoot.namespaceUri,
          actualNamespace: xmlRootNs,
        },
      }),
    );

    return {
      data: { xmlValid: false },
      issues,
    };
  }

  const context = {
    schema,
    issues,
    createIssue,
    ISSUE_CODES,
    validateElementValue,
    validateAttributeValue,
    resolveAttributeGroup: helpers.resolveAttributeGroup,
    getNodeLocation: locator.getNodeLocation,
    getAttributeLocation: locator.getAttributeLocation,
    getAttributeValueLocation: locator.getAttributeValueLocation,
    getTextValueLocation: locator.getTextValueLocation,
    currentXmlNode: xmlRoot,
  };

  const resolvedRootType =
    resolveType(schema, schemaRoot.typeName) || schemaRoot.inlineType;

  if (resolvedRootType?.kind === "complexType") {
    const rootContext = {
      ...context,
      pathParts: [xmlRootName],
      currentComplexType: resolvedRootType,
      currentXmlNode: xmlRoot,
    };

    validateAttributes(
      xmlRoot,
      getEffectiveAttributes(schema, resolvedRootType),
      rootContext,
    );

    const hasDirectText = Array.from(xmlRoot.childNodes || []).some(
      (node) => node.nodeType === 3 && node.nodeValue?.trim(),
    );

    // Detect simpleContent
    const isSimpleContent =
      resolvedRootType?.contentModel === "simple" &&
      resolvedRootType?.derivation?.baseTypeName;

    // Handle simpleContent text validation
    if (isSimpleContent) {
      const textValue = (xmlRoot.textContent || "").trim();
      const children = elementChildren(xmlRoot);

      if (children.length > 0) {
        for (const childNode of children) {
          const childName = localName(childNode);

          issues.push(
            createIssue({
              code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
              severity: "error",
              message: `Unexpected element '${childName}'.`,
              ...toLocationFields(locator.getNodeLocation(childNode)),
              path: `/${xmlRootName}/${childName}`,
              source: "xml",
              nodeKind: "element",
              name: childName,
              details: {
                namespaceUri: namespaceUri(childNode),
              },
            }),
          );
        }
      }

      if (!textValue) {
        issues.push(
          createIssue({
            code: ISSUE_CODES.XML_VALUE_REQUIRED,
            severity: "error",
            message: "Element requires a value.",
            ...toLocationFields(
              locator.getTextValueLocation(xmlRoot) ||
                locator.getNodeLocation(xmlRoot),
            ),
            path: `/${xmlRootName}`,
            source: "xml",
            nodeKind: "element",
            name: xmlRootName,
            details: {},
          }),
        );
      } else {
        const valueResult = validateElementValue(
          schema,
          { ...schemaRoot, typeName: resolvedRootType.derivation.baseTypeName },
          textValue,
        );

        if (!valueResult.ok) {
          issues.push(
            createIssue({
              code: ISSUE_CODES[valueResult.code] || valueResult.code,
              severity: "error",
              message: valueResult.message,
              ...toLocationFields(
                locator.getTextValueLocation(xmlRoot) ||
                  locator.getNodeLocation(xmlRoot),
              ),
              path: `/${xmlRootName}`,
              source: "xml",
              nodeKind: "element",
              name: xmlRootName,
              details: {},
            }),
          );
        }
      }
    }

    // Only enforce mixed-content rule for true complex content
    else if (!resolvedRootType.mixed && hasDirectText) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_MIXED_CONTENT_NOT_ALLOWED,
          severity: "error",
          message: "Mixed text content is not allowed for this complex type.",
          ...toLocationFields(
            locator.getTextValueLocation(xmlRoot) ||
              locator.getNodeLocation(xmlRoot),
          ),
          path: `/${xmlRootName}`,
          source: "xml",
          nodeKind: "element",
          name: xmlRootName,
          details: {},
        }),
      );
    }

    const children = elementChildren(xmlRoot);
    const content =
      resolvedRootType?.kind === "complexType"
        ? getEffectiveContent(schema, resolvedRootType)
        : null;

    if (content) {
      const result = validateContentModel(
        children,
        content,
        rootContext,
        [xmlRootName],
        0,
        false,
      );

      if (result.nextIndex < children.length) {
        for (let i = result.nextIndex; i < children.length; i += 1) {
          const childNode = children[i];
          const childName = localName(childNode);

          issues.push(
            createIssue({
              code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
              severity: "error",
              message: `Unexpected element '${childName}'.`,
              ...toLocationFields(locator.getNodeLocation(childNode)),
              path: `/${xmlRootName}/${childName}`,
              source: "xml",
              nodeKind: "element",
              name: childName,
              details: {
                namespaceUri: namespaceUri(childNode),
              },
            }),
          );
        }
      }
    }
  } else {
    const valueResult = validateElementValue(
      schema,
      schemaRoot,
      (xmlRoot.textContent || "").trim(),
    );
    if (!valueResult.ok) {
      issues.push(
        createIssue({
          code: ISSUE_CODES[valueResult.code] || valueResult.code,
          severity: "error",
          message: valueResult.message,
          ...toLocationFields(
            locator.getTextValueLocation(xmlRoot) ||
              locator.getNodeLocation(xmlRoot),
          ),
          path: `/${xmlRootName}`,
          source: "xml",
          nodeKind: "element",
          name: xmlRootName,
          details: {},
        }),
      );
    }
  }

  return {
    data: {
      xmlValid: !issues.some((issue) => issue.severity === "error"),
    },
    issues,
  };
}
