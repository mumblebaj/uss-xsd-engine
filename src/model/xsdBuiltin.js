// model/xsdBuiltins.js

export const XSD_BUILTIN_TYPE_NAMES = new Set([
  "string",
  "boolean",
  "decimal",
  "float",
  "double",
  "duration",
  "dateTime",
  "time",
  "date",
  "gYearMonth",
  "gYear",
  "gMonthDay",
  "gDay",
  "gMonth",
  "hexBinary",
  "base64Binary",
  "anyURI",
  "QName",
  "NOTATION",
  "normalizedString",
  "token",
  "language",
  "NMTOKEN",
  "NMTOKENS",
  "Name",
  "NCName",
  "ID",
  "IDREF",
  "IDREFS",
  "ENTITY",
  "ENTITIES",
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
  "anySimpleType",
  "anyType"
]);

export function isBuiltInXsdTypeName(typeName) {
  if (!typeName) return false;

  if (typeName.startsWith("xs:")) {
    return XSD_BUILTIN_TYPE_NAMES.has(typeName.slice(3));
  }

  if (typeName.includes(":")) {
    return false;
  }

  return XSD_BUILTIN_TYPE_NAMES.has(typeName);
}

export function normalizeBuiltInXsdTypeName(typeName) {
  if (!typeName) return null;

  if (typeName.startsWith("xs:")) {
    return typeName;
  }

  if (typeName.includes(":")) {
    return typeName;
  }

  return XSD_BUILTIN_TYPE_NAMES.has(typeName) ? `xs:${typeName}` : typeName;
}