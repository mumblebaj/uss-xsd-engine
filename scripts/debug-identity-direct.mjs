import { createEmptySchemaModel, createElementDecl, createIdentityConstraint } from '../src/model/schemaModel.js';
import { validateIdentityConstraints } from '../src/validation/identityConstraintValidator.js';
import { DOMParser } from '@xmldom/xmldom';

const schema = createEmptySchemaModel();
schema.globals.elements['::books'] = createElementDecl({ name: 'books', namespaceUri: null, identityConstraints: [], path: '/schema/element' });
const key = createIdentityConstraint({ kind: 'key', name: 'bookKey', selector: { xpath: 'book', path: '/schema/element/key/selector' }, fields: [{ xpath: '@id', line: 1, column: 1, path: '/schema/element/key/field' }], ownerName: 'books', ownerNamespaceUri: null, ownerPath: '/schema/element', line: 1, column: 1, path: '/schema/element/key' });
const keyref = createIdentityConstraint({ kind: 'keyref', name: 'bookRef', selector: { xpath: 'ref', path: '/schema/element/keyref/selector' }, fields: [{ xpath: '@ref', line: 1, column: 1, path: '/schema/element/keyref/field' }], refer: 'bookKey', ownerName: 'books', ownerNamespaceUri: null, ownerPath: '/schema/element', line: 1, column: 1, path: '/schema/element/keyref' });
schema.identityConstraints.push(key, keyref);

const xmlText = `<?xml version="1.0"?>\n<books>\n  <book id="1"/>\n  <ref ref="2"/>\n</books>`;
const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

const issues = validateIdentityConstraints(schema, doc.documentElement, () => ({ line: 1, column: 1 }));
console.log('DIRECT ISSUES:', JSON.stringify(issues, null, 2));
process.exit(0);
