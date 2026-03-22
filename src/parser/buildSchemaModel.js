import {
  createAllNode,
  createAnyNode,
  createAttributeDecl,
  createAttributeGroupDecl,
  createAttributeGroupRef,
  createChoiceNode,
  createComplexTypeDecl,
  createElementDecl,
  createEmptySchemaModel,
  createGroupDecl,
  createGroupRefNode,
  createSequenceNode,
  createSimpleTypeDecl,
  normalizeOccurs,
  normalizeUse,
} from "../model/schemaModel.js";
import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import {
  makeLookupKey,
  parseQName,
  resolveNamespaceUri,
  stripNamespacePrefix,
} from "../resolver/schemaResolvers.js";

const UNSUPPORTED_NODE_FEATURES = new Set([
  "key",
  "keyref",
  "unique",
  "any",
  "anyAttribute",
  "redefine",
  "notation",
]);

function elementChildren(node) {
  return Array.from(node?.children || []).filter(
    (child) => child.nodeType === 1,
  );
}

function recordExternalRef(schema, kind, node, path, loc) {
  const entry = {
    kind,
    namespace: node.getAttribute("namespace") || null,
    schemaLocation: node.getAttribute("schemaLocation") || null,
    line: loc.line,
    column: loc.column,
    path,
  };

  if (kind === "include") {
    schema.externalRefs.includes.push(entry);
  } else if (kind === "import") {
    schema.externalRefs.imports.push(entry);
  }
}

function mergeGlobalsIntoSchema(
  targetSchema,
  sourceSchema,
  issues,
  createDuplicateIssue,
) {
  const buckets = [
    ["elements", "DUPLICATE_GLOBAL_ELEMENT"],
    ["complexTypes", "DUPLICATE_GLOBAL_COMPLEX_TYPE"],
    ["simpleTypes", "DUPLICATE_GLOBAL_SIMPLE_TYPE"],
    ["attributes", "DUPLICATE_GLOBAL_ATTRIBUTE"],
    ["groups", "DUPLICATE_GLOBAL_GROUP"],
    ["attributeGroups", "DUPLICATE_GLOBAL_ATTRIBUTE_GROUP"],
  ];

  for (const [bucketName, duplicateCode] of buckets) {
    for (const [key, decl] of Object.entries(
      sourceSchema.globals[bucketName] || {},
    )) {
      if (targetSchema.globals[bucketName][key]) {
        issues.push(createDuplicateIssue(duplicateCode, decl));
        continue;
      }
      targetSchema.globals[bucketName][key] = decl;
    }
  }

  targetSchema.roots.push(...(sourceSchema.roots || []));
  targetSchema.references.types.push(...(sourceSchema.references.types || []));
  targetSchema.references.refs.push(...(sourceSchema.references.refs || []));
  targetSchema.references.baseTypes.push(
    ...(sourceSchema.references.baseTypes || []),
  );
  targetSchema.references.groupRefs.push(
    ...(sourceSchema.references.groupRefs || []),
  );
  targetSchema.references.attributeGroupRefs.push(
    ...(sourceSchema.references.attributeGroupRefs || []),
  );

  targetSchema.externalRefs.includes.push(
    ...(sourceSchema.externalRefs.includes || []),
  );
  targetSchema.externalRefs.imports.push(
    ...(sourceSchema.externalRefs.imports || []),
  );

  for (const feature of sourceSchema.usedFeatures || []) {
    targetSchema.usedFeatures.add(feature);
  }
  targetSchema.unsupportedFeatures.push(
    ...(sourceSchema.unsupportedFeatures || []),
  );
}

function extractNamespaces(schemaRoot, schema) {
  for (const attr of Array.from(schemaRoot.attributes || [])) {
    if (attr.name === "xmlns") {
      schema.namespaces.default = attr.value;
    } else if (attr.name.startsWith("xmlns:")) {
      const prefix = attr.name.slice("xmlns:".length);
      schema.namespaces.prefixes[prefix] = attr.value;
    }
  }
}

function getDeclarationNamespaceUri(schema, node, kind) {
  const isQualified =
    kind === "attribute"
      ? schema.attributeFormDefault === "qualified"
      : schema.elementFormDefault === "qualified";

  if (node.parentElement?.localName === "schema") {
    return schema.targetNamespace || null;
  }

  return isQualified ? schema.targetNamespace || null : null;
}

function getSchemaRoot(doc) {
  const root = doc?.documentElement || null;
  return root && root.localName === "schema" ? root : null;
}

function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function indexToLineColumn(index, lineStarts) {
  let line = 1;
  for (let i = 0; i < lineStarts.length; i += 1) {
    if (lineStarts[i] > index) break;
    line = i + 1;
  }

  const lineStart = lineStarts[line - 1] ?? 0;
  return {
    line,
    column: index - lineStart + 1,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function locateNodeInSource(xsdText, lineStarts, node) {
  if (!xsdText || !node) return { line: null, column: null };

  const localName = node.localName;
  const name = node.getAttribute("name");
  const ref = node.getAttribute("ref");
  const base = node.getAttribute("base");
  const type = node.getAttribute("type");

  const candidates = [
    name
      ? `<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*\\bname=(["'])${escapeRegExp(name)}\\1`
      : null,
    ref
      ? `<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*\\bref=(["'])${escapeRegExp(ref)}\\1`
      : null,
    base
      ? `<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*\\bbase=(["'])${escapeRegExp(base)}\\1`
      : null,
    type
      ? `<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*\\btype=(["'])${escapeRegExp(type)}\\1`
      : null,
    `<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b`,
  ].filter(Boolean);

  for (const pattern of candidates) {
    const regex = new RegExp(pattern, "m");
    const match = regex.exec(xsdText);
    if (match && typeof match.index === "number") {
      return indexToLineColumn(match.index, lineStarts);
    }
  }

  return { line: null, column: null };
}

function buildPath(parentPath, node) {
  const kind = node.localName;
  const name = node.getAttribute("name");
  const ref = node.getAttribute("ref");
  const base = node.getAttribute("base");

  let qualifier = "";
  if (name) qualifier = `[name="${name}"]`;
  else if (ref) qualifier = `[ref="${ref}"]`;
  else if (base) qualifier = `[base="${base}"]`;

  return `${parentPath}/${kind}${qualifier}`;
}

function registerGlobal(schema, issues, bucketName, duplicateCode, decl) {
  const localName = stripNamespacePrefix(decl.name);
  if (!localName) return;

  const key = makeLookupKey(decl.namespaceUri, localName);

  if (schema.globals[bucketName][key]) {
    issues.push(
      createIssue({
        code: duplicateCode,
        severity: "error",
        message: `Duplicate global ${decl.kind} declaration '${decl.name}'.`,
        line: decl.line,
        column: decl.column,
        path: decl.path,
        source: "xsd",
        nodeKind: decl.kind,
        name: decl.name,
        details: { declarationName: decl.name },
      }),
    );
    return;
  }

  schema.globals[bucketName][key] = decl;
}

function collectReference(schema, kind, payload) {
  schema.references[kind].push(payload);
}

function collectUnsupportedFeature(schema, feature) {
  schema.unsupportedFeatures.push(feature);
}

function collectNodeDiagnostics(schema, issues, node, path, loc) {
  const localName = node.localName;

  schema.usedFeatures.add(localName);

  if (UNSUPPORTED_NODE_FEATURES.has(localName)) {
    collectUnsupportedFeature(schema, {
      feature: `xs:${localName}`,
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  if (node.hasAttribute("substitutionGroup")) {
    collectUnsupportedFeature(schema, {
      feature: "xs:substitutionGroup",
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  if (node.hasAttribute("type")) {
    collectReference(schema, "types", {
      typeName: node.getAttribute("type"),
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || node.getAttribute("ref") || null,
    });
  }

  if (
    (localName === "element" || localName === "attribute") &&
    node.hasAttribute("ref")
  ) {
    collectReference(schema, "refs", {
      refName: node.getAttribute("ref"),
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  if (
    (localName === "extension" || localName === "restriction") &&
    node.hasAttribute("base")
  ) {
    collectReference(schema, "baseTypes", {
      baseTypeName: node.getAttribute("base"),
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  if (localName === "group" && node.hasAttribute("ref")) {
    collectReference(schema, "groupRefs", {
      refName: node.getAttribute("ref"),
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  if (localName === "attributeGroup" && node.hasAttribute("ref")) {
    collectReference(schema, "attributeGroupRefs", {
      refName: node.getAttribute("ref"),
      line: loc.line,
      column: loc.column,
      path,
      nodeKind: localName,
      name: node.getAttribute("name") || null,
    });
  }

  const minOccurs = normalizeOccurs(node.getAttribute("minOccurs"), 1);
  const maxOccurs = normalizeOccurs(node.getAttribute("maxOccurs"), 1);

  if (
    typeof minOccurs === "number" &&
    typeof maxOccurs === "number" &&
    minOccurs > maxOccurs
  ) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.INVALID_OCCURS_RANGE,
        severity: "error",
        message: `Invalid occurs range: minOccurs (${minOccurs}) is greater than maxOccurs (${maxOccurs}).`,
        line: loc.line,
        column: loc.column,
        path,
        source: "xsd",
        nodeKind: localName,
        name: node.getAttribute("name") || null,
        details: { minOccurs, maxOccurs },
      }),
    );
  }

  if (
    (localName === "element" || localName === "attribute") &&
    node.hasAttribute("default") &&
    node.hasAttribute("fixed")
  ) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.INVALID_DEFAULT_FIXED_COMBINATION,
        severity: "error",
        message: "Node cannot declare both default and fixed values.",
        line: loc.line,
        column: loc.column,
        path,
        source: "xsd",
        nodeKind: localName,
        name: node.getAttribute("name") || node.getAttribute("ref") || null,
        details: {
          defaultValue: node.getAttribute("default"),
          fixedValue: node.getAttribute("fixed"),
        },
      }),
    );
  }
}

function parseFacets(node) {
  const facets = {};
  const enumerations = [];

  for (const child of elementChildren(node)) {
    switch (child.localName) {
      case "enumeration":
        if (child.hasAttribute("value")) {
          enumerations.push(child.getAttribute("value"));
        }
        break;
      case "minLength":
      case "maxLength":
      case "length":
      case "totalDigits":
      case "fractionDigits":
        if (child.hasAttribute("value")) {
          const n = Number(child.getAttribute("value"));
          if (Number.isFinite(n)) facets[child.localName] = n;
        }
        break;
      case "minInclusive":
      case "maxInclusive":
      case "minExclusive":
      case "maxExclusive":
        if (child.hasAttribute("value")) {
          facets[child.localName] = child.getAttribute("value");
        }
        break;
      case "pattern":
        if (!facets.pattern) facets.pattern = [];
        if (child.hasAttribute("value")) {
          facets.pattern.push(child.getAttribute("value"));
        }
        break;
      case "whiteSpace":
        if (child.hasAttribute("value")) {
          facets.whiteSpace = child.getAttribute("value");
        }
        break;
      default:
        break;
    }
  }

  return { facets, enumerations };
}

function parseSimpleType(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  let baseTypeName = null;
  let facets = {};
  let enumerations = [];

  const restriction = elementChildren(node).find(
    (child) => child.localName === "restriction",
  );
  if (restriction) {
    const restrictionPath = buildPath(path, restriction);
    const restrictionLoc = locateNodeInSource(xsdText, lineStarts, restriction);
    collectNodeDiagnostics(
      schema,
      issues,
      restriction,
      restrictionPath,
      restrictionLoc,
    );

    baseTypeName = restriction.getAttribute("base");
    const parsed = parseFacets(restriction);
    facets = parsed.facets;
    enumerations = parsed.enumerations;
  }

  const qName = node.getAttribute("name");
  const namespaceUri = schema.targetNamespace || null;

  return createSimpleTypeDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceUri,
    baseTypeName,
    facets,
    enumerations,
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseAttribute(node, xsdText, lineStarts, parentPath, schema, issues) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  const inlineSimpleTypeNode = elementChildren(node).find(
    (child) => child.localName === "simpleType",
  );
  const inlineType = inlineSimpleTypeNode
    ? parseSimpleType(
        inlineSimpleTypeNode,
        xsdText,
        lineStarts,
        path,
        schema,
        issues,
      )
    : null;

  const qName = node.getAttribute("name");
  const namespaceURI = getDeclarationNamespaceUri(schema, node, "attribute");

  return createAttributeDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceURI,
    typeName: node.getAttribute("type"),
    refName: node.getAttribute("ref"),
    inlineType,
    use: normalizeUse(node.getAttribute("use")),
    defaultValue: node.getAttribute("default"),
    fixedValue: node.getAttribute("fixed"),
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseAttributeGroupRef(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  return createAttributeGroupRef({
    refName: node.getAttribute("ref"),
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseAttributesContainer(
  nodes,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const attributes = [];

  for (const child of nodes) {
    if (child.localName === "attribute") {
      attributes.push(
        parseAttribute(child, xsdText, lineStarts, parentPath, schema, issues),
      );
    } else if (
      child.localName === "attributeGroup" &&
      child.hasAttribute("ref")
    ) {
      attributes.push(
        parseAttributeGroupRef(
          child,
          xsdText,
          lineStarts,
          parentPath,
          schema,
          issues,
        ),
      );
    }
  }

  return attributes;
}

function parseElement(node, xsdText, lineStarts, parentPath, schema, issues) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  let inlineType = null;
  const children = elementChildren(node);

  const inlineComplexTypeNode = children.find(
    (child) => child.localName === "complexType",
  );
  const inlineSimpleTypeNode = children.find(
    (child) => child.localName === "simpleType",
  );

  if (inlineComplexTypeNode) {
    inlineType = parseComplexType(
      inlineComplexTypeNode,
      xsdText,
      lineStarts,
      path,
      schema,
      issues,
    );
  } else if (inlineSimpleTypeNode) {
    inlineType = parseSimpleType(
      inlineSimpleTypeNode,
      xsdText,
      lineStarts,
      path,
      schema,
      issues,
    );
  }

  const qName = node.getAttribute("name");
  const namespaceUri = getDeclarationNamespaceUri(schema, node, "element");

  return createElementDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceUri,
    typeName: node.getAttribute("type"),
    refName: node.getAttribute("ref"),
    inlineType,
    minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
    maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
    defaultValue: node.getAttribute("default"),
    fixedValue: node.getAttribute("fixed"),
    nillable: node.getAttribute("nillable") === "true",
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseGroupRef(node, xsdText, lineStarts, parentPath, schema, issues) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  return createGroupRefNode({
    refName: node.getAttribute("ref"),
    minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
    maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseAny(node, xsdText, lineStarts, parentPath, schema, issues) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  return createAnyNode({
    namespace: node.getAttribute("namespace"),
    processContents: node.getAttribute("processContents"),
    minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
    maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseContentNode(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  switch (node.localName) {
    case "sequence":
      return createSequenceNode({
        children: parseContentChildren(
          node,
          xsdText,
          lineStarts,
          path,
          schema,
          issues,
        ),
        minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
        maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
        line: loc.line,
        column: loc.column,
        path,
      });

    case "choice":
      return createChoiceNode({
        children: parseContentChildren(
          node,
          xsdText,
          lineStarts,
          path,
          schema,
          issues,
        ),
        minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
        maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
        line: loc.line,
        column: loc.column,
        path,
      });

    case "all":
      return createAllNode({
        children: parseContentChildren(
          node,
          xsdText,
          lineStarts,
          path,
          schema,
          issues,
        ),
        minOccurs: normalizeOccurs(node.getAttribute("minOccurs"), 1),
        maxOccurs: normalizeOccurs(node.getAttribute("maxOccurs"), 1),
        line: loc.line,
        column: loc.column,
        path,
      });

    case "element":
      return parseElement(
        node,
        xsdText,
        lineStarts,
        parentPath,
        schema,
        issues,
      );

    case "group":
      if (node.hasAttribute("ref")) {
        return parseGroupRef(
          node,
          xsdText,
          lineStarts,
          parentPath,
          schema,
          issues,
        );
      }
      return null;

    case "any":
      return parseAny(node, xsdText, lineStarts, parentPath, schema, issues);

    default:
      return null;
  }
}

function parseContentChildren(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const children = [];

  for (const child of elementChildren(node)) {
    const parsed = parseContentNode(
      child,
      xsdText,
      lineStarts,
      parentPath,
      schema,
      issues,
    );
    if (parsed) children.push(parsed);
  }

  return children;
}

function parseDerivationNode(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  let content = null;

  const contentNode = elementChildren(node).find((child) =>
    ["sequence", "choice", "all", "group", "element", "any"].includes(
      child.localName,
    ),
  );

  if (contentNode) {
    content = parseContentNode(
      contentNode,
      xsdText,
      lineStarts,
      path,
      schema,
      issues,
    );
  }

  const attributes = parseAttributesContainer(
    elementChildren(node).filter(
      (child) =>
        child.localName === "attribute" || child.localName === "attributeGroup",
    ),
    xsdText,
    lineStarts,
    path,
    schema,
    issues,
  );

  return {
    derivation: {
      kind: node.localName,
      baseTypeName: node.getAttribute("base"),
    },
    content,
    attributes,
    line: loc.line,
    column: loc.column,
    path,
  };
}

function parseComplexType(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  let content = null;
  let attributes = [];
  let derivation = { kind: null, baseTypeName: null };

  const children = elementChildren(node);

  const directContentNode = children.find((child) =>
    ["sequence", "choice", "all", "group", "element", "any"].includes(
      child.localName,
    ),
  );

  if (directContentNode) {
    content = parseContentNode(
      directContentNode,
      xsdText,
      lineStarts,
      path,
      schema,
      issues,
    );
  }

  const complexContent = children.find(
    (child) => child.localName === "complexContent",
  );
  const simpleContent = children.find(
    (child) => child.localName === "simpleContent",
  );

  if (complexContent || simpleContent) {
    const wrapper = complexContent || simpleContent;
    const wrapperPath = buildPath(path, wrapper);
    const wrapperLoc = locateNodeInSource(xsdText, lineStarts, wrapper);
    collectNodeDiagnostics(schema, issues, wrapper, wrapperPath, wrapperLoc);

    const derivationNode = elementChildren(wrapper).find(
      (child) =>
        child.localName === "extension" || child.localName === "restriction",
    );

    if (derivationNode) {
      const parsed = parseDerivationNode(
        derivationNode,
        xsdText,
        lineStarts,
        wrapperPath,
        schema,
        issues,
      );
      derivation = parsed.derivation;
      if (parsed.content) content = parsed.content;
      attributes = parsed.attributes;
    }
  }

  if (attributes.length === 0) {
    attributes = parseAttributesContainer(
      children.filter(
        (child) =>
          child.localName === "attribute" ||
          child.localName === "attributeGroup",
      ),
      xsdText,
      lineStarts,
      path,
      schema,
      issues,
    );
  }

  const qName = node.getAttribute("name");
  const namespaceURI = schema.targetNamespace || null;

  return createComplexTypeDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceURI,
    content,
    attributes,
    derivation,
    mixed: node.getAttribute("mixed") === "true",
    abstract: node.getAttribute("abstract") === "true",
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseGroup(node, xsdText, lineStarts, parentPath, schema, issues) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  const contentNode = elementChildren(node).find((child) =>
    ["sequence", "choice", "all"].includes(child.localName),
  );

  const qName = node.getAttribute("name");
  const namespaceUri = schema.targetNamespace || null;

  return createGroupDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceUri,
    content: contentNode
      ? parseContentNode(contentNode, xsdText, lineStarts, path, schema, issues)
      : null,
    line: loc.line,
    column: loc.column,
    path,
  });
}

function parseAttributeGroup(
  node,
  xsdText,
  lineStarts,
  parentPath,
  schema,
  issues,
) {
  const path = buildPath(parentPath, node);
  const loc = locateNodeInSource(xsdText, lineStarts, node);

  collectNodeDiagnostics(schema, issues, node, path, loc);

  const attributes = parseAttributesContainer(
    elementChildren(node).filter(
      (child) =>
        child.localName === "attribute" || child.localName === "attributeGroup",
    ),
    xsdText,
    lineStarts,
    path,
    schema,
    issues,
  );

  const qName = node.getAttribute("name");
  const namespaceUri = schema.targetNamespace || null;

  return createAttributeGroupDecl({
    name: qName ? parseQName(qName).localName : null,
    qName,
    namespaceUri,
    attributes,
    line: loc.line,
    column: loc.column,
    path,
  });
}

export function buildSchemaModel(doc, options = {}) {
  const issues = [];
  const schema = createEmptySchemaModel();
  const xsdText = options.xsdText || "";
  const lineStarts = makeLineIndex(xsdText);
  const schemaRoot = getSchemaRoot(doc);

  if (!schemaRoot) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XSD_SCHEMA_NODE_MISSING,
        severity: "error",
        message: "Document root is not an xs:schema node.",
        source: "xsd",
      }),
    );

    return { schema: null, issues };
  }

  schema.targetNamespace = schemaRoot.getAttribute("targetNamespace");
  schema.elementFormDefault = schemaRoot.getAttribute("elementFormDefault");
  schema.attributeFormDefault = schemaRoot.getAttribute("attributeFormDefault");

  extractNamespaces(schemaRoot, schema);

  const rootPath = "/schema";
  const rootLoc = locateNodeInSource(xsdText, lineStarts, schemaRoot);
  collectNodeDiagnostics(schema, issues, schemaRoot, rootPath, rootLoc);

  const children = elementChildren(schemaRoot);

  for (const child of children) {
    switch (child.localName) {
      case "element": {
        const decl = parseElement(
          child,
          xsdText,
          lineStarts,
          rootPath,
          schema,
          issues,
        );
        registerGlobal(
          schema,
          issues,
          "elements",
          ISSUE_CODES.DUPLICATE_GLOBAL_ELEMENT,
          decl,
        );
        if (decl.name) {
          schema.roots.push({
            name: decl.name,
            qName: decl.qName,
            namespaceUri: decl.namespaceUri,
            typeName: decl.typeName || decl.inlineType?.name || null,
            line: decl.line,
            column: decl.column,
            path: decl.path,
          });
        }
        break;
      }

      case "complexType": {
        const decl = parseComplexType(
          child,
          xsdText,
          lineStarts,
          rootPath,
          schema,
          issues,
        );
        registerGlobal(
          schema,
          issues,
          "complexTypes",
          ISSUE_CODES.DUPLICATE_GLOBAL_COMPLEX_TYPE,
          decl,
        );
        break;
      }

      case "simpleType": {
        const decl = parseSimpleType(
          child,
          xsdText,
          lineStarts,
          rootPath,
          schema,
          issues,
        );
        registerGlobal(
          schema,
          issues,
          "simpleTypes",
          ISSUE_CODES.DUPLICATE_GLOBAL_SIMPLE_TYPE,
          decl,
        );
        break;
      }

      case "attribute": {
        const decl = parseAttribute(
          child,
          xsdText,
          lineStarts,
          rootPath,
          schema,
          issues,
        );
        registerGlobal(
          schema,
          issues,
          "attributes",
          ISSUE_CODES.DUPLICATE_GLOBAL_ATTRIBUTE,
          decl,
        );
        break;
      }

      case "group": {
        if (child.hasAttribute("name")) {
          const decl = parseGroup(
            child,
            xsdText,
            lineStarts,
            rootPath,
            schema,
            issues,
          );
          registerGlobal(
            schema,
            issues,
            "groups",
            ISSUE_CODES.DUPLICATE_GLOBAL_GROUP,
            decl,
          );
        } else {
          const path = buildPath(rootPath, child);
          const loc = locateNodeInSource(xsdText, lineStarts, child);
          collectNodeDiagnostics(schema, issues, child, path, loc);
        }
        break;
      }

      case "attributeGroup": {
        if (child.hasAttribute("name")) {
          const decl = parseAttributeGroup(
            child,
            xsdText,
            lineStarts,
            rootPath,
            schema,
            issues,
          );
          registerGlobal(
            schema,
            issues,
            "attributeGroups",
            ISSUE_CODES.DUPLICATE_GLOBAL_ATTRIBUTE_GROUP,
            decl,
          );
        } else {
          const path = buildPath(rootPath, child);
          const loc = locateNodeInSource(xsdText, lineStarts, child);
          collectNodeDiagnostics(schema, issues, child, path, loc);
        }
        break;
      }

      case "include": {
        const path = buildPath(rootPath, child);
        const loc = locateNodeInSource(xsdText, lineStarts, child);
        collectNodeDiagnostics(schema, issues, child, path, loc);
        recordExternalRef(schema, "include", child, path, loc);
        break;
      }

      case "import": {
        const path = buildPath(rootPath, child);
        const loc = locateNodeInSource(xsdText, lineStarts, child);
        collectNodeDiagnostics(schema, issues, child, path, loc);
        recordExternalRef(schema, "import", child, path, loc);
        break;
      }

      default: {
        const path = buildPath(rootPath, child);
        const loc = locateNodeInSource(xsdText, lineStarts, child);
        collectNodeDiagnostics(schema, issues, child, path, loc);
        break;
      }
    }
  }

  const externalDocuments = options.externalDocuments || {};

  const createDuplicateIssue = (code, decl) =>
    createIssue({
      code: ISSUE_CODES[code] || code,
      severity: "error",
      message: `Duplicate global ${decl.kind} declaration '${decl.name}'.`,
      line: decl.line,
      column: decl.column,
      path: decl.path,
      source: "xsd",
      nodeKind: decl.kind,
      name: decl.name,
      details: { declarationName: decl.name },
    });

const visited = options._visitedExternalSchemas || new Set();

const allExternalRefs = [
  ...(schema.externalRefs.includes || []),
  ...(schema.externalRefs.imports || []),
];

for (const ref of allExternalRefs) {
  if (!ref.schemaLocation) continue;

  // prevent circular / duplicate processing
  if (visited.has(ref.schemaLocation)) {
    continue;
  }

  const externalXsdText = externalDocuments[ref.schemaLocation];
  if (!externalXsdText) {
    continue;
  }

  visited.add(ref.schemaLocation);

  const parser = new DOMParser();
  const externalDoc = parser.parseFromString(
    externalXsdText,
    "application/xml"
  );

  const parserError = externalDoc.querySelector("parsererror");
  if (parserError) {
    continue;
  }

  const externalBuild = buildSchemaModel(externalDoc, {
    ...options,
    xsdText: externalXsdText,
    externalDocuments, // ✅ PASS THROUGH (critical)
    _visitedExternalSchemas: visited // ✅ recursion tracking
  });

  if (externalBuild.schema) {
    mergeGlobalsIntoSchema(
      schema,
      externalBuild.schema,
      issues,
      createDuplicateIssue
    );
  }

  issues.push(...(externalBuild.issues || []));
}

  return { schema, issues };
}
