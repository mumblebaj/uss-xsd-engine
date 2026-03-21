import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";
import { isBuiltinType, stripNamespacePrefix } from "../resolver/schemaResolvers.js";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function checkLengthConflicts(simpleType, issues, ctx) {
  const f = simpleType.facets || {};

  if (f.length != null) {
    if (f.minLength != null && f.length < f.minLength) {
      issues.push(ctx.issue("XSD_LENGTH_CONFLICT", `length (${f.length}) is less than minLength (${f.minLength}).`, simpleType));
    }
    if (f.maxLength != null && f.length > f.maxLength) {
      issues.push(ctx.issue("XSD_LENGTH_CONFLICT", `length (${f.length}) exceeds maxLength (${f.maxLength}).`, simpleType));
    }
  }

  if (f.minLength != null && f.maxLength != null && f.minLength > f.maxLength) {
    issues.push(ctx.issue("XSD_LENGTH_CONFLICT", `minLength (${f.minLength}) is greater than maxLength (${f.maxLength}).`, simpleType));
  }
}

function checkNumericConflicts(simpleType, issues, ctx) {
  const f = simpleType.facets || {};

  const minInc = toNumber(f.minInclusive);
  const maxInc = toNumber(f.maxInclusive);
  const minExc = toNumber(f.minExclusive);
  const maxExc = toNumber(f.maxExclusive);

  if (minInc != null && maxInc != null && minInc > maxInc) {
    issues.push(ctx.issue("XSD_NUMERIC_RANGE_CONFLICT", `minInclusive (${minInc}) > maxInclusive (${maxInc}).`, simpleType));
  }

  if (minExc != null && maxExc != null && minExc >= maxExc) {
    issues.push(ctx.issue("XSD_NUMERIC_RANGE_CONFLICT", `minExclusive (${minExc}) >= maxExclusive (${maxExc}).`, simpleType));
  }

  if (minInc != null && maxExc != null && minInc >= maxExc) {
    issues.push(ctx.issue("XSD_NUMERIC_RANGE_CONFLICT", `minInclusive (${minInc}) >= maxExclusive (${maxExc}).`, simpleType));
  }

  if (minExc != null && maxInc != null && minExc >= maxInc) {
    issues.push(ctx.issue("XSD_NUMERIC_RANGE_CONFLICT", `minExclusive (${minExc}) >= maxInclusive (${maxInc}).`, simpleType));
  }
}

function checkDigitConflicts(simpleType, issues, ctx) {
  const f = simpleType.facets || {};

  if (f.totalDigits != null && f.totalDigits <= 0) {
    issues.push(ctx.issue("XSD_DIGITS_INVALID", `totalDigits must be > 0.`, simpleType));
  }

  if (f.fractionDigits != null && f.fractionDigits < 0) {
    issues.push(ctx.issue("XSD_DIGITS_INVALID", `fractionDigits must be >= 0.`, simpleType));
  }

  if (
    f.totalDigits != null &&
    f.fractionDigits != null &&
    f.fractionDigits > f.totalDigits
  ) {
    issues.push(
      ctx.issue(
        "XSD_DIGITS_CONFLICT",
        `fractionDigits (${f.fractionDigits}) cannot exceed totalDigits (${f.totalDigits}).`,
        simpleType
      )
    );
  }
}

function checkEnumeration(simpleType, issues, ctx) {
  const enums = simpleType.enumerations || [];

  if (enums.length === 0) return;

  const seen = new Set();
  for (const val of enums) {
    if (seen.has(val)) {
      issues.push(ctx.issue("XSD_ENUM_DUPLICATE", `Duplicate enumeration value '${val}'.`, simpleType));
    }
    seen.add(val);
  }
}

function checkPattern(simpleType, issues, ctx) {
  const patterns = simpleType.facets?.pattern || [];

  for (const pattern of patterns) {
    try {
      new RegExp(pattern);
    } catch {
      issues.push(ctx.issue("XSD_PATTERN_INVALID", `Invalid regex pattern '${pattern}'.`, simpleType));
    }
  }
}

function allowedFacetMap() {
  return {
    string: ["length", "minLength", "maxLength", "pattern", "enumeration"],
    normalizedString: ["length", "minLength", "maxLength", "pattern", "enumeration"],
    token: ["length", "minLength", "maxLength", "pattern", "enumeration"],
    anyURI: ["length", "minLength", "maxLength", "pattern", "enumeration"],
    QName: ["length", "minLength", "maxLength", "pattern", "enumeration"],

    decimal: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "totalDigits", "fractionDigits", "pattern", "enumeration"],
    integer: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "totalDigits", "pattern", "enumeration"],

    boolean: ["pattern", "enumeration"],

    date: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    dateTime: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    time: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],

    gYear: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    gYearMonth: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    gMonth: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    gMonthDay: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"],
    gDay: ["minInclusive", "maxInclusive", "minExclusive", "maxExclusive", "pattern", "enumeration"]
  };
}

function checkFacetCompatibility(simpleType, issues, ctx) {
  const base = simpleType.baseTypeName;
  if (!base || !isBuiltinType(base)) return;

  const local = stripNamespacePrefix(base);
  const allowed = allowedFacetMap()[local];

  if (!allowed) return;

  for (const key of Object.keys(simpleType.facets || {})) {
    if (!allowed.includes(key)) {
      issues.push(
        ctx.issue(
          "XSD_FACET_NOT_ALLOWED",
          `Facet '${key}' is not valid for base type '${local}'.`,
          simpleType
        )
      );
    }
  }
}

export function runFacetDiagnostics(schema, options = {}) {
  const issues = [];

  const ctx = {
    issue: (code, message, node) =>
      createIssue({
        code,
        severity: "warning",
        message,
        source: "xsd",
        nodeKind: "simpleType",
        name: node.name,
        line: node.line,
        column: node.column
      })
  };

  for (const simpleType of Object.values(schema.globals.simpleTypes || {})) {
    checkFacetCompatibility(simpleType, issues, ctx);
    checkLengthConflicts(simpleType, issues, ctx);
    checkNumericConflicts(simpleType, issues, ctx);
    checkDigitConflicts(simpleType, issues, ctx);
    checkEnumeration(simpleType, issues, ctx);
    checkPattern(simpleType, issues, ctx);
  }

  return issues;
}