import { parseXsd } from "../parser/parseXsd.js";
import { createEngineErrorResult } from "../utils/errors.js";

export function parseSchema(xsdText, options = {}) {
  try {
    if (typeof xsdText !== "string" || !xsdText.trim()) {
      return createEngineErrorResult(
        "parseSchema",
        "XSD input must be a non-empty string."
      );
    }

    const schemaModel = parseXsd(xsdText);

    return {
      ok: true,
      success: true,
      schemaModel,
      diagnostics: [],
      meta: {
        stage: "parseSchema"
      }
    };
  } catch (error) {
    return createEngineErrorResult("parseSchema", error.message, error);
  }
}