export function createIssue({
  code,
  severity = "error",
  message,
  line = null,
  column = null,
  path = null,
  source = "xsd",
  nodeKind = null,
  name = null,
  details = {}
}) {
  return {
    code,
    severity,
    message,
    line,
    column,
    path,
    source,
    nodeKind,
    name,
    details
  };
}