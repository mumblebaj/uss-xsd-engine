import {
  getEffectiveSimpleType,
  isBuiltinType,
  resolveAttributeType,
  resolveElementType,
  stripNamespacePrefix
} from "../resolver/schemaResolvers.js";
import { validateBuiltinType } from "./builtinTypeValidators.js";
import { validateFacets } from "./facetUtils.js";

export function validateElementValue(schema, elementDecl, value) {
  const resolvedType = resolveElementType(schema, elementDecl);
  return validateResolvedValue(schema, resolvedType, value);
}

export function validateAttributeValue(schema, attributeDecl, value) {
  const resolvedType = resolveAttributeType(schema, attributeDecl);
  return validateResolvedValue(schema, resolvedType, value);
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

    if (effective.baseTypeName && isBuiltinType(effective.baseTypeName)) {
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