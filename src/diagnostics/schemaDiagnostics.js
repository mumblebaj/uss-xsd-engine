import { createIssue } from "./createIssue.js";
import { ISSUE_CODES } from "./issueCodes.js";
import {
  isBuiltinType,
  resolveAttributeGroup,
  resolveGlobalAttribute,
  resolveGlobalElement,
  resolveGroup,
  resolveType
} from "../resolver/schemaResolvers.js";
import { runFacetDiagnostics } from "./schemaFacetDiagnostics.js";      

function buildStats(schema) {
  return {
    globalElementCount: Object.keys(schema.globals.elements).length,
    globalComplexTypeCount: Object.keys(schema.globals.complexTypes).length,
    globalSimpleTypeCount: Object.keys(schema.globals.simpleTypes).length,
    globalAttributeCount: Object.keys(schema.globals.attributes).length,
    globalGroupCount: Object.keys(schema.globals.groups).length,
    globalAttributeGroupCount: Object.keys(schema.globals.attributeGroups).length
  };
}

function sortUniqueStrings(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function getSupportedFeatures(schema) {
  return sortUniqueStrings(
    [...schema.usedFeatures]
      .filter((name) =>
        [
          "all",
          "attribute",
          "attributeGroup",
          "choice",
          "complexContent",
          "complexType",
          "element",
          "extension",
          "group",
          "restriction",
          "schema",
          "sequence",
          "simpleContent",
          "simpleType"
        ].includes(name)
      )
      .map((name) => `xs:${name}`)
  );
}

function getUnsupportedFeatures(schema) {
  return sortUniqueStrings(schema.unsupportedFeatures.map((item) => item.feature));
}

function checkUnknownTypes(schema, issues) {
  for (const ref of schema.references.types) {
    if (!ref.typeName) continue;
    if (isBuiltinType(ref.typeName)) continue;
    if (resolveType(schema, ref.typeName)) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.UNKNOWN_TYPE,
        severity: "error",
        message: `Type '${ref.typeName}' could not be resolved.`,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        source: "xsd",
        nodeKind: ref.nodeKind,
        name: ref.name,
        details: { typeName: ref.typeName }
      })
    );
  }
}

function checkUnknownRefs(schema, issues) {
  for (const ref of schema.references.refs) {
    const targetName = ref.refName;
    if (!targetName) continue;

    const resolved =
      ref.nodeKind === "attribute"
        ? resolveGlobalAttribute(schema, targetName)
        : resolveGlobalElement(schema, targetName);

    if (resolved) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.UNKNOWN_REF,
        severity: "error",
        message: `${ref.nodeKind === "attribute" ? "Attribute" : "Element"} reference '${targetName}' could not be resolved.`,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        source: "xsd",
        nodeKind: ref.nodeKind,
        name: ref.name,
        details: { refName: targetName }
      })
    );
  }
}

function checkMissingBaseTypes(schema, issues) {
  for (const ref of schema.references.baseTypes) {
    const targetName = ref.baseTypeName;
    if (!targetName) continue;
    if (isBuiltinType(targetName)) continue;
    if (resolveType(schema, targetName)) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.MISSING_BASE_TYPE,
        severity: "error",
        message: `Base type '${targetName}' could not be resolved.`,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        source: "xsd",
        nodeKind: ref.nodeKind,
        name: ref.name,
        details: { baseTypeName: targetName }
      })
    );
  }
}

function checkUnknownGroups(schema, issues) {
  for (const ref of schema.references.groupRefs) {
    if (resolveGroup(schema, ref.refName)) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.UNKNOWN_GROUP,
        severity: "error",
        message: `Group reference '${ref.refName}' could not be resolved.`,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        source: "xsd",
        nodeKind: ref.nodeKind,
        name: ref.name,
        details: { refName: ref.refName }
      })
    );
  }
}

function checkUnknownAttributeGroups(schema, issues) {
  for (const ref of schema.references.attributeGroupRefs) {
    if (resolveAttributeGroup(schema, ref.refName)) continue;

    issues.push(
      createIssue({
        code: ISSUE_CODES.UNKNOWN_ATTRIBUTE_GROUP,
        severity: "error",
        message: `Attribute group reference '${ref.refName}' could not be resolved.`,
        line: ref.line,
        column: ref.column,
        path: ref.path,
        source: "xsd",
        nodeKind: ref.nodeKind,
        name: ref.name,
        details: { refName: ref.refName }
      })
    );
  }
}

function emitUnsupportedFeatureWarnings(schema, issues, options) {
  if (options.includeWarnings === false) return;

  for (const feature of schema.unsupportedFeatures) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.UNSUPPORTED_FEATURE,
        severity: "warning",
        message: `Feature '${feature.feature}' is recognized but not yet supported.`,
        line: feature.line,
        column: feature.column,
        path: feature.path,
        source: "engine",
        nodeKind: feature.nodeKind,
        name: feature.name,
        details: { feature: feature.feature }
      })
    );
  }
}

export function runSchemaDiagnostics(schema, options = {}) {
  const issues = [];

  checkUnknownTypes(schema, issues);
  checkUnknownRefs(schema, issues);
  checkMissingBaseTypes(schema, issues);
  checkUnknownGroups(schema, issues);
  checkUnknownAttributeGroups(schema, issues);
  emitUnsupportedFeatureWarnings(schema, issues, options);

  const facetIssues = runFacetDiagnostics(schema, options);
  issues.push(...facetIssues);

  return {
    data: {
      roots: options.includeRoots === false ? [] : schema.roots,
      supportedFeatures: options.includeFeatureSummary === false ? [] : getSupportedFeatures(schema),
      unsupportedFeatures: options.includeFeatureSummary === false ? [] : getUnsupportedFeatures(schema),
      schemaStats: buildStats(schema)
    },
    issues
  };
}