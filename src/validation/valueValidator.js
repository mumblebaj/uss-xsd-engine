import {
  getEffectiveSimpleType,
  isBuiltinType,
  resolveAttributeType,
  resolveElementType,
  stripNamespacePrefix
} from "../resolver/schemaResolvers.js";
import { validateBuiltinType } from "./builtinTypeValidators.js";
import { validateFacets } from "./facetUtils.js";

function validateByDeclType(schema, decl, value, kindLabel) {
  const resolvedType =
    kindLabel === "attribute"
      ? resolveAttributeType(schema, decl)
      : resolveElementType(schema, decl);

  return validateResolvedValue(schema, resolvedType, value);
}

export function validateElementValue(schema, elementDecl, value) {
  const fixed = elementDecl.fixedValue;

  if (fixed != null) {
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

  if (fixed != null) {
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
    const effective = getEffectiveSimpleType(schema, resolvedType);

    if (effective.enumerations?.length) {
      const allowed = effective.enumerations.map(String);
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