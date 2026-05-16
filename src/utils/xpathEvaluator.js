// Minimal XPath evaluator for selectors and fields used by identity constraints
// Supports simple relative paths, element steps, attribute steps, wildcard '*',
// numeric index predicate [n], simple attribute equality predicate [@attr='value'],
// and descendant-or-self operator (//).

import { parseQName, resolveNamespaceUri } from "../resolver/schemaResolvers.js";

function nodeMatchesQName(schema, node, qName) {
  if (!node || !qName) return false;
  const parsed = parseQName(qName);
  const expectedNs = resolveNamespaceUri(schema, parsed.prefix);
  const nodeLocal = node.localName || node.nodeName || null;
  const nodeNs = node.namespaceURI || null;
  if (parsed.prefix) {
    // If schema doesn't supply a mapping for the prefix, try resolving from the node itself.
    let nsToCompare = expectedNs || null;
    if (!nsToCompare) {
      if (typeof node.lookupNamespaceURI === "function") {
        try {
          nsToCompare = node.lookupNamespaceURI(parsed.prefix) || null;
        } catch (e) {
          nsToCompare = null;
        }
      }
      if (!nsToCompare && node.prefix) {
        // fallback: compare prefix directly (best-effort for xmldom)
        return nodeLocal === parsed.localName && node.prefix === parsed.prefix;
      }
    }
    return nodeLocal === parsed.localName && (nodeNs || null) === (nsToCompare || null);
  }
  // unprefixed: match localName; accept any namespace (schema scoping handled elsewhere)
  return nodeLocal === parsed.localName;
}

function collectDescendants(node, predicate) {
  const matches = [];
  function traverse(n) {
    if (!n || n.nodeType !== 1) return;
    if (predicate(n)) matches.push(n);
    for (const child of Array.from(n.childNodes || [])) {
      traverse(child);
    }
  }
  traverse(node);
  return matches;
}

export function evaluateSelector(schema, startNodes, selectorXPath) {
  if (!selectorXPath || !Array.isArray(startNodes) || startNodes.length === 0) return [];
  let xpath = selectorXPath.trim();
  if (xpath.startsWith('./')) xpath = xpath.slice(2);
  if (xpath === '.' || xpath === '') return startNodes;

  // Handle // (descendant-or-self)
  if (xpath.includes('//')) {
    return evaluateSelectorWithDescendant(schema, startNodes, xpath);
  }

  const segments = xpath.split('/');
  let nodes = startNodes;

  for (const raw of segments) {
    if (!raw || raw === '.') continue;
    const m = raw.match(/^([^\[]+)(?:\[(.+)\])?$/);
    if (!m) return [];
    const step = m[1];
    const predicate = m[2] || null;

    if (step === '*') {
      nodes = nodes.flatMap((n) => Array.from(n.childNodes || []).filter((c) => c.nodeType === 1));
    } else if (step.startsWith('@')) {
      // selector that directly selects attributes is not supported for owner selection
      return [];
    } else {
      nodes = nodes.flatMap((n) =>
        Array.from(n.childNodes || [])
          .filter((c) => c.nodeType === 1)
          .filter((c) => {
            // support QName matching with namespace awareness
            return nodeMatchesQName(schema, c, step);
          }),
      );

      if (predicate && nodes.length) {
        // numeric index predicate [n]
        const num = Number(predicate);
        if (Number.isInteger(num) && num > 0) {
          const idx = num - 1;
          nodes = nodes.length > idx ? [nodes[idx]] : [];
        } else {
          // attribute equality predicate [@attr='value']
          const attrMatch = predicate.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
          if (attrMatch) {
            const attrName = attrMatch[1];
            const attrValue = attrMatch[2];
            nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
          } else {
            // unsupported predicate
            nodes = [];
          }
        }
      }
    }
  }

  return nodes;
}

function evaluateSelectorWithDescendant(schema, startNodes, xpath) {
  // Split by // but keep track of which parts use descendant axis
  const fullParts = xpath.split(/\/\//);
  let nodes = startNodes;

  for (let partIdx = 0; partIdx < fullParts.length; partIdx++) {
    const part = fullParts[partIdx].trim();
    if (!part) continue;

    if (partIdx === 0) {
      // First part: use regular selector evaluation (no //)
      if (part !== '.') {
        // Process non-descendant segments (regular child path)
        const segments = part.split('/');
        for (const seg of segments) {
          if (!seg || seg === '.') continue;
          const m = seg.match(/^([^\[]+)(?:\[(.+)\])?$/);
          if (!m) return [];
          const step = m[1];
          const predicate = m[2] || null;

          if (step === '*') {
            nodes = nodes.flatMap((n) => Array.from(n.childNodes || []).filter((c) => c.nodeType === 1));
          } else if (step.startsWith('@')) {
            return [];
          } else {
            nodes = nodes.flatMap((n) =>
              Array.from(n.childNodes || [])
                .filter((c) => c.nodeType === 1)
                .filter((c) => nodeMatchesQName(schema, c, step)),
            );

            if (predicate && nodes.length) {
              const num = Number(predicate);
              if (Number.isInteger(num) && num > 0) {
                const idx = num - 1;
                nodes = nodes.length > idx ? [nodes[idx]] : [];
              } else {
                const attrMatch = predicate.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
                if (attrMatch) {
                  const attrName = attrMatch[1];
                  const attrValue = attrMatch[2];
                  nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
                } else {
                  nodes = [];
                }
              }
            }
          }
        }
      }
    } else {
      // Descendant part (following //)
      const segments = part.split('/');
      
      for (let segIdx = 0; segIdx < segments.length; segIdx++) {
        const segment = segments[segIdx];
        if (!segment || segment === '.') continue;
        
        const m = segment.match(/^([^\[]+)(?:\[(.+)\])?$/);
        if (!m) return [];
        const step = m[1];
        const predicate = m[2] || null;

        if (segIdx === 0) {
          // First segment after // uses descendant axis
          const descendants = [];
          for (const node of nodes) {
            const matches = collectDescendants(node, (n) => {
              if (step === '*') return true;
              if (step.startsWith('@')) return false;
              return nodeMatchesQName(schema, n, step);
            });
            descendants.push(...matches);
          }
          nodes = descendants;

          if (predicate && nodes.length) {
            const predicateMatch = predicate.match(/^\[(.+)\]$/);
            if (predicateMatch) {
              const pred = predicateMatch[1];
              const num = Number(pred);
              if (Number.isInteger(num) && num > 0) {
                const idx = num - 1;
                nodes = nodes.length > idx ? [nodes[idx]] : [];
              } else {
                const attrMatch = pred.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
                if (attrMatch) {
                  const attrName = attrMatch[1];
                  const attrValue = attrMatch[2];
                  nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
                } else {
                  nodes = [];
                }
              }
            }
          }
        } else {
          // Remaining segments are regular child steps
          nodes = nodes.flatMap((n) =>
            Array.from(n.childNodes || [])
              .filter((c) => c.nodeType === 1)
              .filter((c) => {
                if (step === '*') return true;
                if (step.startsWith('@')) return false;
                return nodeMatchesQName(schema, c, step);
              }),
          );

          if (predicate && nodes.length) {
            const predicateMatch = predicate.match(/^\[(.+)\]$/);
            if (predicateMatch) {
              const pred = predicateMatch[1];
              const num = Number(pred);
              if (Number.isInteger(num) && num > 0) {
                const idx = num - 1;
                nodes = nodes.length > idx ? [nodes[idx]] : [];
              } else {
                const attrMatch = pred.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
                if (attrMatch) {
                  const attrName = attrMatch[1];
                  const attrValue = attrMatch[2];
                  nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
                } else {
                  nodes = [];
                }
              }
            }
          }
        }
      }
    }

    if (!nodes.length && partIdx < fullParts.length - 1) {
      // Early exit if no matches and more parts to process
      return [];
    }
  }

  return nodes;
}

export function evaluateField(schema, contextNode, fieldXPath) {
  if (!fieldXPath || !contextNode) return null;
  let xpath = fieldXPath.trim();
  if (xpath.startsWith('./')) xpath = xpath.slice(2);
  if (xpath === '.' ) return (contextNode.textContent || '').trim() || null;

  // attribute selection
  if (xpath.startsWith('@')) {
    const attr = xpath.slice(1);
    return contextNode.getAttribute(attr) ?? null;
  }

  // Handle // (descendant-or-self)
  if (xpath.includes('//')) {
    return evaluateFieldWithDescendant(schema, contextNode, xpath);
  }

  const segments = xpath.split('/');
  let nodes = [contextNode];

  for (let i = 0; i < segments.length; i += 1) {
    const raw = segments[i];
    if (!raw || raw === '.') continue;
    const m = raw.match(/^([^\[]+)(?:\[(.+)\])?$/);
    if (!m) return null;
    const step = m[1];
    const predicate = m[2] || null;

    if (step.startsWith('@')) {
      // attribute must be last
      if (i !== segments.length - 1) return null;
      return nodes[0]?.getAttribute(step.slice(1)) ?? null;
    }

    nodes = nodes.flatMap((n) =>
      Array.from(n.childNodes || []).filter((c) => c.nodeType === 1 && nodeMatchesQName(schema, c, step)),
    );

    if (!nodes.length) return null;

    if (predicate) {
      const num = Number(predicate);
      if (Number.isInteger(num) && num > 0) {
        const idx = num - 1;
        nodes = nodes.length > idx ? [nodes[idx]] : [];
      } else {
        const attrMatch = predicate.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
        if (attrMatch) {
          const attrName = attrMatch[1];
          const attrValue = attrMatch[2];
          nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
        } else {
          return null;
        }
      }
    }
  }

  const v = nodes[0];
  if (!v) return null;
  return (v.textContent || '').trim() || null;
}

function evaluateFieldWithDescendant(schema, contextNode, xpath) {
  const parts = xpath.split(/\/\//);
  let nodes = [contextNode];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (i === 0) {
      // First part: regular evaluation
      if (part !== '.' && part !== '') {
        const val = evaluateField(schema, nodes[0], part);
        if (val !== null) return val;
        nodes = [];
      }
    } else {
      // Descendant part
      const m = part.match(/^([^\[]+)(?:\[(.+)\])?/);
      if (!m) return null;
      const step = m[1];
      const predicate = part.slice(m[0].length);

      if (step.startsWith('@')) {
        // Descendant attribute
        const attrName = step.slice(1);
        for (const node of nodes) {
          const descendants = collectDescendants(node, () => true);
          if (descendants.length) {
            return descendants[0]?.getAttribute(attrName) ?? null;
          }
        }
        return null;
      }

      const descendants = [];
      for (const node of nodes) {
        descendants.push(
          ...collectDescendants(node, (n) => {
            if (step === '*') return true;
            return nodeMatchesQName(schema, n, step);
          }),
        );
      }
      nodes = descendants;

      if (!nodes.length) return null;

      if (predicate) {
        const predicateMatch = predicate.match(/^\[(.+)\]$/);
        if (predicateMatch) {
          const pred = predicateMatch[1];
          const num = Number(pred);
          if (Number.isInteger(num) && num > 0) {
            const idx = num - 1;
            nodes = nodes.length > idx ? [nodes[idx]] : [];
          } else {
            const attrMatch = pred.match(/^@([A-Za-z_][\w.-]*)=['"](.*)['"]$/);
            if (attrMatch) {
              const attrName = attrMatch[1];
              const attrValue = attrMatch[2];
              nodes = nodes.filter((n) => (n.getAttribute(attrName) || '') === attrValue);
            }
          }
        }
      }

      if (nodes.length) {
        const v = nodes[0];
        return (v.textContent || '').trim() || null;
      }
    }
  }

  return null;
}
