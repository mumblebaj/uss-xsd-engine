import { parseXsd } from "../parser/parseXsd.js";
import { buildSchemaModel } from "../parser/buildSchemaModel.js";
import { runSchemaDiagnostics } from "../diagnostics/schemaDiagnostics.js";
import { makeResult } from "../utils/result.js";
import { extractTreeFromSchema } from "../tree/extractTree.js";
import { resolveAttributeGroup } from "../resolver/schemaResolvers.js";

export function extractSchemaTree({ xsdText, options = {} } = {}) {
  const parseResult = parseXsd(xsdText);

  if (!parseResult.ok || !parseResult.doc) {
    return makeResult({
      data: null,
      issues: parseResult.issues
    });
  }

  const modelResult = buildSchemaModel(parseResult.doc, {
    ...options,
    xsdText
  });

  const baseIssues = [
    ...(parseResult.issues || []),
    ...(modelResult.issues || [])
  ];

  if (!modelResult.schema) {
    return makeResult({
      data: null,
      issues: baseIssues
    });
  }

  const diagnostics = runSchemaDiagnostics(modelResult.schema, {
    ...options,
    includeWarnings: true,
    includeFeatureSummary: false,
    includeRoots: true
  });

  const data = extractTreeFromSchema(modelResult.schema, options, {
    resolveAttributeGroup: (name) => resolveAttributeGroup(modelResult.schema, name)
  });

  return makeResult({
    data,
    issues: [...baseIssues, ...(diagnostics.issues || [])]
  });
}