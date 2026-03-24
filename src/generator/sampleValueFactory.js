import {
  getEffectiveSimpleType,
  isBuiltinType,
  stripNamespacePrefix
} from "../resolver/schemaResolvers.js";

function firstEnumeration(simpleTypeDecl) {
  const enums = simpleTypeDecl?.enumerations || [];
  return enums.length ? String(enums[0]) : null;
}

function padToLength(text, targetLength) {
  if (text.length >= targetLength) return text.slice(0, targetLength);
  return text.padEnd(targetLength, "x");
}

function applyLengthFacet(baseValue, facets = {}) {
  let value = String(baseValue);

  if (typeof facets.length === "number") {
    return padToLength(value, facets.length);
  }

  if (typeof facets.minLength === "number" && value.length < facets.minLength) {
    value = padToLength(value, facets.minLength);
  }

  if (typeof facets.maxLength === "number" && value.length > facets.maxLength) {
    value = value.slice(0, facets.maxLength);
  }

  return value;
}

function numericWithinFacets(defaultValue, facets = {}, isInteger = false) {
  if (facets.minInclusive != null) return String(facets.minInclusive);

  if (facets.minExclusive != null) {
    const n = Number(facets.minExclusive);
    if (Number.isFinite(n)) return String(isInteger ? Math.floor(n + 1) : n + 0.1);
  }

  if (facets.maxInclusive != null) return String(facets.maxInclusive);

  if (facets.maxExclusive != null) {
    const n = Number(facets.maxExclusive);
    if (Number.isFinite(n)) return String(isInteger ? Math.ceil(n - 1) : n - 0.1);
  }

  return defaultValue;
}

function applyDigitFacets(value, facets = {}) {
  let text = String(value);

  if (typeof facets.fractionDigits === "number") {
    const num = Number(text);
    if (Number.isFinite(num)) {
      text = num.toFixed(facets.fractionDigits);
    }
  }

  if (typeof facets.totalDigits === "number") {
    const stripped = text.replace(/^[-+]/, "").replace(".", "");
    if (stripped.length > facets.totalDigits) {
      const replacement = "1".repeat(facets.totalDigits);
      text = typeof facets.fractionDigits === "number" && facets.fractionDigits > 0
        ? `${replacement.slice(0, Math.max(1, facets.totalDigits - facets.fractionDigits))}.${replacement.slice(Math.max(1, facets.totalDigits - facets.fractionDigits))}`
        : replacement;
    }
  }

  return text;
}

function patternSample(patterns = [], fallback = "example") {
  const pattern = patterns[0];
  if (!pattern) return fallback;

  if (pattern === "[A-Z]+") return "ABC";
  if (pattern === "[0-9]+") return "123";
  if (pattern === "[A-Z0-9]+") return "ABC123";
  if (pattern === "[a-z]+") return "abc";
  if (pattern == "[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}") return "de2da6c9-18be-48d4-8053-867ed90a316a";
  if (pattern == "[A-Z0-9]{4,4}[A-Z]{2,2}[A-Z0-9]{2,2}([A-Z0-9]{3,3}){0,1}") return "ABCDEFGH";

  return fallback;
}

function builtinSample(localTypeName) {
  switch (localTypeName) {
    case "string":
    case "normalizedString":
    case "token":
    case "language":
    case "Name":
    case "NCName":
    case "ID":
    case "IDREF":
    case "NMTOKEN":
    case "anyURI":
    case "QName":
      return "example";

    case "boolean":
      return "true";

    case "decimal":
    case "float":
    case "double":
      return "0.00";

    case "integer":
    case "nonPositiveInteger":
    case "negativeInteger":
    case "long":
    case "int":
    case "short":
    case "byte":
    case "nonNegativeInteger":
    case "unsignedLong":
    case "unsignedInt":
    case "unsignedShort":
    case "unsignedByte":
    case "positiveInteger":
      return "0";

    case "date":
      return "2026-01-01";

    case "time":
      return "00:00:00";

    case "dateTime":
      return "2026-01-01T00:00:00+00:00";

    case "duration":
      return "P1D";

    case "gYear":
      return "2026";

    case "gYearMonth":
      return "2026-01";

    case "gMonth":
      return "--01";

    case "gMonthDay":
      return "--01-01";

    case "gDay":
      return "---01";

    case "hexBinary":
      return "0A";

    case "base64Binary":
      return "ZXhhbXBsZQ==";

    default:
      return "example";
  }
}

export function createSampleValueForType(schema, resolvedType) {
  if (!resolvedType) return "example";

  if (resolvedType.kind === "builtinType") {
    return builtinSample(stripNamespacePrefix(resolvedType.name));
  }

  if (resolvedType.kind === "simpleType") {
    const effective = getEffectiveSimpleType(schema, resolvedType);
    const enumValue = firstEnumeration(effective);
    if (enumValue != null) return enumValue;

    const baseType = effective?.baseTypeName;
    const facets = effective?.facets || {};

    if (baseType && isBuiltinType(baseType)) {
      const local = stripNamespacePrefix(baseType);

      if (facets.pattern?.length) {
        return applyLengthFacet(patternSample(facets.pattern, builtinSample(local)), facets);
      }

      let value = builtinSample(local);

      if (
        [
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
          "positiveInteger"
        ].includes(local)
      ) {
        value = numericWithinFacets(value, facets, true);
        value = applyDigitFacets(value, facets);
        return value;
      }

      if (["decimal", "float", "double"].includes(local)) {
        value = numericWithinFacets(value, facets, false);
        value = applyDigitFacets(value, facets);
        return value;
      }

      return applyLengthFacet(value, facets);
    }

    if (facets.pattern?.length) {
      return applyLengthFacet(patternSample(facets.pattern, "example"), facets);
    }

    return applyLengthFacet("example", facets);
  }

  return "example";
}