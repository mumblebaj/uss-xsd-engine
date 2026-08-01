import { parseXsdDoc } from '../tests/helpers/domCompat.js';
import { buildSchemaModel } from '../src/parser/buildSchemaModel.js';
import { validateContentModel } from '../src/validation/structureValidator.js';
import { DOMParser } from '@xmldom/xmldom';

const xsd = `
  <xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'>
    <xs:element name='root'>
      <xs:complexType>
        <xs:choice>
          <xs:any namespace='##any' processContents='skip'/>
          <xs:element name='explicit' type='xs:string'/>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>`;

const doc = parseXsdDoc(xsd);
const result = buildSchemaModel(doc, { xsdText: xsd });
const schema = result.schema;
const root = schema.globals.elements['::root'];
const choice = root.inlineType.content;
const xmlRoot = new DOMParser().parseFromString('<root><explicit>value</explicit></root>', 'application/xml').documentElement;
const children = Array.from(xmlRoot.children || []);
const context = {
  schema,
  issues: [],
  createIssue: (payload) => payload,
  ISSUE_CODES: {
    XML_CONTENT_MODEL_AMBIGUOUS: 'XML_CONTENT_MODEL_AMBIGUOUS',
    XML_CHOICE_NOT_SATISFIED: 'XML_CHOICE_NOT_SATISFIED',
    XML_MISSING_REQUIRED_ELEMENT: 'XML_MISSING_REQUIRED_ELEMENT',
  },
  currentXmlNode: xmlRoot,
  pathParts: ['root'],
  getNodeLocation: () => ({ line: 1, column: 1 }),
  validateElementValue: () => ({ ok: true }),
  validateAttributeValue: () => ({ ok: true }),
};

function matchesElementDecl(xmlNode, elementDecl) {
  const xmlName = xmlNode?.localName || xmlNode?.nodeName || null;
  const xmlNs = xmlNode?.namespaceURI || null;

  const declName = elementDecl.refName || elementDecl.name;
  const declLocal = declName?.includes(':') ? declName.split(':')[1] : declName;
  const declNs = elementDecl.namespaceUri || null;

  if (xmlName !== declLocal) return false;
  if (declNs == null) return true;

  return xmlNs === declNs;
}

for (const childDecl of choice.children) {
  const childNode = children[0];
  console.log('decl', childDecl.kind, childDecl.name, childDecl.refName, childNode?.nodeName, childNode?.localName, childNode?.namespaceURI, matchesElementDecl(childNode, childDecl));
  const result = validateContentModel(children, childDecl, context, ['root'], 0, true);
  console.log('result', JSON.stringify(result));
}
