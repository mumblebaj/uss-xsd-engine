function getDomParser(parserOverride = null) {
  if (parserOverride) {
    return parserOverride;
  }

  if (typeof globalThis !== "undefined" && typeof globalThis.DOMParser !== "undefined") {
    return globalThis.DOMParser;
  }

  throw new Error(
    "DOMParser is not available in this runtime. In Node.js tests, provide a DOMParser implementation."
  );
}

export function makeDiagnostic(source, severity, message, line = 1, column = 1) {
  return {
    source,
    severity,
    message,
    line,
    column
  };
}

export function parseXmlWithDiagnostics(text, source = "xml", options = {}) {
  const diagnostics = [];

  if (typeof text !== "string" || !text.trim()) {
    diagnostics.push(
      makeDiagnostic(source, "error", "Input must be a non-empty XML string.", 1, 1)
    );

    return {
      document: null,
      diagnostics
    };
  }

  let document = null;

  try {
    const DOMParserImpl = getDomParser(options.DOMParser);
    const parser = new DOMParserImpl();
    document = parser.parseFromString(text, "application/xml");
  } catch (error) {
    diagnostics.push(
      makeDiagnostic(
        source,
        "error",
        error?.message || "Failed to parse XML.",
        1,
        1
      )
    );

    return {
      document: null,
      diagnostics
    };
  }

  const parserError = document.querySelector?.("parsererror");
  if (parserError) {
    diagnostics.push(
      makeDiagnostic(
        source,
        "error",
        normalizeParserErrorMessage(parserError.textContent),
        1,
        1
      )
    );

    return {
      document: null,
      diagnostics
    };
  }

  return {
    document,
    diagnostics
  };
}

function normalizeParserErrorMessage(message) {
  const text = String(message || "").trim();
  return text || "XML parsing failed.";
}