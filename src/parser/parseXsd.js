import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";

export function parseXsd(xsdText) {
  const issues = [];

  if (typeof xsdText !== "string" || !xsdText.trim()) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XSD_PARSE_ERROR,
        severity: "error",
        message: "XSD input must be a non-empty string.",
        source: "xsd"
      })
    );

    return { ok: false, doc: null, issues };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xsdText, "application/xml");

    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      issues.push(
        createIssue({
          code: ISSUE_CODES.XSD_PARSE_ERROR,
          severity: "error",
          message: parserError.textContent?.trim() || "Failed to parse XSD.",
          source: "xsd"
        })
      );

      return { ok: false, doc: null, issues };
    }

    return { ok: true, doc, issues };
  }
  catch (error) {
    issues.push(
      createIssue({
        code: ISSUE_CODES.XSD_PARSE_ERROR,
        severity: "error",
        message: error instanceof Error ? error.message : "Failed to parse XSD.",
        source: "xsd"
      })
    );

    return { ok: false, doc: null, issues };
  }
}