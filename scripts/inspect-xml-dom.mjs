import { DOMParser } from '@xmldom/xmldom';
const doc = new DOMParser().parseFromString('<root><explicit>value</explicit></root>', 'application/xml');
const root = doc.documentElement;
const child = root.children[0];
console.log(JSON.stringify({
  nodeName: child?.nodeName,
  localName: child?.localName,
  namespaceURI: child?.namespaceURI,
  childNodesType: Array.from(child?.childNodes || []).map((n) => n.nodeType),
  textContent: child?.textContent,
}, null, 2));
