import { parseXsdDoc } from '../tests/helpers/domCompat.js';
import { buildSchemaModel } from '../src/parser/buildSchemaModel.js';

const xsd = `
  <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
    <xs:element name="root">
      <xs:complexType>
        <xs:choice>
          <xs:any namespace="##any" processContents="skip"/>
          <xs:element name="explicit" type="xs:string"/>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>
`;

const doc = parseXsdDoc(xsd);
const result = buildSchemaModel(doc, { xsdText: xsd });
const schema = result.schema;
const root = schema.globals.elements['::root'];
console.log(JSON.stringify(root.inlineType.content, null, 2));
