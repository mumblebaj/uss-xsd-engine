function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function writeAttributes(attributes = {}) {
  const entries = Object.entries(attributes).filter(([, value]) => value != null);
  if (!entries.length) return "";

  return entries
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");
}

function indent(level) {
  return "  ".repeat(level);
}

function writeNode(node, level = 0) {
  const attrs = writeAttributes(node.attributes);

  if (!node.children?.length && (node.text == null || node.text === "")) {
    return `${indent(level)}<${node.name}${attrs}/>`;
  }

  if (!node.children?.length) {
    return `${indent(level)}<${node.name}${attrs}>${escapeXml(node.text)}</${node.name}>`;
  }

  const childXml = node.children.map((child) => writeNode(child, level + 1)).join("\n");
  return `${indent(level)}<${node.name}${attrs}>\n${childXml}\n${indent(level)}</${node.name}>`;
}

export function writeXmlDocument(rootNode) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${writeNode(rootNode, 0)}`;
}