import { validateXmlAgainstSchema } from '../src/validation/validateXmlAgainstSchema.js';
import { buildSchemaModel } from '../src/parser/buildSchemaModel.js';
import { parseXsdDoc } from '../tests/helpers/domCompat.js';
import { DOMParser } from '@xmldom/xmldom';

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
const schemaResult = buildSchemaModel(doc, { xsdText: xsd });
const result = validateXmlAgainstSchema(schemaResult.schema, '<root><explicit>value</explicit></root>', { rootElementName: 'root' }, { DOMParser });
console.log(JSON.stringify(result.issues, null, 2));
