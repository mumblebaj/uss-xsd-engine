import { DOMParser } from '@xmldom/xmldom';
import { evaluateSelector, evaluateField } from '../src/utils/xpathEvaluator.js';

const xml = `<?xml version="1.0"?>\n<books>\n  <book id="1"/>\n  <ref ref="2"/>\n</books>`;
const doc = new DOMParser().parseFromString(xml, 'application/xml');

const owner = doc.documentElement; // books
const booksChildren = Array.from(owner.children || []).map(c => c.nodeName + JSON.stringify(c.attributes ? Array.from(c.attributes).map(a=>[a.name,a.value]) : []));
console.log('children:', booksChildren);

const selBooks = evaluateSelector(null, [owner], 'book');
console.log('selector book count:', selBooks.length, selBooks.map(n=>n.nodeName));
const fieldVal = evaluateField(null, selBooks[0], '@id');
console.log('field value for first book @id:', fieldVal);

const selRef = evaluateSelector(null, [owner], 'ref');
console.log('selector ref count:', selRef.length, selRef.map(n=>n.nodeName));
const refVal = evaluateField(null, selRef[0], '@ref');
console.log('field value for first ref @ref:', refVal);
