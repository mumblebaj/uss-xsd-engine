# Type derivation control

## Overview
This change adds support for schema-level derivation controls such as abstract elements, final type restrictions, and substitution-group-based element substitution during XML validation.

## Requirements
- REQ-1: Abstract elements and abstract complex types must be rejected when used as concrete instance content.
- REQ-2: Element declarations with a substitutionGroup must be accepted where the head element is expected.
- REQ-3: Final type restrictions must be enforced when a derived type would extend or restrict a final base type.

## Affected Modules
- src/model/schemaModel.js
- src/parser/buildSchemaModel.js
- src/resolver/schemaResolvers.js
- src/validation/structureValidator.js

## Test Plan
- [x] Abstract elements are rejected during runtime validation.
- [x] Substitution-group members validate where the head element is expected.
- [x] Final-type restrictions are surfaced as validation issues.
