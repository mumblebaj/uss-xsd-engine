import { ISSUE_CODES } from "../diagnostics/issueCodes.js";

export function validateNotationUsage(schema, value, notationDecl) {
  if (!notationDecl || !value) {
    return { ok: true, code: null, message: null };
  }

  const systemIdentifier = notationDecl.systemIdentifier || null;
  const publicIdentifier = notationDecl.publicIdentifier || null;

  if (systemIdentifier == null && publicIdentifier == null) {
    return { ok: true, code: null, message: null };
  }

  const text = String(value);
  const hasSystem = systemIdentifier != null && text.includes(systemIdentifier);
  const hasPublic = publicIdentifier != null && text.includes(publicIdentifier);

  if (!hasSystem && !hasPublic) {
    return {
      ok: false,
      code: ISSUE_CODES.XML_NOTATION_VIOLATION,
      message: `Value '${value}' does not satisfy notation '${notationDecl.name || notationDecl.qName || "notation"}'.`
    };
  }

  return { ok: true, code: null, message: null };
}
