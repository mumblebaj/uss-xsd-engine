import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveElementType,
  resolveGlobalElement,
  resolveGroup,
} from "../resolver/schemaResolvers.js";
import { validateAttributeValue, validateElementValue } from "./valueValidator.js";

function localName(name) {
  if (typeof name !== "string") return null;
  const idx = name.indexOf(":");
  return idx < 0 ? name : name.slice(idx + 1);
}

function buildPath(parts) {
  if (!parts.length) return "/";
  return `/${parts.join("/")}`;
}

function minOccursOf(node) {
  return typeof node?.minOccurs === "number" ? node.minOccurs : 1;
}

function maxOccursOf(node) {
  return node?.maxOccurs === "unbounded"
    ? Infinity
    : typeof node?.maxOccurs === "number"
      ? node.maxOccurs
      : 1;
}

function findSchemaRoot(schema, xmlRootName, options = {}) {
  if (options.rootElementName) {
    return resolveGlobalElement(schema, options.rootElementName);
  }

  return (
    Object.values(schema?.globals?.elements || {}).find(
      (decl) => decl.name === xmlRootName,
    ) || null
  );
}

function flattenElementParticles(contentNode, schema, out = []) {
  if (!contentNode) return out;

  if (contentNode.kind === "element") {
    out.push(contentNode);
    return out;
  }

  if (contentNode.kind === "groupRef") {
    const group = resolveGroup(schema, contentNode.refName);
    if (group?.content) flattenElementParticles(group.content, schema, out);
    return out;
  }

  if (
    contentNode.kind === "sequence" ||
    contentNode.kind === "all" ||
    contentNode.kind === "choice"
  ) {
    for (const child of contentNode.children || []) {
      flattenElementParticles(child, schema, out);
    }
  }

  return out;
}

function findDirectChildDecl(contentNode, schema, childName) {
  const candidates = flattenElementParticles(contentNode, schema);
  return (
    candidates.find((decl) => {
      const schemaName = decl.refName || decl.name;
      return localName(schemaName) === childName;
    }) || null
  );
}

function resolveGroupElements(groupRefNode, schema) {
  const group = resolveGroup(schema, groupRefNode?.refName);
  if (!group?.content) return [];
  return flattenElementParticles(group.content, schema, []);
}

function expandSequenceChildren(contentNode, schema, out = []) {
  if (!contentNode) return out;

  if (contentNode.kind === "sequence") {
    for (const child of contentNode.children || []) {
      expandSequenceChildren(child, schema, out);
    }
    return out;
  }

  if (contentNode.kind === "groupRef") {
    const groupElements = resolveGroupElements(contentNode, schema);
    for (const decl of groupElements) out.push(decl);
    return out;
  }

  if (contentNode.kind === "element") {
    out.push(contentNode);
    return out;
  }

  return out;
}

function createSequenceTracker(contentNode, schema) {
  const sequenceElements = expandSequenceChildren(contentNode, schema, []);
  return {
    elements: sequenceElements,
    index: 0,
    counts: new Map(),
  };
}

function elementDeclName(decl) {
  return localName(decl?.refName || decl?.name);
}

function isSequenceCompatibleChild(tracker, childName) {
  if (!tracker || !tracker.elements?.length) {
    return { ok: true, matchedDecl: null, expectedName: null };
  }

  let cursor = tracker.index;
  while (cursor < tracker.elements.length) {
    const expectedDecl = tracker.elements[cursor];
    const expectedName = elementDeclName(expectedDecl);
    const key = `${cursor}:${expectedName || ""}`;
    const seen = tracker.counts.get(key) || 0;
    const min = minOccursOf(expectedDecl);
    const max = maxOccursOf(expectedDecl);

    if (expectedName === childName) {
      if (seen >= max) {
        return { ok: false, matchedDecl: null, expectedName };
      }

      tracker.counts.set(key, seen + 1);
      if (seen + 1 >= max) {
        tracker.index = cursor + 1;
      }
      else {
        tracker.index = cursor;
      }

      return { ok: true, matchedDecl: expectedDecl, expectedName };
    }

    if (seen < min) {
      return { ok: false, matchedDecl: null, expectedName };
    }

    tracker.index = cursor + 1;
    cursor += 1;
  }

  return { ok: false, matchedDecl: null, expectedName: null };
}

function validateSequenceCompletion(frame, issues) {
  const tracker = frame?.sequenceTracker;
  if (!tracker || !tracker.elements?.length) return;

  for (let i = 0; i < tracker.elements.length; i += 1) {
    const expectedDecl = tracker.elements[i];
    const expectedName = elementDeclName(expectedDecl);
    if (!expectedName) continue;

    const key = `${i}:${expectedName}`;
    const seen = tracker.counts.get(key) || 0;
    const min = minOccursOf(expectedDecl);
    if (seen >= min) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_MISSING_REQUIRED_ELEMENT,
        severity: "error",
        message: `Missing required child element '${expectedName}'.`,
        path: buildPath(frame.pathParts),
        source: "xml",
        nodeKind: "element",
        name: expectedName,
        details: {
          expectedName,
          minOccurs: min,
          actualOccurs: seen,
        },
      }),
    );
  }
}

function validateRequiredChildren(frame, issues, schema) {
  if (frame?.sequenceTracker) {
    validateSequenceCompletion(frame, issues);
    return;
  }

  const content = frame?.complexType
    ? getEffectiveContent(schema, frame.complexType)
    : null;

  if (!content) return;

  if (content.kind === "choice") {
    const matched = Array.from(frame.childCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const minOccurs = typeof content.minOccurs === "number" ? content.minOccurs : 1;
    if (matched < minOccurs) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_CHOICE_NOT_SATISFIED,
          severity: "error",
          message: "Element content does not satisfy required choice.",
          path: buildPath(frame.pathParts),
          source: "xml",
          nodeKind: "element",
          name: frame.name,
        }),
      );
    }
    return;
  }

  const elements = flattenElementParticles(content, schema);
  for (const elementDecl of elements) {
    const expectedName = localName(elementDecl.refName || elementDecl.name);
    if (!expectedName) continue;

    const minOccurs = typeof elementDecl.minOccurs === "number" ? elementDecl.minOccurs : 1;
    if (minOccurs <= 0) continue;

    const seen = frame.childCounts.get(expectedName) || 0;
    if (seen < minOccurs) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_MISSING_REQUIRED_ELEMENT,
          severity: "error",
          message: `Missing required child element '${expectedName}'.`,
          path: buildPath(frame.pathParts),
          source: "xml",
          nodeKind: "element",
          name: expectedName,
          details: {
            expectedName,
            minOccurs,
            actualOccurs: seen,
          },
        }),
      );
    }
  }
}

function validateAttributesForFrame(frame, issues, schema) {
  if (!frame?.complexType) return;

  const allowed = new Map();
  const effectiveAttributes = getEffectiveAttributes(schema, frame.complexType);
  for (const attr of effectiveAttributes || []) {
    if (attr?.kind !== "attribute") continue;
    const attrName = attr.name || attr.refName;
    if (!attrName) continue;
    allowed.set(attrName, attr);
  }

  for (const attrDecl of allowed.values()) {
    const attrName = attrDecl.name || attrDecl.refName;
    const value = frame.attributes[attrName];

    if (attrDecl.use === "required" && value == null) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XML_MISSING_REQUIRED_ATTRIBUTE,
          severity: "error",
          message: `Required attribute '${attrName}' is missing.`,
          path: buildPath(frame.pathParts),
          source: "xml",
          nodeKind: "attribute",
          name: attrName,
        }),
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
            path: buildPath(frame.pathParts),
            source: "xml",
            nodeKind: "attribute",
            name: attrName,
            details: { value },
          }),
        );
      }
    }
  }

  for (const [attrName] of Object.entries(frame.attributes || {})) {
    if (attrName === "xmlns" || attrName.startsWith("xmlns:")) continue;
    if (allowed.has(attrName)) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.XML_UNEXPECTED_ATTRIBUTE,
        severity: "error",
        message: `Unexpected attribute '${attrName}'.`,
        path: buildPath(frame.pathParts),
        source: "xml",
        nodeKind: "attribute",
        name: attrName,
      }),
    );
  }
}

export function createStreamingState({ schema, options = {} } = {}) {
  const stack = [];
  const issues = [];
  let rootSeen = false;
  let fatalError = false;

  function currentPath() {
    return buildPath(stack.map((entry) => entry.name));
  }

  function consumeIssues() {
    const out = [...issues];
    issues.length = 0;
    return out;
  }

  function pushIssue(issue) {
    issues.push(issue);
  }

  function onStartElement({ name, attributes }) {
    if (fatalError) return;

    const entryName = localName(name);
    if (!entryName) {
      pushIssue(
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: "Encountered XML element with invalid name.",
          source: "xml",
        }),
      );
      fatalError = true;
      return;
    }

    let elementDecl = null;

    if (!rootSeen) {
      rootSeen = true;
      const rootDecl = findSchemaRoot(schema, entryName, options);
      if (!rootDecl) {
        pushIssue(
          createIssue({
            code: options.rootElementName
              ? ISSUE_CODES.XML_ROOT_ELEMENT_MISMATCH
              : ISSUE_CODES.XML_UNKNOWN_ROOT_ELEMENT,
            severity: "error",
            message: options.rootElementName
              ? `XML root '${entryName}' does not match requested schema root '${options.rootElementName}'.`
              : `No matching global schema root found for XML root '${entryName}'.`,
            path: `/${entryName}`,
            source: "xml",
            nodeKind: "element",
            name: entryName,
          }),
        );
        fatalError = true;
      }
      else {
        elementDecl = rootDecl;
      }
    }
    else {
      const parent = stack[stack.length - 1];
      const parentContent = parent?.complexType
        ? getEffectiveContent(schema, parent.complexType)
        : null;

      let childDecl = null;

      if (parent?.sequenceTracker) {
        const sequenceMatch = isSequenceCompatibleChild(parent.sequenceTracker, entryName);
        if (sequenceMatch.ok) {
          childDecl = sequenceMatch.matchedDecl;
        }
        else {
          const expectedFragment = sequenceMatch.expectedName
            ? ` Expected '${sequenceMatch.expectedName}'.`
            : "";
          pushIssue(
            createIssue({
              code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
              severity: "error",
              message: `Unexpected element '${entryName}'.${expectedFragment}`,
              path: `${currentPath()}/${entryName}`,
              source: "xml",
              nodeKind: "element",
              name: entryName,
            }),
          );
        }
      }
      else {
        childDecl = findDirectChildDecl(parentContent, schema, entryName);
      }

      if (!childDecl) {
        if (!parent?.sequenceTracker) {
          pushIssue(
            createIssue({
              code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT,
              severity: "error",
              message: `Unexpected element '${entryName}'.`,
              path: `${currentPath()}/${entryName}`,
              source: "xml",
              nodeKind: "element",
              name: entryName,
            }),
          );
        }
      }
      else {
        const key = localName(childDecl.refName || childDecl.name) || entryName;
        const current = parent.childCounts.get(key) || 0;
        parent.childCounts.set(key, current + 1);
        elementDecl = childDecl;
      }
    }

    const elementType = resolveElementType(schema, elementDecl);
    const complexType = elementType?.kind === "complexType" ? elementType : null;

    const frame = {
      name: entryName,
      elementDecl,
      complexType,
      attributes: attributes || Object.create(null),
      childCounts: new Map(),
      text: "",
      pathParts: [...stack.map((entry) => entry.name), entryName],
    };

    const content = complexType ? getEffectiveContent(schema, complexType) : null;
    if (content?.kind === "sequence") {
      frame.sequenceTracker = createSequenceTracker(content, schema);
    }

    validateAttributesForFrame(frame, issues, schema);
    stack.push(frame);
  }

  function onText(text) {
    if (!stack.length || fatalError) return;
    stack[stack.length - 1].text += text;
  }

  function onEndElement({ name }) {
    if (!stack.length || fatalError) return;

    const entryName = localName(name);
    const frame = stack.pop();

    if (entryName !== frame.name) {
      pushIssue(
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: `Mismatched closing tag. Expected '${frame.name}' but found '${entryName}'.`,
          path: buildPath(frame.pathParts),
          source: "xml",
          nodeKind: "element",
          name: entryName,
        }),
      );
      fatalError = true;
      return;
    }

    if (frame.complexType) {
      validateRequiredChildren(frame, issues, schema);

      const hasChildren = Array.from(frame.childCounts.values()).some((count) => count > 0);
      if (!frame.complexType.mixed && hasChildren && frame.text.trim()) {
        pushIssue(
          createIssue({
            code: ISSUE_CODES.XML_MIXED_CONTENT_NOT_ALLOWED,
            severity: "error",
            message: "Mixed text content is not allowed for this complex type.",
            path: buildPath(frame.pathParts),
            source: "xml",
            nodeKind: "element",
            name: frame.name,
          }),
        );
      }
    }
    else if (frame.elementDecl) {
      const valueResult = validateElementValue(schema, frame.elementDecl, frame.text.trim());
      if (!valueResult.ok) {
        pushIssue(
          createIssue({
            code: ISSUE_CODES[valueResult.code] || valueResult.code,
            severity: "error",
            message: valueResult.message,
            path: buildPath(frame.pathParts),
            source: "xml",
            nodeKind: "element",
            name: frame.name,
            details: { value: frame.text.trim() },
          }),
        );
      }
    }
  }

  function finalize() {
    if (!rootSeen) {
      pushIssue(
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: "XML stream ended before any root element was parsed.",
          source: "xml",
        }),
      );
    }

    if (stack.length > 0) {
      const open = stack[stack.length - 1];
      pushIssue(
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message: `XML stream ended before closing element '${open.name}'.`,
          path: buildPath(open.pathParts),
          source: "xml",
          nodeKind: "element",
          name: open.name,
        }),
      );
    }
  }

  function getCheckpoint() {
    return {
      rootSeen,
      fatalError,
      stack: stack.map((entry) => ({
        ...entry,
        childCounts: Array.from(entry.childCounts.entries()),
      })),
    };
  }

  function restoreCheckpoint(checkpoint) {
    if (!checkpoint || typeof checkpoint !== "object") return;

    rootSeen = Boolean(checkpoint.rootSeen);
    fatalError = Boolean(checkpoint.fatalError);
    stack.length = 0;

    for (const entry of checkpoint.stack || []) {
      stack.push({
        ...entry,
        childCounts: new Map(entry.childCounts || []),
      });
    }
  }

  return {
    onStartElement,
    onText,
    onEndElement,
    finalize,
    consumeIssues,
    getCurrentPath: currentPath,
    getCheckpoint,
    restoreCheckpoint,
  };
}
