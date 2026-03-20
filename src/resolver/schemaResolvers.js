const BUILTIN_TYPES = new Set([
  "string",
  "normalizedString",
  "token",
  "language",
  "Name",
  "NCName",
  "ID",
  "IDREF",
  "IDREFS",
  "ENTITY",
  "ENTITIES",
  "NMTOKEN",
  "NMTOKENS",
  "boolean",
  "decimal",
  "float",
  "double",
  "integer",
  "nonPositiveInteger",
  "negativeInteger",
  "long",
  "int",
  "short",
  "byte",
  "nonNegativeInteger",
  "unsignedLong",
  "unsignedInt",
  "unsignedShort",
  "unsignedByte",
  "positiveInteger",
  "date",
  "time",
  "dateTime",
  "duration",
  "gYear",
  "gYearMonth",
  "gMonth",
  "gMonthDay",
  "gDay",
  "hexBinary",
  "base64Binary",
  "anyURI",
  "QName",
  "NOTATION"
]);

export function parseQName(name) {
  if (!name || typeof name !== "string") {
    return { prefix: null, localName: null, qName: name || null };
  }

  const idx = name.indexOf(":");
  if (idx < 0) {
    return { prefix: null, localName: name, qName: name };
  }

  return {
    prefix: name.slice(0, idx),
    localName: name.slice(idx + 1),
    qName: name
  };
}

export function stripNamespacePrefix(name) {
  return parseQName(name).localName;
}

export function resolveNamespaceUri(schema, prefix) {
  if (!schema?.namespaces) return null;

  if (prefix == null || prefix === "") {
    return schema.namespaces.default || null;
  }

  return schema.namespaces.prefixes?.[prefix] || null;
}

export function resolveQName(schema, qName) {
  const parsed = parseQName(qName);
  return {
    ...parsed,
    namespaceUri: resolveNamespaceUri(schema, parsed.prefix)
  };
}

export function makeLookupKey(namespaceUri, localName) {
  return `${namespaceUri || ""}::${localName || ""}`;
}

export function isBuiltinType(typeName, schema = null) {
  const q = parseQName(typeName);
  if (!q.localName) return false;

  if (BUILTIN_TYPES.has(q.localName)) {
    if (!q.prefix) return true;
    if (!schema) return true;

    const ns = resolveNamespaceUri(schema, q.prefix);
    return ns === "http://www.w3.org/2001/XMLSchema";
  }

  return false;
}

function lookupByQName(bucket, schema, name) {
  if (!bucket || !name) return null;

  const resolved = resolveQName(schema, name);
  const directKey = makeLookupKey(resolved.namespaceUri, resolved.localName);

  return (
    bucket[directKey] ||
    bucket[makeLookupKey(null, resolved.localName)] ||
    null
  );
}

export function resolveGlobalElement(schema, name) {
  return lookupByQName(schema?.globals?.elements, schema, name);
}

export function resolveGlobalComplexType(schema, name) {
  return lookupByQName(schema?.globals?.complexTypes, schema, name);
}

export function resolveGlobalSimpleType(schema, name) {
  return lookupByQName(schema?.globals?.simpleTypes, schema, name);
}

export function resolveGlobalAttribute(schema, name) {
  return lookupByQName(schema?.globals?.attributes, schema, name);
}

export function resolveGroup(schema, name) {
  return lookupByQName(schema?.globals?.groups, schema, name);
}

export function resolveAttributeGroup(schema, name) {
  return lookupByQName(schema?.globals?.attributeGroups, schema, name);
}

export function resolveType(schema, typeName) {
  if (!typeName) return null;

  if (isBuiltinType(typeName, schema)) {
    return {
      kind: "builtinType",
      name: parseQName(typeName).localName,
      qName: typeName
    };
  }

  return (
    resolveGlobalSimpleType(schema, typeName) ||
    resolveGlobalComplexType(schema, typeName) ||
    null
  );
}

export function resolveElementType(schema, elementDecl) {
  if (!elementDecl) return null;
  if (elementDecl.inlineType) return elementDecl.inlineType;
  if (elementDecl.typeName) return resolveType(schema, elementDecl.typeName);
  if (elementDecl.refName) {
    const target = resolveGlobalElement(schema, elementDecl.refName);
    if (!target) return null;
    return resolveElementType(schema, target);
  }
  return null;
}

export function resolveAttributeType(schema, attributeDecl) {
  if (!attributeDecl) return null;
  if (attributeDecl.inlineType) return attributeDecl.inlineType;
  if (attributeDecl.typeName) return resolveType(schema, attributeDecl.typeName);
  if (attributeDecl.refName) {
    const target = resolveGlobalAttribute(schema, attributeDecl.refName);
    if (!target) return null;
    return resolveAttributeType(schema, target);
  }
  return null;
}

export function getEffectiveSimpleType(schema, simpleTypeDecl) {
  if (!simpleTypeDecl) return null;

  const facets = { ...(simpleTypeDecl.facets || {}) };
  const enumerations = [...(simpleTypeDecl.enumerations || [])];

  if (simpleTypeDecl.baseTypeName && !isBuiltinType(simpleTypeDecl.baseTypeName, schema)) {
    const base = resolveGlobalSimpleType(schema, simpleTypeDecl.baseTypeName);
    if (base) {
      const baseEffective = getEffectiveSimpleType(schema, base);
      return {
        ...simpleTypeDecl,
        baseTypeName: baseEffective?.baseTypeName || simpleTypeDecl.baseTypeName,
        facets: {
          ...(baseEffective?.facets || {}),
          ...facets
        },
        enumerations: enumerations.length
          ? enumerations
          : [...(baseEffective?.enumerations || [])]
      };
    }
  }

  return {
    ...simpleTypeDecl,
    facets,
    enumerations
  };
}

export function getEffectiveFacets(schema, simpleTypeDecl) {
  return getEffectiveSimpleType(schema, simpleTypeDecl)?.facets || {};
}

function mergeAttributeArrays(baseAttrs = [], ownAttrs = []) {
  return [...baseAttrs, ...ownAttrs];
}

export function getEffectiveAttributes(schema, complexTypeDecl) {
  if (!complexTypeDecl) return [];

  const own = complexTypeDecl.attributes || [];
  const baseTypeName = complexTypeDecl.derivation?.baseTypeName;

  if (!baseTypeName || complexTypeDecl.derivation?.kind !== "extension") {
    return own;
  }

  const base = resolveGlobalComplexType(schema, baseTypeName);
  if (!base) return own;

  return mergeAttributeArrays(getEffectiveAttributes(schema, base), own);
}

export function getEffectiveContent(schema, complexTypeDecl) {
  if (!complexTypeDecl) return null;

  const ownContent = complexTypeDecl.content || null;
  const derivationKind = complexTypeDecl.derivation?.kind;
  const baseTypeName = complexTypeDecl.derivation?.baseTypeName;

  if (!baseTypeName || !derivationKind) {
    return ownContent;
  }

  const base = resolveGlobalComplexType(schema, baseTypeName);
  if (!base) return ownContent;

  const baseContent = getEffectiveContent(schema, base);

  if (derivationKind === "restriction") {
    return ownContent || baseContent;
  }

  if (derivationKind === "extension") {
    if (!baseContent) return ownContent;
    if (!ownContent) return baseContent;

    return {
      kind: "sequence",
      children: [baseContent, ownContent],
      minOccurs: 1,
      maxOccurs: 1,
      line: complexTypeDecl.line,
      column: complexTypeDecl.column,
      path: `${complexTypeDecl.path || ""}/effectiveExtensionSequence`
    };
  }

  return ownContent || baseContent;
}

export function getEffectiveComplexType(schema, complexTypeDecl) {
  if (!complexTypeDecl) return null;

  return {
    ...complexTypeDecl,
    content: getEffectiveContent(schema, complexTypeDecl),
    attributes: getEffectiveAttributes(schema, complexTypeDecl)
  };
}