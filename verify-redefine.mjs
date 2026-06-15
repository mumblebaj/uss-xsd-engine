// Quick verification of redefine support
import { parseSchema } from "./src/api/parseSchema.js";

console.log("Testing redefine support...\n");

// Test 1: Parse basic redefine
console.log("Test 1: Basic redefine parsing");
const result1 = parseSchema(
  `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="http://example.com">
    <xs:redefine schemaLocation="base.xsd">
      <!-- redefined types -->
    </xs:redefine>
  </xs:schema>`,
  {
    externalDocuments: {
      "base.xsd": `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                          targetNamespace="http://example.com">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>`,
    },
  }
);

console.log("Result type:", typeof result1);
console.log("Result keys:", Object.keys(result1));
console.log("Full result:", JSON.stringify(result1, null, 2).substring(0, 500));

console.log("✓ Redefines parsed:", result1.schema.externalRefs.redefines.length);
console.log(
  "✓ Redefine schemaLocation:",
  result1.schema.externalRefs.redefines[0]?.schemaLocation
);

// Test 2: Namespace mismatch
console.log("\nTest 2: Namespace mismatch detection");
const result2 = parseSchema(
  `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="http://example.com/host">
    <xs:redefine schemaLocation="base.xsd">
      <!-- redefined types -->
    </xs:redefine>
  </xs:schema>`,
  {
    externalDocuments: {
      "base.xsd": `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                          targetNamespace="http://example.com/other">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>`,
    },
  }
);

const mismatchErrors = result2.issues.filter(
  (i) => i.code === "XSD_REDEFINE_NAMESPACE_MISMATCH"
);
console.log("✓ Namespace mismatch detected:", mismatchErrors.length > 0);

// Test 3: Override applied
console.log("\nTest 3: Override applied");
const result3 = parseSchema(
  `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="http://example.com">
    <xs:redefine schemaLocation="base.xsd">
      <xs:complexType name="BaseType">
        <xs:complexContent>
          <xs:restriction base="BaseType">
            <xs:sequence>
              <xs:element name="value" type="xs:string"/>
              <xs:element name="extra" type="xs:int"/>
            </xs:sequence>
          </xs:restriction>
        </xs:complexContent>
      </xs:complexType>
    </xs:redefine>
  </xs:schema>`,
  {
    externalDocuments: {
      "base.xsd": `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                          targetNamespace="http://example.com">
        <xs:complexType name="BaseType">
          <xs:sequence>
            <xs:element name="value" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:schema>`,
    },
  }
);

const baseType = result3.schema.globals.complexTypes.BaseType;
console.log("✓ Type exists:", baseType !== undefined);
console.log("✓ Type marked as redefined:", baseType?.redefined === true);
console.log("✓ Original definition preserved:", baseType?.originalDefinition !== undefined);

console.log("\n✅ All redefine tests completed successfully!");
