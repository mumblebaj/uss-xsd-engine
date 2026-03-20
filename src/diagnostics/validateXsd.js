import { parseXmlWithDiagnostics, makeDiagnostic } from "../validation/xmlDiagnostics.js";

const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

export function validateXsd(text) {
  const { diagnostics, document } = parseXmlWithDiagnostics(text, "xsd");

  if (!document) {
    return diagnostics;
  }

  const root = document.documentElement;

  if (!root) {
    diagnostics.push(makeDiagnostic("xsd", "error", "XSD document has no root element.", 1, 1));
    return diagnostics;
  }

  if (root.localName !== "schema") {
    diagnostics.push(
      makeDiagnostic("xsd", "warning", "Root element is not xs:schema.", 1, 1)
    );
  }

  const namespaceUri = root.namespaceURI;
  if (namespaceUri !== XSD_NAMESPACE) {
    diagnostics.push(
      makeDiagnostic(
        "xsd",
        "warning",
        `Root schema namespace is "${namespaceUri || "(none)"}", expected "${XSD_NAMESPACE}".`,
        1,
        1
      )
    );
  }

  const hasElementDecl = document.getElementsByTagNameNS(XSD_NAMESPACE, "element").length > 0;
  if (!hasElementDecl) {
    diagnostics.push(
      makeDiagnostic("xsd", "warning", "No xs:element declarations were found in this schema.", 1, 1)
    );
  }

  return diagnostics;
}