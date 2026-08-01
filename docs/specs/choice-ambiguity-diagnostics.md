# Choice ambiguity diagnostics

## Overview
This change ensures that ambiguous xs:choice branches emit a warning during XML validation when more than one branch could match the same child element.

## Requirements
- REQ-1: When a current XML child matches multiple choice branches, the validator must emit an XML_CONTENT_MODEL_AMBIGUOUS warning.
- REQ-2: The validator must still select a deterministic branch for continued validation.
- REQ-3: The warning must not be emitted for a single matching branch.

## Affected Modules
- src/validation/structureValidator.js
- src/validation/xmlDiagnostics.js

## Test Plan
- [x] Validate that ambiguous choice branches emit a warning.
- [x] Ensure the validator does not emit the legacy multiple-branch error code for the same case.
