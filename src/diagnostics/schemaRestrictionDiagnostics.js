import { createIssue } from "./createIssue.js";
import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveGlobalComplexType
} from "../resolver/schemaResolvers.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function localDeclName(node) {
  return node?.refName || node?.name || null;
}

function flattenContent(node, out = []) {
  if (!node) return out;

  switch (node.kind) {
    case "sequence":
    case "choice":
    case "all":
      for (const child of asArray(node.children)) {
        flattenContent(child, out);
      }
      return out;

    case "groupRef":
      out.push({
        kind: "groupRef",
        name: node.refName,
        minOccurs: node.minOccurs,
        maxOccurs: node.maxOccurs,
        line: node.line,
        column: node.column,
        path: node.path
      });
      return out;

    case "element":
      out.push({
        kind: "element",
        name: localDeclName(node),
        minOccurs: node.minOccurs,
        maxOccurs: node.maxOccurs,
        line: node.line,
        column: node.column,
        path: node.path
      });
      return out;

    default:
      return out;
  }
}

function maxToNumber(value) {
  return value === "unbounded" ? Infinity : value;
}

function isWiderRestriction(derived, base) {
  const dMin = typeof derived.minOccurs === "number" ? derived.minOccurs : 1;
  const bMin = typeof base.minOccurs === "number" ? base.minOccurs : 1;
  const dMax = maxToNumber(derived.maxOccurs ?? 1);
  const bMax = maxToNumber(base.maxOccurs ?? 1);

  return dMin < bMin || dMax > bMax;
}

function attributeUseRank(use) {
  switch (use) {
    case "required": return 3;
    case "optional": return 2;
    case "prohibited": return 1;
    default: return 2;
  }
}

function buildRestrictionIssue(code, message, node) {
  return createIssue({
    code,
    severity: "warning",
    message,
    source: "xsd",
    nodeKind: node?.kind || "complexType",
    name: node?.name || null,
    line: node?.line ?? null,
    column: node?.column ?? null,
    path: node?.path ?? null,
    details: {}
  });
}

function checkRestrictedContentSubset(schema, derivedType, baseType, issues) {
  const derivedContent = flattenContent(getEffectiveContent(schema, derivedType), []);
  const baseContent = flattenContent(getEffectiveContent(schema, baseType), []);

  const baseMap = new Map(baseContent.map((item) => [item.name, item]));

  for (const item of derivedContent) {
    const baseItem = baseMap.get(item.name);

    if (!baseItem) {
      issues.push(
        buildRestrictionIssue(
          "XSD_RESTRICTION_NOT_SUBSET",
          `Restricted type contains element/group '${item.name}' that does not exist in base type '${baseType.name}'.`,
          item
        )
      );
      continue;
    }

    if (isWiderRestriction(item, baseItem)) {
      issues.push(
        buildRestrictionIssue(
          "XSD_RESTRICTION_OCCURS_WIDENED",
          `Restricted type widens occurrence constraints for '${item.name}'.`,
          item
        )
      );
    }
  }
}

function checkRestrictedAttributes(schema, derivedType, baseType, issues) {
  const derivedAttrs = asArray(getEffectiveAttributes(schema, derivedType));
  const baseAttrs = asArray(getEffectiveAttributes(schema, baseType));

  const baseMap = new Map(
    baseAttrs
      .filter((attr) => attr?.kind === "attribute")
      .map((attr) => [localDeclName(attr), attr])
  );

  for (const attr of derivedAttrs) {
    if (attr?.kind !== "attribute") continue;

    const name = localDeclName(attr);
    const baseAttr = baseMap.get(name);

    if (!baseAttr) {
      issues.push(
        buildRestrictionIssue(
          "XSD_RESTRICTION_NOT_SUBSET",
          `Restricted type contains attribute '${name}' that does not exist in base type '${baseType.name}'.`,
          attr
        )
      );
      continue;
    }

    if (attributeUseRank(attr.use) > attributeUseRank(baseAttr.use)) {
      issues.push(
        buildRestrictionIssue(
          "XSD_RESTRICTION_ATTRIBUTE_WIDENED",
          `Restricted type widens attribute constraint for '${name}'.`,
          attr
        )
      );
    }
  }
}

export function runRestrictionDiagnostics(schema) {
  const issues = [];

  for (const complexType of Object.values(schema.globals.complexTypes || {})) {
    if (complexType?.derivation?.kind !== "restriction") continue;
    if (!complexType?.derivation?.baseTypeName) continue;

    const baseType = resolveGlobalComplexType(schema, complexType.derivation.baseTypeName);
    if (!baseType) continue;

    checkRestrictedContentSubset(schema, complexType, baseType, issues);
    checkRestrictedAttributes(schema, complexType, baseType, issues);
  }

  return issues;
}