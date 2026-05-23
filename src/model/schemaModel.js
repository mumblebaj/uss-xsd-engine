export function createEmptySchemaModel() {
  return {
    kind: "schema",
    targetNamespace: null,
    elementFormDefault: null,
    attributeFormDefault: null,

    namespaces: {
      default: null,
      prefixes: Object.create(null)
    },

    globals: {
      elements: Object.create(null),
      complexTypes: Object.create(null),
      simpleTypes: Object.create(null),
      attributes: Object.create(null),
      groups: Object.create(null),
      attributeGroups: Object.create(null)
    },

    documents: [],
    externalRefs: {
      includes: [],
      imports: []
    },

    importedSchemas: [],

    roots: [],

    identityConstraints: [],

    references: {
      types: [],
      refs: [],
      baseTypes: [],
      groupRefs: [],
      attributeGroupRefs: []
    },

    usedFeatures: new Set(),
    unsupportedFeatures: [],
    sourceInfo: {
      systemId: null
    }
  };
}

export function normalizeOccurs(value, fallback = 1) {
  if (value == null || value === "") return fallback;
  if (value === "unbounded") return "unbounded";

  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;

  return fallback;
}

export function normalizeUse(value) {
  if (!value) return null;
  if (value === "optional" || value === "required" || value === "prohibited") {
    return value;
  }
  return null;
}

export function createElementDecl({
  name = null,
  qName = null,
  namespaceUri = null,
  typeName = null,
  refName = null,
  inlineType = null,
  minOccurs = 1,
  maxOccurs = 1,
  defaultValue = null,
  fixedValue = null,
  nillable = false,
  identityConstraints = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "element",
    name,
    qName,
    namespaceUri,
    typeName,
    refName,
    inlineType,
    minOccurs,
    maxOccurs,
    defaultValue,
    fixedValue,
    nillable,
    identityConstraints,
    line,
    column,
    path
  };
}

export function createAttributeDecl({
  name = null,
  qName = null,
  namespaceUri = null,
  typeName = null,
  refName = null,
  inlineType = null,
  use = null,
  defaultValue = null,
  fixedValue = null,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "attribute",
    name,
    qName,
    namespaceUri,
    typeName,
    refName,
    inlineType,
    use,
    defaultValue,
    fixedValue,
    line,
    column,
    path
  };
}

export function createComplexTypeDecl({
  name = null,
  qName = null,
  namespaceUri = null,
  content = null,
  attributes = [],
  derivation = { kind: null, baseTypeName: null },
  contentModel = "complex",
  mixed = false,
  abstract = false,
  identityConstraints = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "complexType",
    name,
    qName,
    namespaceUri,
    content,
    attributes,
    derivation,
    contentModel,
    mixed,
    abstract,
    identityConstraints,
    line,
    column,
    path
  };
}

export function createSimpleTypeDecl({
  name = null,
  qName = null,
  namespaceUri = null,
  baseTypeName = null,
  facets = {},
  enumerations = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "simpleType",
    name,
    qName,
    namespaceUri,
    baseTypeName,
    facets,
    enumerations,
    line,
    column,
    path
  };
}

export function createGroupDecl({
  name,
  qName = null,
  namespaceUri = null,
  content = null,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "group",
    name,
    qName,
    namespaceUri,
    content,
    line,
    column,
    path
  };
}

export function createAttributeGroupDecl({
  name,
  qName = null,
  namespaceUri = null,
  attributes = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "attributeGroup",
    name,
    qName,
    namespaceUri,
    attributes,
    line,
    column,
    path
  };
}

export function createAttributeGroupRef({
  refName,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "attributeGroupRef",
    refName,
    line,
    column,
    path
  };
}

export function createIdentityConstraint({
  kind = null,
  name = null,
  qName = null,
  namespaceUri = null,
  selector = null,
  fields = [],
  refer = null,
  ownerName = null,
  ownerNamespaceUri = null,
  ownerPath = null,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind,
    name,
    qName,
    namespaceUri,
    selector,
    fields,
    refer,
    ownerName,
    ownerNamespaceUri,
    ownerPath,
    line,
    column,
    path
  };
}

export function createSequenceNode({
  children = [],
  minOccurs = 1,
  maxOccurs = 1,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "sequence",
    children,
    minOccurs,
    maxOccurs,
    line,
    column,
    path
  };
}

export function createChoiceNode({
  children = [],
  minOccurs = 1,
  maxOccurs = 1,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "choice",
    children,
    minOccurs,
    maxOccurs,
    line,
    column,
    path
  };
}

export function createAllNode({
  children = [],
  minOccurs = 1,
  maxOccurs = 1,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "all",
    children,
    minOccurs,
    maxOccurs,
    line,
    column,
    path
  };
}

export function createGroupRefNode({
  refName,
  minOccurs = 1,
  maxOccurs = 1,
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "groupRef",
    refName,
    minOccurs,
    maxOccurs,
    line,
    column,
    path
  };
}

export function createAnyNode({
  namespace = null,
  processContents = "strict",
  minOccurs = 1,
  maxOccurs = 1,
  notNamespace = [],
  notQName = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "any",
    namespace,
    processContents: processContents || "strict",
    minOccurs,
    maxOccurs,
    notNamespace,
    notQName,
    line,
    column,
    path
  };
}

export function createAnyAttributeNode({
  namespace = null,
  processContents = "strict",
  notNamespace = [],
  notQName = [],
  line = null,
  column = null,
  path = null
} = {}) {
  return {
    kind: "anyAttribute",
    namespace,
    processContents: processContents || "strict",
    notNamespace,
    notQName,
    line,
    column,
    path
  };
}