import {
  getEffectiveSimpleType,
  isBuiltinType,
  resolveAttributeType,
  resolveElementType,
  resolveType,
  stripNamespacePrefix
} from "../resolver/schemaResolvers.js";
import { validateBuiltinType } from "./builtinTypeValidators.js";
import { validateFacets } from "./facetUtils.js";
import { validateNotationUsage } from "./notationValidator.js";

function enumerationValue(enumeration) {
  if (enumeration && typeof enumeration === "object") {
    return enumeration.value;
  }
  return enumeration;
}

function validateByDeclType(schema, decl, value, kindLabel) {
  const resolvedType =
    kindLabel === "attribute"
      ? resolveAttributeType(schema, decl)
      : resolveElementType(schema, decl);

  return validateResolvedValue(schema, resolvedType, value);
}

export function validateElementValue(schema, elementDecl, value) {
  const fixed = elementDecl.fixedValue;

  if (fixed != null && fixed !== "") {
    if (value !== fixed) {
      return {
        ok: false,
        code: "XML_FIXED_VALUE_MISMATCH",
        message: `Element '${elementDecl.name || elementDecl.refName}' must have fixed value '${fixed}'.`
      };
    }
    return { ok: true, code: null, message: null };
  }

  return validateByDeclType(schema, elementDecl, value, "element");
}

export function validateAttributeValue(schema, attrDecl, value) {
  const fixed = attrDecl.fixedValue;

  if (fixed != null && fixed !== "") {
    if (value !== fixed) {
      return {
        ok: false,
        code: "XML_FIXED_VALUE_MISMATCH",
        message: `Attribute '${attrDecl.name || attrDecl.refName}' must have fixed value '${fixed}'.`
      };
    }
    return { ok: true, code: null, message: null };
  }

  return validateByDeclType(schema, attrDecl, value, "attribute");
}

function validateListValue(schema, simpleType, value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/\s+/).filter(Boolean);

  for (const item of values) {
    const itemType = simpleType.itemType ? resolveType(schema, simpleType.itemType) : null;
    if (!itemType) {
      return { ok: true, code: null, message: null };
    }

    const itemResult = validateResolvedValue(schema, itemType, item);
    if (!itemResult.ok) {
      return {
        ok: false,
        code: "XML_VALUE_INVALID",
        message: `List item '${item}' is not valid for type '${simpleType.itemType}'.`
      };
    }
  }

  return { ok: true, code: null, message: null };
}

function validateUnionValue(schema, simpleType, value) {
  const memberTypes = Array.isArray(simpleType.memberTypes) && simpleType.memberTypes.length
    ? simpleType.memberTypes
    : [];

  if (!memberTypes.length) {
    return { ok: true, code: null, message: null };
  }

  for (const memberTypeName of memberTypes) {
    const memberType = resolveType(schema, memberTypeName);
    if (!memberType) {
      continue;
    }

    const memberResult = validateResolvedValue(schema, memberType, value);
    if (memberResult.ok) {
      return { ok: true, code: null, message: null };
    }
  }

  return {
    ok: false,
    code: "XML_VALUE_INVALID",
    message: `Value '${value}' is not valid for any union member type.`
  };
}

export function validateResolvedValue(schema, resolvedType, value) {
  if (!resolvedType) {
    return { ok: true, code: null, message: null };
  }

  if (resolvedType.kind === "builtinType") {
    const local = stripNamespacePrefix(resolvedType.name);
    const ok = validateBuiltinType(local, value);
    return ok
      ? { ok: true, code: null, message: null }
      : {
          ok: false,
          code: "XML_VALUE_INVALID",
          message: `Value '${value}' is not valid for type '${local}'.`
        };
  }

  if (resolvedType.kind === "simpleType") {
    if (resolvedType.contentKind === "list") {
      return validateListValue(schema, resolvedType, value);
    }

    if (resolvedType.name) {
      const notationDecl = schema?.globals?.notations?.[`${resolvedType.namespaceUri || ""}::${resolvedType.name}`];
      if (notationDecl) {
        const notationResult = validateNotationUsage(schema, value, notationDecl);
        if (!notationResult.ok) {
          return notationResult;
        }
      }
    }

    if (resolvedType.contentKind === "union") {
      return validateUnionValue(schema, resolvedType, value);
    }

    const effective = getEffectiveSimpleType(schema, resolvedType);

    if (effective.enumerations?.length) {
      const allowed = effective.enumerations
        .map((item) => enumerationValue(item))
        .filter((item) => item != null)
        .map(String);
      if (!allowed.includes(String(value))) {
        return {
          ok: false,
          code: "XML_ENUMERATION_MISMATCH",
          message: `Value '${value}' is not one of the allowed enumeration values: ${allowed.join(", ")}.`
        };
      }
    }

    if (effective.baseTypeName && isBuiltinType(effective.baseTypeName, schema)) {
      const local = stripNamespacePrefix(effective.baseTypeName);
      const builtinOk = validateBuiltinType(local, value);

      if (!builtinOk) {
        return {
          ok: false,
          code: "XML_VALUE_INVALID",
          message: `Value '${value}' is not valid for base type '${local}'.`
        };
      }
    }

    const facetResult = validateFacets(value, effective.facets || {});
    if (!facetResult.ok) {
      return facetResult;
    }

    return { ok: true, code: null, message: null };
  }

  return { ok: true, code: null, message: null };
}