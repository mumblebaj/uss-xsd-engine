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
    line: Number.isFinite(line) && line > 0 ? line : 1,
    column: Number.isFinite(column) && column > 0 ? column : 1
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
    const rawMessage = parserError.textContent || parserError.innerText || "";
    const normalizedMessage = normalizeParserErrorMessage(rawMessage);
    const { line, column } = extractLineColumn(rawMessage) || extractLineColumn(normalizedMessage);

    diagnostics.push(
      makeDiagnostic(
        source,
        "error",
        normalizedMessage || "XML parsing failed.",
        line,
        column
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
  return String(message || "")
    .replace(/\r?\n/g, " ")
    .replace(/^This page contains the following errors:\s*/i, "")
    .replace(/Below is a rendering of the page up to the first error\.\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLineColumn(message) {
  const text = String(message || "");

  const patterns = [
    /line\s+(\d+)\s+at\s+column\s+(\d+)/i,
    /at\s+line\s+(\d+)\s+column\s+(\d+)/i,
    /Line Number\s+(\d+),\s*Column\s+(\d+)/i,
    /line\s+(\d+),\s*column\s+(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        line: parseInt(match[1], 10) || 1,
        column: parseInt(match[2], 10) || 1
      };
    }
  }

  return { line: 1, column: 1 };
}