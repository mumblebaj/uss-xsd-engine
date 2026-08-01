import { parseXmlWithDiagnostics } from '../src/validation/xmlDiagnostics.js';
import { DOMParser } from '@xmldom/xmldom';
const xmlText = '<root><explicit>value</explicit></root>';
const parsed = parseXmlWithDiagnostics(xmlText, 'xml', { DOMParser });
console.log('diagnostics', JSON.stringify(parsed.diagnostics));
console.log('root', parsed.document?.documentElement?.nodeName);
console.log('children', parsed.document?.documentElement?.children?.length);
const child = parsed.document?.documentElement?.children?.[0];
console.log(JSON.stringify({ nodeName: child?.nodeName, localName: child?.localName, namespaceURI: child?.namespaceURI }, null, 2));
