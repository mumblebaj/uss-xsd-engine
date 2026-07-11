import { parseXsd } from "../parser/parseXsd.js";
import { buildSchemaModel } from "../parser/buildSchemaModel.js";
import { makeResult } from "../utils/result.js";
import { createIssue } from "../diagnostics/createIssue.js";
import { ISSUE_CODES } from "../diagnostics/issueCodes.js";
import { createXmlStreamParser } from "./xmlStreamParser.js";
import { createStreamingState } from "./streamingState.js";

function toSchemaResult({ xsdText, options }) {
  const parseResult = parseXsd(xsdText);

  if (!parseResult.ok || !parseResult.doc) {
    return {
      schema: null,
      issues: parseResult.issues || [],
    };
  }

  const modelResult = buildSchemaModel(parseResult.doc, {
    ...options,
    xsdText,
  });

  const baseIssues = [
    ...(parseResult.issues || []),
    ...(modelResult.issues || []),
  ];

  if (!modelResult.schema) {
    return {
      schema: null,
      issues: baseIssues,
    };
  }

  return {
    schema: modelResult.schema,
    issues: baseIssues,
  };
}

function isReadableStreamLike(value) {
  return !!value && typeof value.getReader === "function";
}

function isAsyncIterable(value) {
  return !!value && typeof value[Symbol.asyncIterator] === "function";
}

function isEventEmitterLike(value) {
  return (
    !!value &&
    typeof value.on === "function" &&
    (typeof value.off === "function" || typeof value.removeListener === "function")
  );
}

async function* eventEmitterToAsyncIterable(stream) {
  const queue = [];
  let ended = false;
  let pendingError = null;
  let wake = null;

  const onData = (chunk) => {
    queue.push(chunk);
    if (wake) {
      wake();
      wake = null;
    }
  };

  const onEnd = () => {
    ended = true;
    if (wake) {
      wake();
      wake = null;
    }
  };

  const onError = (error) => {
    pendingError = error instanceof Error ? error : new Error(String(error));
    ended = true;
    if (wake) {
      wake();
      wake = null;
    }
  };

  stream.on("data", onData);
  stream.on("end", onEnd);
  stream.on("error", onError);

  const detach = (eventName, handler) => {
    if (typeof stream.off === "function") {
      stream.off(eventName, handler);
      return;
    }

    if (typeof stream.removeListener === "function") {
      stream.removeListener(eventName, handler);
    }
  };

  try {
    while (!ended || queue.length > 0) {
      if (pendingError) throw pendingError;

      if (queue.length > 0) {
        yield queue.shift();
        continue;
      }

      await new Promise((resolve) => {
        wake = resolve;
      });
    }
  }
  finally {
    detach("data", onData);
    detach("end", onEnd);
    detach("error", onError);
  }
}

async function* webReadableToAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      yield value;
    }
  }
  finally {
    reader.releaseLock();
  }
}

function asAsyncIterable(xmlStream) {
  if (isAsyncIterable(xmlStream)) return xmlStream;
  if (isReadableStreamLike(xmlStream)) return webReadableToAsyncIterable(xmlStream);
  if (isEventEmitterLike(xmlStream)) return eventEmitterToAsyncIterable(xmlStream);
  return null;
}

function resolveMaxBufferBytes(options = {}) {
  const direct = options?.maxBufferBytes;
  if (Number.isFinite(direct) && direct > 0) return Number(direct);

  const nested = options?.streaming?.maxBufferBytes;
  if (Number.isFinite(nested) && nested > 0) return Number(nested);

  return Infinity;
}

function createStreamValidationEngine({ schema, options = {} }) {
  const state = createStreamingState({ schema, options });
  let currentProgress = { bytes: 0, elements: 0 };
  const parserErrorQueue = [];
  const maxBufferBytes = resolveMaxBufferBytes(options);

  const parser = createXmlStreamParser({
    onStartElement: (event) => {
      state.onStartElement(event);
    },
    onEndElement: (event) => {
      state.onEndElement(event);
    },
    onText: (text) => {
      state.onText(text);
    },
    onError: (errorEvent) => {
      const message = errorEvent?.message || "Failed to parse XML stream.";
      const issue = createIssue({
        code: ISSUE_CODES.XML_PARSE_ERROR,
        severity: "error",
        message,
        source: "xml",
      });
      currentProgress = errorEvent?.progress || currentProgress;
      parserErrorQueue.push(issue);
    },
    onProgress: (progress) => {
      currentProgress = progress;
    },
  }, {
    maxBufferBytes,
  });

  function consumeIncrementalIssues() {
    const fromState = state.consumeIssues();
    const issues = [...parserErrorQueue, ...fromState];
    parserErrorQueue.length = 0;
    return issues;
  }

  return {
    validateChunk(chunk) {
      parser.write(chunk);
      return {
        issues: consumeIncrementalIssues(),
        elementPath: state.getCurrentPath(),
        progress: { ...currentProgress },
      };
    },

    finalize() {
      parser.end();
      state.finalize();

      return {
        issues: consumeIncrementalIssues(),
        elementPath: state.getCurrentPath(),
        progress: parser.getProgress(),
      };
    },

    checkpoint() {
      return {
        parser: parser.getCheckpoint(),
        state: state.getCheckpoint(),
      };
    },

    resume(checkpoint) {
      if (!checkpoint || typeof checkpoint !== "object") return;
      if (checkpoint.state) {
        state.restoreCheckpoint(checkpoint.state);
      }
      if (checkpoint.parser) {
        parser.restoreCheckpoint(checkpoint.parser);
        currentProgress = parser.getProgress();
      }
      else if (checkpoint.parserProgress) {
        currentProgress = {
          bytes: Number(checkpoint.parserProgress.bytes) || 0,
          elements: Number(checkpoint.parserProgress.elements) || 0,
        };
      }
    },
  };
}

export function createStreamValidator({ xsdText, options = {}, checkpoint = null } = {}) {
  const schemaResult = toSchemaResult({ xsdText, options });

  if (!schemaResult.schema) {
    return {
      validateChunk() {
        return {
          issues: [...schemaResult.issues],
          elementPath: "/",
          progress: { bytes: 0, elements: 0 },
        };
      },
      finalize() {
        return {
          issues: [...schemaResult.issues],
          elementPath: "/",
          progress: { bytes: 0, elements: 0 },
        };
      },
      checkpoint() {
        return null;
      },
      resume() {},
    };
  }

  const engine = createStreamValidationEngine({
    schema: schemaResult.schema,
    options,
  });

  if (checkpoint) {
    engine.resume(checkpoint);
  }

  return {
    validateChunk(chunk) {
      const result = engine.validateChunk(chunk);
      return {
        ...result,
        issues: [...schemaResult.issues, ...result.issues],
      };
    },
    finalize() {
      const result = engine.finalize();
      return {
        ...result,
        issues: [...schemaResult.issues, ...result.issues],
      };
    },
    checkpoint: engine.checkpoint,
    resume: engine.resume,
  };
}

export async function* validateXmlStream({
  xsdText,
  xmlStream,
  options = {},
  checkpoint = null,
} = {}) {
  const validator = createStreamValidator({ xsdText, options, checkpoint });
  const iterable = asAsyncIterable(xmlStream);

  if (!iterable) {
    yield makeResult({
      data: {
        xmlValid: false,
        elementPath: "/",
        progress: { bytes: 0, elements: 0 },
      },
      issues: [
        createIssue({
          code: ISSUE_CODES.XML_PARSE_ERROR,
          severity: "error",
          message:
            "xmlStream must be an AsyncIterable, ReadableStream, or EventEmitter-like stream.",
          source: "xml",
        }),
      ],
    });
    return;
  }

  for await (const chunk of iterable) {
    const chunkResult = validator.validateChunk(chunk);
    yield makeResult({
      data: {
        xmlValid: !chunkResult.issues.some((issue) => issue.severity === "error"),
        elementPath: chunkResult.elementPath,
        progress: chunkResult.progress,
      },
      issues: chunkResult.issues,
    });
  }

  const final = validator.finalize();
  yield makeResult({
    data: {
      xmlValid: !final.issues.some((issue) => issue.severity === "error"),
      elementPath: final.elementPath,
      progress: final.progress,
    },
    issues: final.issues,
  });
}

export async function validateXmlStreams({
  xsdText,
  xmlStreams = [],
  options = {},
  checkpoints = [],
  concurrency = 4,
} = {}) {
  const streams = Array.isArray(xmlStreams) ? xmlStreams : [];
  const results = new Array(streams.length);

  if (streams.length === 0) return results;

  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, streams.length));

  async function runOne(index) {
    const checkpoint = Array.isArray(checkpoints) ? checkpoints[index] : null;
    let lastResult = null;
    const allIssues = [];

    for await (const result of validateXmlStream({
      xsdText,
      xmlStream: streams[index],
      options,
      checkpoint,
    })) {
      lastResult = result;
      allIssues.push(...(result?.issues || []));
    }

    if (!lastResult) {
      results[index] = makeResult({
        data: {
          xmlValid: true,
          elementPath: "/",
          progress: { bytes: 0, elements: 0 },
        },
        issues: [],
      });
      return;
    }

    results[index] = makeResult({
      data: {
        ...(lastResult.data || {}),
        xmlValid: !allIssues.some((issue) => issue.severity === "error"),
      },
      issues: allIssues,
    });
  }

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= streams.length) return;
      await runOne(index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function createStreamingDiagnosticsExporter({
  format = "ndjson",
  includeData = true,
  includeSummary = true,
} = {}) {
  const rows = [];

  function write(result, meta = {}) {
    const row = {
      timestamp: new Date().toISOString(),
      streamIndex: Number.isInteger(meta.streamIndex) ? meta.streamIndex : null,
      issues: result?.issues || [],
    };

    if (includeData) row.data = result?.data || null;
    if (includeSummary) row.summary = result?.summary || null;

    rows.push(row);
  }

  function flush() {
    if (format === "array") {
      return rows.slice();
    }

    if (format === "json") {
      return JSON.stringify(rows, null, 2);
    }

    return rows.map((row) => JSON.stringify(row)).join("\n");
  }

  return {
    write,
    flush,
    reset() {
      rows.length = 0;
    },
  };
}
