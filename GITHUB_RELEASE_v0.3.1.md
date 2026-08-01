## uss-xsd-engine v0.3.1

Patch release focused on non-streaming XML validation correctness.

### Highlights
- Fixed xs:any wildcard consumption so unbounded wildcard content accepts multiple valid children in sequence (for example AppHdr + Document under Body).
- Fixed xs:choice validation flow so issues from the selected branch are no longer dropped.
- Restored strict boolean lexical enforcement inside matched choice branches (`TRUE` / `FALSE` now correctly fail for `xs:boolean`).

### Why this matters
- Prevents false `XML_UNEXPECTED_ELEMENT` errors in wildcard body payloads.
- Ensures real nested validation failures are surfaced instead of silently lost.

### Included validation coverage
- Added regression tests for unbounded wildcard handling and boolean validation inside selected choice branches.
