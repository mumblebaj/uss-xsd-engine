# Compound simple type support

## Overview
Add support for XSD simple-type constructors that are still missing from the engine: `xs:list` and `xs:union`.

## Requirements
- REQ-1: The parser must build a simple-type model for `xs:list` with an `itemType` reference.
- REQ-2: The parser must build a simple-type model for `xs:union` with `memberTypes` references.
- REQ-3: Runtime value validation must accept values that satisfy list and union simple types.
- REQ-4: Runtime value validation must reject values that violate list and union simple types.

## API Changes
No public API changes are required for this phase.

## Affected Modules
- src/parser/buildSchemaModel.js
- src/model/schemaModel.js
- src/resolver/schemaResolvers.js
- src/validation/valueValidator.js

## Test Plan
- [x] Schema parsing for list and union simple types
- [x] Runtime validation for valid and invalid values
- [x] Streaming validation impact
