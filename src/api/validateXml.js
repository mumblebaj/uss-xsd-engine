import { parseXsd } from "../parser/parseXsd.js";
import { buildSchemaModel } from "../parser/buildSchemaModel.js";
import { runSchemaDiagnostics } from "../diagnostics/schemaDiagnostics.js";
import { makeResult } from "../utils/result.js";
import { validateXmlAgainstSchema } from "../validation/validateXmlAgainstSchema.js";
import { resolveAttributeGroup } from "../resolver/schemaResolvers.js";

export function validateXml({ xsdText, xmlText, options = {} } = {}) {
  const parseResult = parseXsd(xsdText);

  if (!parseResult.ok || !parseResult.doc) {
    return makeResult({
      data: { xmlValid: false },
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
      data: { xmlValid: false },
      issues: baseIssues
    });
  }

  const diagnostics = runSchemaDiagnostics(modelResult.schema, {
    ...options,
    includeWarnings: true,
    includeFeatureSummary: false,
    includeRoots: true
  });

  const validation = validateXmlAgainstSchema(modelResult.schema, xmlText, options, {
    resolveAttributeGroup: (name) => resolveAttributeGroup(modelResult.schema, name)
  });

  return makeResult({
    data: validation.data,
    issues: [...baseIssues, ...(diagnostics.issues || []), ...(validation.issues || [])]
  });
}