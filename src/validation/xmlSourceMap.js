function localNameFromTagName(tagName) {
  const value = String(tagName || "");
  return value.includes(":") ? value.split(":")[1] : value;
}

function getNodeLocalName(node) {
  return node?.localName || node?.nodeName || null;
}

function buildLineStarts(text) {
  const starts = [0];

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      starts.push(i + 1);
    }
  }

  return starts;
}

function offsetToLineColumn(offset, lineStarts) {
  if (!Number.isFinite(offset) || offset < 0) {
    return { line: 1, column: 1, offset: 0 };
  }

  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (lineStarts[mid] <= offset) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > offset) {
        return {
          line: mid + 1,
          column: offset - lineStarts[mid] + 1,
          offset
        };
      }

      low = mid + 1;
    }
    else {
      high = mid - 1;
    }
  }

  return { line: 1, column: 1, offset };
}

function nextStartTag(text, fromIndex) {
  const pattern = /<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(?=[\s/>])/g;
  pattern.lastIndex = Math.max(0, fromIndex || 0);

  while (true) {
    const match = pattern.exec(text);
    if (!match) {
      return null;
    }

    const start = match.index;
    const nextChar = text[start + 1];

    if (nextChar === "/" || nextChar === "!" || nextChar === "?") {
      continue;
    }

    return {
      offset: start,
      tagName: match[1],
      localName: localNameFromTagName(match[1])
    };
  }
}

function findTagEnd(text, startOffset) {
  let inQuote = null;

  for (let i = startOffset; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (ch === "\"" || ch === "'") {
      inQuote = ch;
      continue;
    }

    if (ch === ">") {
      return i;
    }
  }

  return -1;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAttributeNameOffset(tagText, attrName) {
  const safeName = escapeRegex(attrName);
  const pattern = new RegExp(`(^|\\s)(${safeName})(?=\\s*=)`);
  const match = pattern.exec(tagText);

  if (!match) {
    return -1;
  }

  return match.index + match[1].length;
}

function findAttributeValueOffset(tagText, attrName) {
  const safeName = escapeRegex(attrName);
  const pattern = new RegExp(`(^|\\s)${safeName}\\s*=\\s*(['"])`);
  const match = pattern.exec(tagText);

  if (!match) {
    return -1;
  }

  const quoteChar = match[2];
  const start = match.index + match[0].length;
  const end = tagText.indexOf(quoteChar, start);

  return end >= start ? start : -1;
}

function findTextContentOffset(text, tagEndOffset, localName) {
  let i = tagEndOffset + 1;

  while (i < text.length && /\s/.test(text[i])) {
    i += 1;
  }

  if (text.startsWith(`</${localName}`, i) || text[i] === "<") {
    return -1;
  }

  return i < text.length ? i : -1;
}

export function createXmlSourceLocator(xmlText, xmlDocument) {
  const text = typeof xmlText === "string" ? xmlText : "";
  const documentElement = xmlDocument?.documentElement || null;
  const lineStarts = buildLineStarts(text);

  const elementLocationMap = new WeakMap();
  const elementMetaMap = new WeakMap();

  if (!documentElement || !text) {
    return {
      getNodeLocation() {
        return null;
      },
      getAttributeLocation() {
        return null;
      },
      getAttributeValueLocation() {
        return null;
      },
      getTextValueLocation() {
        return null;
      }
    };
  }

  const orderedNodes = [
    documentElement,
    ...Array.from(documentElement.querySelectorAll("*"))
  ];

  let searchFrom = 0;

  for (const node of orderedNodes) {
    const expectedLocalName = getNodeLocalName(node);
    if (!expectedLocalName) {
      continue;
    }

    let match = nextStartTag(text, searchFrom);

    while (match) {
      if (match.localName === expectedLocalName) {
        const tagEndOffset = findTagEnd(text, match.offset);
        const startLocation = offsetToLineColumn(match.offset, lineStarts);

        elementLocationMap.set(node, startLocation);
        elementMetaMap.set(node, {
          startOffset: match.offset,
          tagEndOffset,
          localName: expectedLocalName
        });

        searchFrom = match.offset + 1;
        break;
      }

      searchFrom = match.offset + 1;
      match = nextStartTag(text, searchFrom);
    }
  }

  function getNodeLocation(node) {
    return node ? elementLocationMap.get(node) || null : null;
  }

  function getAttributeLocation(node, attrName) {
    const meta = node ? elementMetaMap.get(node) : null;
    if (!meta || !attrName || meta.tagEndOffset < 0) {
      return null;
    }

    const tagText = text.slice(meta.startOffset, meta.tagEndOffset + 1);
    const relativeOffset = findAttributeNameOffset(tagText, attrName);

    if (relativeOffset < 0) {
      return null;
    }

    return offsetToLineColumn(meta.startOffset + relativeOffset, lineStarts);
  }

  function getAttributeValueLocation(node, attrName) {
    const meta = node ? elementMetaMap.get(node) : null;
    if (!meta || !attrName || meta.tagEndOffset < 0) {
      return null;
    }

    const tagText = text.slice(meta.startOffset, meta.tagEndOffset + 1);
    const relativeOffset = findAttributeValueOffset(tagText, attrName);

    if (relativeOffset < 0) {
      return null;
    }

    return offsetToLineColumn(meta.startOffset + relativeOffset, lineStarts);
  }

  function getTextValueLocation(node) {
    const meta = node ? elementMetaMap.get(node) : null;
    if (!meta || meta.tagEndOffset < 0) {
      return null;
    }

    const textOffset = findTextContentOffset(text, meta.tagEndOffset, meta.localName);
    if (textOffset < 0) {
      return null;
    }

    return offsetToLineColumn(textOffset, lineStarts);
  }

  return {
    getNodeLocation,
    getAttributeLocation,
    getAttributeValueLocation,
    getTextValueLocation
  };
}