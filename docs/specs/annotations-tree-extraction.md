# Annotations in Schema Tree Extraction

## Overview
This feature ensures that schema annotations captured during XSD parsing are surfaced through the schema-tree extraction API so downstream tooling can inspect documentation, appinfo, and processing-instruction metadata.

## Requirements
- REQ-1: Annotation metadata already stored on schema declarations must be preserved in the extracted schema tree.
- REQ-2: The extracted tree should expose documentation, appinfo, and processing-instruction content in a structured form.
- REQ-3: Annotation data should be available for elements, complex types, simple types, and attributes that carry annotations.

## API Changes
The schema-tree output will include an `annotation` property on relevant nodes and an `annotation` child node describing the annotation payload.

## Affected Modules
- src/tree/treeNodeBuilders.js
- src/tree/extractTree.js

## Test Plan
- [ ] Schema tree exposes documentation/appinfo payloads
- [ ] Schema tree exposes processing-instruction metadata
- [ ] Annotation data is attached to relevant declaration nodes
