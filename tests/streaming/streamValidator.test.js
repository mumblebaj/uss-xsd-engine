import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { installDomParserPolyfill } from "../helpers/domCompat.js";
import { ISSUE_CODES } from "../../src/diagnostics/issueCodes.js";
import {
  createStreamValidator,
  createStreamingDiagnosticsExporter,
  validateXmlStream,
  validateXmlStreams,
} from "../../src/validation/streamingValidator.js";
import { createXmlStreamParser } from "../../src/validation/xmlStreamParser.js";

installDomParserPolyfill();

const SIMPLE_XSD = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="root">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="a" type="xs:string"/>
          <xs:element name="b" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

const OCCURS_XSD = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="root">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="a" type="xs:string" maxOccurs="2"/>
          <xs:element name="b" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

const FACET_XSD = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:simpleType name="CodeType">
      <xs:restriction base="xs:string">
        <xs:minLength value="3"/>
      </xs:restriction>
    </xs:simpleType>
    <xs:element name="root">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="code" type="CodeType"/>
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

const ATTRIBUTE_XSD = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="root">
      <xs:complexType>
        <xs:sequence>
          <xs:element name="item">
            <xs:complexType>
              <xs:attribute name="id" type="xs:int" use="required"/>
            </xs:complexType>
          </xs:element>
        </xs:sequence>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

test("createStreamValidator validates chunks and finalizes", () => {
  const validator = createStreamValidator({ xsdText: SIMPLE_XSD });

  const first = validator.validateChunk("<root><a></a>");
  assert.equal(first.issues.length, 0);

  const second = validator.validateChunk("<b></b></root>");
  assert.equal(second.issues.length, 0);

  const final = validator.finalize();
  assert.equal(final.issues.length, 0);
  assert.ok(final.progress.bytes > 0);
  assert.ok(final.progress.elements >= 3);
});

test("createStreamValidator reports missing required element", () => {
  const validator = createStreamValidator({ xsdText: SIMPLE_XSD });

  const first = validator.validateChunk("<root><a></a></root>");
  const final = validator.finalize();

  const codes = [...first.issues, ...final.issues].map((issue) => issue.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_MISSING_REQUIRED_ELEMENT));
});

test("validateXmlStream consumes async stream and emits incremental results", async () => {
  const xmlStream = Readable.from(["<root><x>1</x>", "<b>2</b></root>"]);

  const allIssues = [];
  for await (const result of validateXmlStream({
    xsdText: SIMPLE_XSD,
    xmlStream,
  })) {
    allIssues.push(...result.issues);
  }

  const codes = allIssues.map((issue) => issue.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_UNEXPECTED_ELEMENT));
});

test("createStreamValidator enforces xs:sequence order", () => {
  const validator = createStreamValidator({ xsdText: SIMPLE_XSD });

  const step = validator.validateChunk("<root><b></b><a></a></root>");
  const final = validator.finalize();

  const messages = [...step.issues, ...final.issues].map((issue) => issue.message);
  assert.ok(messages.some((message) => message.includes("Expected 'a'")));
});

test("createStreamValidator enforces maxOccurs inside sequence", () => {
  const validator = createStreamValidator({ xsdText: OCCURS_XSD });

  const step = validator.validateChunk("<root><a></a><a></a><a></a><b></b></root>");
  const final = validator.finalize();

  const codes = [...step.issues, ...final.issues].map((issue) => issue.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_UNEXPECTED_ELEMENT));
});

test("createStreamValidator handles heavily split XML tag boundaries", () => {
  const validator = createStreamValidator({ xsdText: SIMPLE_XSD });
  const chunks = [
    "<ro",
    "ot><",
    "a></",
    "a><b",
    "></b>",
    "</ro",
    "ot>",
  ];

  const issues = [];
  for (const chunk of chunks) {
    issues.push(...validator.validateChunk(chunk).issues);
  }
  issues.push(...validator.finalize().issues);

  const parseErrors = issues.filter((issue) => issue.code === ISSUE_CODES.XML_PARSE_ERROR);
  assert.equal(parseErrors.length, 0);
});

test("createXmlStreamParser handles split UTF-8 multibyte bytes across chunks", () => {
  const xml = "<root>caf\u00e9</root>";
  const bytes = Buffer.from(xml, "utf8");

  const firstLeadByteIndex = bytes.indexOf(0xc3);
  assert.ok(firstLeadByteIndex > 0);

  const first = bytes.slice(0, firstLeadByteIndex + 1);
  const second = bytes.slice(firstLeadByteIndex + 1);

  const texts = [];
  const errors = [];
  const parser = createXmlStreamParser({
    onText: (text) => texts.push(text),
    onError: (error) => errors.push(error),
  });

  parser.write(first);
  parser.write(second);
  parser.end();

  assert.equal(errors.length, 0);
  assert.equal(texts.join(""), "caf\u00e9");
});

test("createStreamValidator performs facet validation during streaming", () => {
  const validator = createStreamValidator({ xsdText: FACET_XSD });

  const step = validator.validateChunk("<root><code>ab</code></root>");
  const final = validator.finalize();

  const codes = [...step.issues, ...final.issues].map((issue) => issue.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_MIN_LENGTH_VIOLATION));
});

test("createStreamValidator performs attribute validation during streaming", () => {
  const validator = createStreamValidator({ xsdText: ATTRIBUTE_XSD });

  const step = validator.validateChunk("<root><item id=\"abc\"/></root>");
  const final = validator.finalize();

  const codes = [...step.issues, ...final.issues].map((issue) => issue.code);
  assert.ok(codes.includes(ISSUE_CODES.XML_VALUE_INVALID));
});

test("createStreamValidator resumes from checkpoint across instances", () => {
  const validator1 = createStreamValidator({ xsdText: SIMPLE_XSD });

  validator1.validateChunk("<root><a></a><");
  const checkpoint = validator1.checkpoint();

  const validator2 = createStreamValidator({
    xsdText: SIMPLE_XSD,
    checkpoint,
  });

  const step = validator2.validateChunk("b></b></root>");
  const final = validator2.finalize();
  const parseErrors = [...step.issues, ...final.issues].filter(
    (issue) => issue.code === ISSUE_CODES.XML_PARSE_ERROR,
  );

  assert.equal(parseErrors.length, 0);
});

test("validateXmlStream resumes from checkpoint", async () => {
  const validator = createStreamValidator({ xsdText: SIMPLE_XSD });
  validator.validateChunk("<root><a></a><");
  const checkpoint = validator.checkpoint();

  const xmlStream = Readable.from(["b></b></root>"]);
  const issues = [];

  for await (const result of validateXmlStream({
    xsdText: SIMPLE_XSD,
    xmlStream,
    checkpoint,
  })) {
    issues.push(...result.issues);
  }

  const parseErrors = issues.filter((issue) => issue.code === ISSUE_CODES.XML_PARSE_ERROR);
  assert.equal(parseErrors.length, 0);
});

test("validateXmlStream supports EventEmitter removeListener cleanup", async () => {
  const stream = new Readable({ read() {} });
  stream.off = undefined;

  const run = async () => {
    const out = [];
    for await (const result of validateXmlStream({
      xsdText: SIMPLE_XSD,
      xmlStream: stream,
    })) {
      out.push(...result.issues);
    }
    return out;
  };

  const pending = run();
  stream.push("<root><a></a><b></b></root>");
  stream.push(null);

  const issues = await pending;
  const parseErrors = issues.filter((issue) => issue.code === ISSUE_CODES.XML_PARSE_ERROR);
  assert.equal(parseErrors.length, 0);
});

test("createStreamValidator enforces maxBufferBytes limit", () => {
  const validator = createStreamValidator({
    xsdText: SIMPLE_XSD,
    options: {
      maxBufferBytes: 32,
    },
  });

  const step = validator.validateChunk("plain-text-without-any-tag-to-force-buffer-growth");
  const final = validator.finalize();
  const parseErrors = [...step.issues, ...final.issues].filter(
    (issue) => issue.code === ISSUE_CODES.XML_PARSE_ERROR,
  );

  assert.ok(parseErrors.some((issue) => issue.message.includes("maxBufferBytes")));
});

test("createStreamingDiagnosticsExporter exports ndjson diagnostics", () => {
  const exporter = createStreamingDiagnosticsExporter({ format: "ndjson" });

  exporter.write({
    issues: [{ code: ISSUE_CODES.XML_UNEXPECTED_ELEMENT, severity: "error" }],
    data: { elementPath: "/root", progress: { bytes: 10, elements: 1 } },
    summary: { errorCount: 1, warningCount: 0, infoCount: 0 },
  }, { streamIndex: 0 });

  const out = exporter.flush();
  assert.ok(out.includes("XML_UNEXPECTED_ELEMENT"));
  assert.ok(out.includes("\"streamIndex\":0"));
});

test("validateXmlStreams validates multiple streams in parallel", async () => {
  const streams = [
    Readable.from(["<root><a></a><b></b></root>"]),
    Readable.from(["<root><x></x><b></b></root>"]),
  ];

  const results = await validateXmlStreams({
    xsdText: SIMPLE_XSD,
    xmlStreams: streams,
    concurrency: 2,
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.ok(results[1].issues.some((issue) => issue.code === ISSUE_CODES.XML_UNEXPECTED_ELEMENT));
});
