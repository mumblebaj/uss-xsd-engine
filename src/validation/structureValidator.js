import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveElementType,
  resolveGlobalElement,
  resolveGroup
} from "../resolver/schemaResolvers.js";

function elementChildren(xmlNode) {
  return Array.from(xmlNode?.children || []).filter((child) => child.nodeType === 1);
}

function textContentTrimmed(xmlNode) {
  return (xmlNode?.textContent || "").trim();
}

function localName(node) {
  return node?.localName || node?.nodeName || null;
}

function repeatMin(minOccurs) {
  return typeof minOccurs === "number" ? minOccurs : 1;
}

function repeatMax(maxOccurs) {
  return maxOccurs === "unbounded" ? Infinity : maxOccurs;
}

function matchesElementDecl(xmlNode, elementDecl) {
  const xmlName = localName(xmlNode);
  const declName = elementDecl.refName || elementDecl.name;
  return xmlName === declName;
}

function buildXmlPath(pathParts) {
  return "/" + pathParts.join("/");
}

export function validateAttributes(xmlNode, attributes, context) {
  const { schema, createIssue, ISSUE_CODES, issues, pathParts, validateAttributeValue } = context;
  const allowed = new Map();

  for (const attr of attributes || []) {
    if (!attr) continue;

    if (attr.kind === "attribute") {
      const attrName = attr.name || attr.refName;
      if (attrName) {
        allowed.set(attrName, attr);
      }
    }
    else if (attr.kind === "attributeGroupRef") {
      const group = context.resolveAttributeGroup?.(attr.refName);
      if (!group) continue;
      validateAttributes(xmlNode, group.attributes || [], context);
    }
  }

  for (const attrDecl of allowed.values()) {
    const attrName = attrDecl.name || attrDecl.refName;
    const value = xmlNode.getAttribute(attrName);

    if ((attrDecl.use === "required") && value == null) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_MISSING_REQUIRED_ATTRIBUTE,
          severity: "error",
          message: `Required attribute '${attrName}' is missing.`,
          path: buildXmlPath(pathParts),
          source: "xml",
          nodeKind: "attribute",
          name: attrName,
          details: { attributeName: attrName }
        })
      );
      continue;
    }

    if (value != null) {
      const valueResult = validateAttributeValue(schema, attrDecl, value);
      if (!valueResult.ok) {
        issues.push(
          createIssue({
            code: ISSUE_CODES[valueResult.code] || valueResult.code,
            severity: "error",
            message: valueResult.message,
            path: buildXmlPath(pathParts),
            source: "xml",
            nodeKind: "attribute",
            name: attrName,
            details: { attributeName: attrName, value }
          })
        );
      }
    }
  }

  for (const attr of Array.from(xmlNode.attributes || [])) {
    if (!allowed.has(attr.name)) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE,
          severity: "error",
          message: `Unexpected attribute '${attr.name}'.`,
          path: buildXmlPath(pathParts),
          source: "xml",
          nodeKind: "attribute",
          name: attr.name,
          details: { attributeName: attr.name }
        })
      );
    }
  }
}

function validateSimpleElement(xmlNode, elementDecl, context) {
  const { schema, createIssue, ISSUE_CODES, issues, pathParts, validateElementValue } = context;
  const value = textContentTrimmed(xmlNode);
  const valueResult = validateElementValue(schema, elementDecl, value);

  if (!valueResult.ok) {
    issues.push(
      createIssue({
        code: ISSUE_CODES[valueResult.code] || valueResult.code,
        severity: "error",
        message: valueResult.message,
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: elementDecl.name || elementDecl.refName,
        details: { value }
      })
    );
  }
}

function validateComplexElement(xmlNode, complexTypeDecl, context) {
  const { schema, createIssue, ISSUE_CODES, issues, pathParts } = context;

  const attributes = getEffectiveAttributes(schema, complexTypeDecl);
  validateAttributes(xmlNode, attributes, context);

  const text = textContentTrimmed(xmlNode);
  const children = elementChildren(xmlNode);
  const content = getEffectiveContent(schema, complexTypeDecl);

  if (children.length === 0 && text && content) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_INVALID_TEXT_FOR_COMPLEX_TYPE,
        severity: "error",
        message: "Complex element contains text where structured child content is expected.",
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: localName(xmlNode),
        details: {}
      })
    );
  }

  if (content) {
    const result = validateContentModel(children, content, context, pathParts);
    if (result.nextIndex < children.length) {
      for (let i = result.nextIndex; i < children.length; i += 1) {
        issues.push(
          createIssue({
            code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
            severity: "error",
            message: `Unexpected element '${localName(children[i])}'.`,
            path: buildXmlPath([...pathParts, localName(children[i])]),
            source: "xml",
            nodeKind: "element",
            name: localName(children[i]),
            details: {}
          })
        );
      }
    }
  }
}

function validateElementDecl(xmlNode, elementDecl, context, pathParts) {
  const resolvedType = resolveElementType(context.schema, elementDecl);

  if (!resolvedType) return;

  const nextContext = {
    ...context,
    pathParts
  };

  if (resolvedType.kind === "builtinType" || resolvedType.kind === "simpleType") {
    validateSimpleElement(xmlNode, elementDecl, nextContext);
    return;
  }

  if (resolvedType.kind === "complexType") {
    validateComplexElement(xmlNode, resolvedType, nextContext);
  }
}

function consumeMatchingElement(children, startIndex, elementDecl, context, pathParts) {
  const min = repeatMin(elementDecl.minOccurs);
  const max = repeatMax(elementDecl.maxOccurs);

  let count = 0;
  let index = startIndex;

  while (
    index < children.length &&
    matchesElementDecl(children[index], elementDecl) &&
    count < max
  ) {
    const childNode = children[index];
    validateElementDecl(childNode, elementDecl, context, [...pathParts, localName(childNode)]);
    count += 1;
    index += 1;
  }

  if (count < min) {
    context.issues.push(
      context.createIssue({
        code: context.ISSUE_CODES.XML_MISSING_REQUIRED_ELEMENT,
        severity: "error",
        message: `Required element '${elementDecl.name || elementDecl.refName}' is missing.`,
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: elementDecl.name || elementDecl.refName,
        details: {
          minOccurs: elementDecl.minOccurs,
          actualCount: count
        }
      })
    );
  }

  return { nextIndex: index, matched: count >= min };
}

function validateGroupRef(children, startIndex, groupRefNode, context, pathParts) {
  const group = resolveGroup(context.schema, groupRefNode.refName);
  if (!group?.content) {
    return { nextIndex: startIndex, matched: false };
  }

  const min = repeatMin(groupRefNode.minOccurs);
  const max = repeatMax(groupRefNode.maxOccurs);

  let count = 0;
  let index = startIndex;

  while (count < max) {
    const result = validateContentModel(children, group.content, context, pathParts, index, true);
    if (!result.matchedAny) break;
    index = result.nextIndex;
    count += 1;
  }

  if (count < min) {
    context.issues.push(
      context.createIssue({
        code: context.ISSUE_CODES.XML_MISSING_REQUIRED_ELEMENT,
        severity: "error",
        message: `Required group '${groupRefNode.refName}' is missing.`,
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "groupRef",
        name: groupRefNode.refName,
        details: {}
      })
    );
  }

  return { nextIndex: index, matched: count >= min };
}

function validateChoice(children, startIndex, choiceNode, context, pathParts, silent = false) {
  const min = repeatMin(choiceNode.minOccurs);
  const max = repeatMax(choiceNode.maxOccurs);

  let count = 0;
  let index = startIndex;

  while (count < max) {
    let matchedBranch = null;

    for (const childDecl of choiceNode.children || []) {
      const snapshotIssuesLength = context.issues.length;
      const result = validateContentModel(children, childDecl, context, pathParts, index, true);

      if (result.matchedAny) {
        context.issues.length = snapshotIssuesLength;
        matchedBranch = result;
        break;
      }

      context.issues.length = snapshotIssuesLength;
    }

    if (!matchedBranch) break;

    index = matchedBranch.nextIndex;
    count += 1;
  }

  if (count < min && !silent) {
    context.issues.push(
      context.createIssue({
        code: context.ISSUE_CODES.XML_CHOICE_NOT_SATISFIED,
        severity: "error",
        message: "No valid branch of xs:choice was satisfied.",
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "choice",
        name: null,
        details: {}
      })
    );
  }

  return { nextIndex: index, matched: count >= min, matchedAny: count > 0 };
}

function validateAll(children, startIndex, allNode, context, pathParts, silent = false) {
  const requiredDecls = (allNode.children || []).filter((child) => repeatMin(child.minOccurs) > 0);
  const optionalDecls = (allNode.children || []).filter((child) => repeatMin(child.minOccurs) === 0);
  const pool = [...requiredDecls, ...optionalDecls];

  let index = startIndex;
  const consumed = new Set();
  let progress = true;

  while (index < children.length && progress) {
    progress = false;

    for (let i = 0; i < pool.length; i += 1) {
      if (consumed.has(i)) continue;

      const result = validateContentModel(children, pool[i], context, pathParts, index, true);
      if (result.matchedAny) {
        consumed.add(i);
        index = result.nextIndex;
        progress = true;
        break;
      }
    }
  }

  if (!silent) {
    for (const req of requiredDecls) {
      const found = pool.some((candidate, idx) => consumed.has(idx) && candidate === req);
      if (!found) {
        context.issues.push(
          context.createIssue({
            code: context.ISSUE_CODES.XML_ALL_MISSING_REQUIRED_ELEMENT,
            severity: "error",
            message: `Required xs:all child '${req.name || req.refName}' is missing.`,
            path: buildXmlPath(pathParts),
            source: "xml",
            nodeKind: "all",
            name: req.name || req.refName,
            details: {}
          })
        );
      }
    }
  }

  return { nextIndex: index, matched: consumed.size > 0 || requiredDecls.length === 0, matchedAny: consumed.size > 0 };
}

export function validateContentModel(children, modelNode, context, pathParts, startIndex = 0, silent = false) {
  if (!modelNode) {
    return { nextIndex: startIndex, matched: true, matchedAny: false };
  }

  switch (modelNode.kind) {
    case "element": {
      const result = consumeMatchingElement(children, startIndex, modelNode, context, pathParts);
      return {
        nextIndex: result.nextIndex,
        matched: result.matched,
        matchedAny: result.nextIndex > startIndex
      };
    }

    case "groupRef":
      return validateGroupRef(children, startIndex, modelNode, context, pathParts);

    case "sequence": {
      let index = startIndex;
      let matchedAny = false;

      for (const childDecl of modelNode.children || []) {
        const result = validateContentModel(children, childDecl, context, pathParts, index, silent);
        if (!result.matched && !silent) {
          return { nextIndex: index, matched: false, matchedAny };
        }
        index = result.nextIndex;
        matchedAny = matchedAny || result.matchedAny;
      }

      return { nextIndex: index, matched: true, matchedAny };
    }

    case "choice":
      return validateChoice(children, startIndex, modelNode, context, pathParts, silent);

    case "all":
      return validateAll(children, startIndex, modelNode, context, pathParts, silent);

    case "any":
      if (startIndex < children.length) {
        return { nextIndex: startIndex + 1, matched: true, matchedAny: true };
      }
      return { nextIndex: startIndex, matched: true, matchedAny: false };

    default:
      return { nextIndex: startIndex, matched: true, matchedAny: false };
  }
}