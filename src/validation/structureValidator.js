import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveElementType,
  resolveGroup
} from "../resolver/schemaResolvers.js";

function elementChildren(xmlNode) {
  return Array.from(xmlNode?.children || []).filter((child) => child.nodeType === 1);
}

function directTextNodes(xmlNode) {
  return Array.from(xmlNode?.childNodes || []).filter((node) => node.nodeType === 3);
}

function textContentTrimmed(xmlNode) {
  return (xmlNode?.textContent || "").trim();
}

function localName(node) {
  return node?.localName || node?.nodeName || null;
}

function namespaceUri(node) {
  return node?.namespaceURI || null;
}

function repeatMin(minOccurs) {
  return typeof minOccurs === "number" ? minOccurs : 1;
}

function repeatMax(maxOccurs) {
  return maxOccurs === "unbounded" ? Infinity : maxOccurs;
}

function matchesElementDecl(xmlNode, elementDecl) {
  const xmlName = localName(xmlNode);
  const xmlNs = namespaceUri(xmlNode);

  const declName = elementDecl.refName || elementDecl.name;
  const declLocal = declName?.includes(":") ? declName.split(":")[1] : declName;
  const declNs = elementDecl.namespaceUri || null;

  if (xmlName !== declLocal) return false;
  if (declNs == null) return true;

  return xmlNs === declNs;
}

function buildXmlPath(pathParts) {
  return "/" + pathParts.join("/");
}

function getLocationFields(context, node = null, fallbackNode = null) {
  const location =
    context.getNodeLocation?.(node) ||
    context.getNodeLocation?.(fallbackNode) ||
    context.getNodeLocation?.(context.currentXmlNode) ||
    null;

  return {
    line: location?.line ?? null,
    column: location?.column ?? null
  };
}

function getAttributeLocationFields(context, node, attrName) {
  const location =
    context.getAttributeLocation?.(node, attrName) ||
    context.getNodeLocation?.(node) ||
    context.getNodeLocation?.(context.currentXmlNode) ||
    null;

  return {
    line: location?.line ?? null,
    column: location?.column ?? null
  };
}

function getAttributeValueLocationFields(context, node, attrName) {
  const location =
    context.getAttributeValueLocation?.(node, attrName) ||
    context.getAttributeLocation?.(node, attrName) ||
    context.getNodeLocation?.(node) ||
    context.getNodeLocation?.(context.currentXmlNode) ||
    null;

  return {
    line: location?.line ?? null,
    column: location?.column ?? null
  };
}

function getTextValueLocationFields(context, node) {
  const location =
    context.getTextValueLocation?.(node) ||
    context.getNodeLocation?.(node) ||
    context.getNodeLocation?.(context.currentXmlNode) ||
    null;

  return {
    line: location?.line ?? null,
    column: location?.column ?? null
  };
}

function isSimpleContentComplexType(complexTypeDecl) {
  return (
    complexTypeDecl?.kind === "complexType" &&
    complexTypeDecl?.contentModel === "simple" &&
    !!complexTypeDecl?.derivation?.baseTypeName
  );
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

    if (attrDecl.use === "required" && value == null) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_MISSING_REQUIRED_ATTRIBUTE,
          severity: "error",
          message: `Required attribute '${attrName}' is missing.`,
          ...getAttributeLocationFields(context, xmlNode, attrName),
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
            ...getAttributeValueLocationFields(context, xmlNode, attrName),
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
    if (
      attr.name === "xmlns" ||
      attr.name.startsWith("xmlns:") ||
      attr.prefix === "xmlns"
    ) {
      continue;
    }

    if (!allowed.has(attr.name)) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE,
          severity: "error",
          message: `Unexpected attribute '${attr.name}'.`,
          ...getAttributeLocationFields(context, xmlNode, attr.name),
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
        ...getTextValueLocationFields(context, xmlNode),
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: elementDecl.name || elementDecl.refName,
        details: { value }
      })
    );
  }
}

function validateSimpleContentElement(xmlNode, complexTypeDecl, context) {
  const { schema, createIssue, ISSUE_CODES, issues, pathParts, validateElementValue } = context;
  const value = textContentTrimmed(xmlNode);
  const children = elementChildren(xmlNode);
  const baseTypeName = complexTypeDecl?.derivation?.baseTypeName;

  if (children.length > 0) {
    for (const childNode of children) {
      const childName = localName(childNode);
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
          severity: "error",
          message: `Unexpected element '${childName}'.`,
          ...getLocationFields(context, childNode, xmlNode),
          path: buildXmlPath([...pathParts, childName]),
          source: "xml",
          nodeKind: "element",
          name: childName,
          details: {}
        })
      );
    }
  }

  const pseudoElementDecl = {
    name: localName(xmlNode),
    typeName: baseTypeName,
    inlineType: null,
    refName: null
  };

  const valueResult = validateElementValue(schema, pseudoElementDecl, value);

  if (!valueResult.ok) {
    issues.push(
      createIssue({
        code: ISSUE_CODES[valueResult.code] || valueResult.code,
        severity: "error",
        message: valueResult.message,
        ...getTextValueLocationFields(context, xmlNode),
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: localName(xmlNode),
        details: { value }
      })
    );
  }
}

function validateMixedContent(xmlNode, complexTypeDecl, context, pathParts) {
  const { createIssue, ISSUE_CODES, issues } = context;
  const hasDirectText = directTextNodes(xmlNode).some((node) => node.nodeValue?.trim());

  if (isSimpleContentComplexType(complexTypeDecl)) {
    return;
  }

  if (!complexTypeDecl.mixed && hasDirectText) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_MIXED_CONTENT_NOT_ALLOWED,
        severity: "error",
        message: "Mixed text content is not allowed for this complex type.",
        ...getTextValueLocationFields(context, xmlNode),
        path: buildXmlPath(pathParts),
        source: "xml",
        nodeKind: "element",
        name: localName(xmlNode),
        details: {}
      })
    );
  }
}

function validateComplexElement(xmlNode, complexTypeDecl, context) {
  const { schema, createIssue, ISSUE_CODES, issues, pathParts } = context;

  const attributes = getEffectiveAttributes(schema, complexTypeDecl);
  validateAttributes(xmlNode, attributes, context);

  if (isSimpleContentComplexType(complexTypeDecl)) {
    validateSimpleContentElement(xmlNode, complexTypeDecl, context);
    return;
  }

  validateMixedContent(xmlNode, complexTypeDecl, context, pathParts);

  const text = textContentTrimmed(xmlNode);
  const children = elementChildren(xmlNode);
  const content = getEffectiveContent(schema, complexTypeDecl);

  if (!complexTypeDecl.mixed && children.length === 0 && text && content) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_INVALID_TEXT_FOR_COMPLEX_TYPE,
        severity: "error",
        message: "Complex element contains text where structured child content is expected.",
        ...getTextValueLocationFields(context, xmlNode),
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
        const childNode = children[i];
        const childName = localName(childNode);

        issues.push(
          createIssue({
            code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
            severity: "error",
            message: `Unexpected element '${childName}'.`,
            ...getLocationFields(context, childNode, xmlNode),
            path: buildXmlPath([...pathParts, childName]),
            source: "xml",
            nodeKind: "element",
            name: childName,
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
    pathParts,
    currentXmlNode: xmlNode
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
        ...getLocationFields(context, context.currentXmlNode),
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
        ...getLocationFields(context, context.currentXmlNode),
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
    let matchedBranches = [];

    for (const childDecl of choiceNode.children || []) {
      const snapshotIssuesLength = context.issues.length;
      const result = validateContentModel(children, childDecl, context, pathParts, index, true);

      if (result.matchedAny) {
        context.issues.length = snapshotIssuesLength;
        matchedBranches.push(result);
      }
      else {
        context.issues.length = snapshotIssuesLength;
      }
    }

    if (matchedBranches.length === 0) break;

    if (matchedBranches.length > 1 && !silent) {
      context.issues.push(
        context.createIssue({
          code: context.ISSUE_CODES.XML_CHOICE_MULTIPLE_BRANCHES,
          severity: "error",
          message: "Multiple xs:choice branches appear to match at the same position.",
          ...getLocationFields(context, context.currentXmlNode),
          path: buildXmlPath(pathParts),
          source: "xml",
          nodeKind: "choice",
          name: null,
          details: {}
        })
      );
    }

    const matchedBranch = matchedBranches[0];
    index = matchedBranch.nextIndex;
    count += 1;
  }

  if (count < min && !silent) {
    context.issues.push(
      context.createIssue({
        code: context.ISSUE_CODES.XML_CHOICE_NOT_SATISFIED,
        severity: "error",
        message: "No valid branch of xs:choice was satisfied.",
        ...getLocationFields(context, context.currentXmlNode),
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
  const members = allNode.children || [];
  const matchedIndexes = new Set();
  let index = startIndex;

  while (index < children.length) {
    let matchedMemberIndex = -1;

    for (let i = 0; i < members.length; i += 1) {
      if (matchedIndexes.has(i)) continue;

      const result = validateContentModel(children, members[i], context, pathParts, index, true);
      if (result.matchedAny) {
        matchedMemberIndex = i;
        index = result.nextIndex;
        break;
      }
    }

    if (matchedMemberIndex < 0) break;
    matchedIndexes.add(matchedMemberIndex);
  }

  if (!silent) {
    for (let i = 0; i < members.length; i += 1) {
      const member = members[i];
      const min = repeatMin(member.minOccurs);

      if (matchedIndexes.has(i) && maxOccursIsSingle(member)) {
        // ok
      }

      if (!matchedIndexes.has(i) && min > 0) {
        context.issues.push(
          context.createIssue({
            code: context.ISSUE_CODES.XML_ALL_MISSING_REQUIRED_ELEMENT,
            severity: "error",
            message: `Required xs:all child '${member.name || member.refName}' is missing.`,
            ...getLocationFields(context, context.currentXmlNode),
            path: buildXmlPath(pathParts),
            source: "xml",
            nodeKind: "all",
            name: member.name || member.refName,
            details: {}
          })
        );
      }
    }
  }

  return {
    nextIndex: index,
    matched: matchedIndexes.size > 0 || members.every((m) => repeatMin(m.minOccurs) === 0),
    matchedAny: matchedIndexes.size > 0
  };
}

function maxOccursIsSingle(member) {
  return member.maxOccurs == null || member.maxOccurs === 1;
}

function flattenAllowedNames(node, out = new Set()) {
  if (!node) return out;

  switch (node.kind) {
    case "sequence":
    case "choice":
    case "all":
      for (const child of node.children || []) {
        flattenAllowedNames(child, out);
      }
      return out;

    case "groupRef":
      out.add(node.refName);
      return out;

    case "element":
      out.add(node.refName || node.name);
      return out;

    default:
      return out;
  }
}

function validateRestrictionCompatibility(modelNode, context, pathParts, children = [], startIndex = 0) {
  if (!context.currentComplexType?.derivation) return;

  const derivation = context.currentComplexType.derivation;
  if (derivation.kind !== "restriction") return;

  const allowedNames = flattenAllowedNames(modelNode, new Set());

  for (let i = startIndex; i < children.length; i += 1) {
    const childNode = children[i];
    const childName = localName(childNode);

    if (!allowedNames.has(childName)) {
      context.issues.push(
        context.createIssue({
          code: context.ISSUE_CODES.XML_RESTRICTED_ELEMENT_NOT_ALLOWED,
          severity: "error",
          message: `Element '${childName}' is not allowed by the restricted content model.`,
          ...getLocationFields(context, childNode, context.currentXmlNode),
          path: buildXmlPath([...pathParts, childName]),
          source: "xml",
          nodeKind: "element",
          name: childName,
          details: {}
        })
      );
    }
  }
}

export function validateContentModel(children, modelNode, context, pathParts, startIndex = 0, silent = false) {
  if (!modelNode) {
    return { nextIndex: startIndex, matched: true, matchedAny: false };
  }

  validateRestrictionCompatibility(modelNode, context, pathParts, children, startIndex);

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