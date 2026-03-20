export function createTreeNode({
  kind,
  name = null,
  label = null,
  typeName = null,
  refName = null,
  baseTypeName = null,
  derivation = null,
  minOccurs = 1,
  maxOccurs = 1,
  use = null,
  line = null,
  column = null,
  path = null,
  children = []
} = {}) {
  return {
    kind,
    name,
    label: label ?? name ?? kind,
    typeName,
    refName,
    baseTypeName,
    derivation,
    minOccurs,
    maxOccurs,
    use,
    line,
    column,
    path,
    children
  };
}

export function cloneTreeNode(node) {
  return JSON.parse(JSON.stringify(node));
}