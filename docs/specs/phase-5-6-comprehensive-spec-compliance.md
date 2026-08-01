# Phase 5.6: Comprehensive Spec Compliance

## Overview
This phase hardens the engine around the remaining XSD compliance gaps in namespace handling, QName resolution, schema composition, substitution-group chains, and wildcard-based attribute handling.

## Requirements
- REQ-1: Substitution-group chains must allow a derived element to validate wherever an ancestor head element is expected.
- REQ-2: QName resolution must remain namespace-aware across prefixed, default-namespace, and imported-schema contexts.
- REQ-3: Schema composition paths involving include/import/redefine should continue to resolve declarations without leaking unrelated namespaces.
- REQ-4: Attribute wildcards should continue to accept matching attributes while preserving unexpected-attribute diagnostics for non-matching names.

## Affected Modules
- src/validation/structureValidator.js
- src/resolver/schemaResolvers.js
- src/parser/buildSchemaModel.js

## Test Plan
- [ ] Substitution-group chains validate through intermediate members
- [ ] Namespace-aware QName resolution works for imported schemas
- [ ] Attribute wildcard handling remains strict for unexpected names
