const textEncoder = new TextEncoder();

function toTextChunk(chunk, decoder) {
  if (chunk == null) return "";
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) {
    return decoder.decode(chunk, { stream: true });
  }
  return String(chunk);
}

function byteLengthOfChunk(chunk) {
  if (chunk == null) return 0;
  if (typeof chunk === "string") {
    return textEncoder.encode(chunk).length;
  }
  if (chunk instanceof Uint8Array) {
    return chunk.byteLength;
  }
  return textEncoder.encode(String(chunk)).length;
}

function skipSpecialTag(buffer, startIndex) {
  if (buffer.startsWith("<!--", startIndex)) {
    const end = buffer.indexOf("-->", startIndex + 4);
    return end < 0 ? -1 : end + 3;
  }

  if (buffer.startsWith("<?", startIndex)) {
    const end = buffer.indexOf("?>", startIndex + 2);
    return end < 0 ? -1 : end + 2;
  }

  if (buffer.startsWith("<![CDATA[", startIndex)) {
    const end = buffer.indexOf("]]>", startIndex + 9);
    return end < 0 ? -1 : end + 3;
  }

  if (buffer.startsWith("<!DOCTYPE", startIndex)) {
    const end = buffer.indexOf(">", startIndex + 9);
    return end < 0 ? -1 : end + 1;
  }

  return null;
}

function findTagEnd(buffer, fromIndex) {
  let quote = null;
  for (let i = fromIndex; i < buffer.length; i += 1) {
    const ch = buffer[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

function parseStartTag(tagText) {
  const selfClosing = /\/>\s*$/.test(tagText);
  const inner = tagText
    .slice(1, selfClosing ? -2 : -1)
    .trim();

  if (!inner) {
    return { name: null, attributes: Object.create(null), selfClosing };
  }

  const firstWs = inner.search(/\s/);
  const name = (firstWs < 0 ? inner : inner.slice(0, firstWs)).trim();
  const attrText = firstWs < 0 ? "" : inner.slice(firstWs).trim();
  const attributes = Object.create(null);

  const attrRegex = /([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*')/g;
  let match = attrRegex.exec(attrText);
  while (match) {
    const attrName = match[1];
    const rawValue = match[2] || "";
    attributes[attrName] = rawValue.slice(1, -1);
    match = attrRegex.exec(attrText);
  }

  return { name, attributes, selfClosing };
}

export function createXmlStreamParser(handlers = {}, parserOptions = {}) {
  let buffer = "";
  let ended = false;
  let bufferOverflowed = false;
  const decoder = new TextDecoder();
  const maxBufferBytes =
    Number.isFinite(parserOptions?.maxBufferBytes) && parserOptions.maxBufferBytes > 0
      ? Number(parserOptions.maxBufferBytes)
      : Infinity;
  const progress = {
    bytes: 0,
    elements: 0,
  };

  function emitError(message) {
    handlers.onError?.({
      message,
      progress: { ...progress },
    });
  }

  function enforceBufferLimit() {
    if (bufferOverflowed || !Number.isFinite(maxBufferBytes)) return;

    const currentBytes = textEncoder.encode(buffer).length;
    if (currentBytes <= maxBufferBytes) return;

    bufferOverflowed = true;
    emitError(
      `Streaming parser buffer exceeded maxBufferBytes (${maxBufferBytes}).`,
    );
    buffer = "";
  }

  function parseBuffer() {
    while (buffer.length > 0) {
      const lt = buffer.indexOf("<");

      if (lt < 0) {
        if (ended) {
          const text = buffer;
          buffer = "";
          if (text) handlers.onText?.(text, { ...progress });
        }
        return;
      }

      if (lt > 0) {
        const text = buffer.slice(0, lt);
        buffer = buffer.slice(lt);
        if (text) handlers.onText?.(text, { ...progress });
        continue;
      }

      const specialEnd = skipSpecialTag(buffer, 0);
      if (specialEnd === -1) return;
      if (specialEnd != null) {
        if (buffer.startsWith("<![CDATA[", 0)) {
          const cdata = buffer.slice(9, specialEnd - 3);
          if (cdata) handlers.onText?.(cdata, { ...progress });
        }
        buffer = buffer.slice(specialEnd);
        continue;
      }

      if (buffer.startsWith("</", 0)) {
        const closeIdx = buffer.indexOf(">", 2);
        if (closeIdx < 0) return;

        const tagText = buffer.slice(0, closeIdx + 1);
        buffer = buffer.slice(closeIdx + 1);

        const name = tagText.slice(2, -1).trim();
        if (!name) {
          emitError("Encountered malformed closing tag.");
          continue;
        }

        handlers.onEndElement?.({ name }, { ...progress });
        continue;
      }

      const tagEnd = findTagEnd(buffer, 1);
      if (tagEnd < 0) return;

      const tagText = buffer.slice(0, tagEnd + 1);
      buffer = buffer.slice(tagEnd + 1);

      const parsed = parseStartTag(tagText);
      if (!parsed.name) {
        emitError("Encountered malformed start tag.");
        continue;
      }

      progress.elements += 1;
      handlers.onStartElement?.(
        {
          name: parsed.name,
          attributes: parsed.attributes,
          selfClosing: parsed.selfClosing,
        },
        { ...progress },
      );

      if (parsed.selfClosing) {
        handlers.onEndElement?.({ name: parsed.name }, { ...progress });
      }
    }
  }

  function write(chunk) {
    if (ended) {
      emitError("Cannot write after parser end.");
      return;
    }

    progress.bytes += byteLengthOfChunk(chunk);
    buffer += toTextChunk(chunk, decoder);
    parseBuffer();
    enforceBufferLimit();
    handlers.onProgress?.({ ...progress });
  }

  function end() {
    ended = true;
    buffer += decoder.decode();
    parseBuffer();
    enforceBufferLimit();
    if (buffer.trim()) {
      emitError("Unexpected trailing XML content.");
    }
    handlers.onEnd?.({ ...progress });
  }

  return {
    write,
    end,
    getProgress() {
      return { ...progress };
    },
    getCheckpoint() {
      return {
        buffer,
        ended,
        bufferOverflowed,
        maxBufferBytes,
        progress: { ...progress },
      };
    },
    restoreCheckpoint(checkpoint) {
      if (!checkpoint || typeof checkpoint !== "object") return;

      buffer = typeof checkpoint.buffer === "string" ? checkpoint.buffer : "";
      ended = Boolean(checkpoint.ended);
      bufferOverflowed = Boolean(checkpoint.bufferOverflowed);

      progress.bytes = Number(checkpoint.progress?.bytes) || 0;
      progress.elements = Number(checkpoint.progress?.elements) || 0;
    },
  };
}
