import { DOMParser } from "@xmldom/xmldom";

function ensureQuerySelector(doc) {
  if (!doc || typeof doc !== "object") return;
  if (typeof doc.querySelector === "function") return;

  Object.defineProperty(doc, "querySelector", {
    value(selector) {
      if (typeof selector !== "string" || !selector) return null;

      // Minimal support needed by tests/runtime code paths.
      if (selector === "parsererror") {
        const nodes = this.getElementsByTagName?.("parsererror") || [];
        return nodes[0] || null;
      }

      const nodes = this.getElementsByTagName?.(selector) || [];
      return nodes[0] || null;
    },
  });
}

export function normalizeChildrenTree(node) {
  if (!node || typeof node !== "object") return;

  if (!Object.prototype.hasOwnProperty.call(node, "children")) {
    try {
      Object.defineProperty(node, "children", {
        get() {
          return Array.from(this.childNodes || []).filter(
            (child) => child.nodeType === 1,
          );
        },
      });
    } catch {
      // Ignore non-extensible nodes in test environments.
    }
  }

  for (const child of Array.from(node.childNodes || [])) {
    normalizeChildrenTree(child);
  }
}

export function parseXsdDoc(xsdText) {
  const doc = new DOMParser().parseFromString(xsdText, "application/xml");
  ensureQuerySelector(doc);
  normalizeChildrenTree(doc.documentElement);
  return doc;
}

export function installDomParserPolyfill() {
  globalThis.DOMParser = class DOMParserWithChildren {
    parseFromString(text, mimeType) {
      const doc = new DOMParser().parseFromString(text, mimeType);
      ensureQuerySelector(doc);
      normalizeChildrenTree(doc.documentElement);
      return doc;
    }
  };
}
