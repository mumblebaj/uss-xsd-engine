import { parseXsd } from "../parser/parseXsd.js";
import { buildSchemaModel } from "../parser/buildSchemaModel.js";
import { runSchemaDiagnostics } from "../diagnostics/schemaDiagnostics.js";
import { makeResult } from "../utils/result.js";
import { generateXmlFromSchema } from "../generator/generateXml.js";
import { writeXmlDocument } from "../generator/xmlWriter.js";
import { resolveAttributeGroup } from "../resolver/schemaResolvers.js";

export function generateSampleXml({ xsdText, options = {} } = {}) {
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

  const generated = generateXmlFromSchema(modelResult.schema, options, {
    resolveAttributeGroup: (name) => resolveAttributeGroup(modelResult.schema, name)
  });

  if (!generated.rootNode) {
    return makeResult({
      data: {
        rootElementName: null,
        xmlText: ""
      },
      issues: [...baseIssues, ...(diagnostics.issues || [])]
    });
  }

  return makeResult({
    data: {
      rootElementName: generated.rootElementName,
      xmlText: writeXmlDocument(generated.rootNode)
    },
    issues: [...baseIssues, ...(diagnostics.issues || [])]
  });
}