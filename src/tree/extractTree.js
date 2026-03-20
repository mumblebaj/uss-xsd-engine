import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveElementType,
  resolveGlobalElement,
  resolveGroup,
  stripNamespacePrefix
} from "../resolver/schemaResolvers.js";
import { createTreeNode } from "./treeNodeBuilders.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function makeVisitedKey(prefix, nameOrPath) {
  return `${prefix}:${nameOrPath || "anonymous"}`;
}

function buildElementLabel(elementDecl) {
  if (elementDecl.refName) return elementDecl.refName;
  if (elementDecl.name) return elementDecl.name;
  return "element";
}

function buildAttributeLabel(attributeDecl) {
  if (attributeDecl.refName) return `@${attributeDecl.refName}`;
  if (attributeDecl.name) return `@${attributeDecl.name}`;
  return "@attribute";
}

function buildSimpleTypeChildren(schema, simpleTypeDecl) {
  if (!simpleTypeDecl) return [];

  const children = [];

  if (simpleTypeDecl.baseTypeName) {
    children.push(
      createTreeNode({
        kind: "baseType",
        label: `base: ${simpleTypeDecl.baseTypeName}`,
        baseTypeName: simpleTypeDecl.baseTypeName,
        line: simpleTypeDecl.line,
        column: simpleTypeDecl.column,
        path: simpleTypeDecl.path,
        children: []
      })
    );
  }

  const enumerations = asArray(simpleTypeDecl.enumerations);
  if (enumerations.length) {
    children.push(
      createTreeNode({
        kind: "enumerations",
        label: "enumerations",
        line: simpleTypeDecl.line,
        column: simpleTypeDecl.column,
        path: simpleTypeDecl.path ? `${simpleTypeDecl.path}/enumerations` : null,
        children: enumerations.map((value, index) =>
          createTreeNode({
            kind: "enumeration",
            label: String(value),
            line: simpleTypeDecl.line,
            column: simpleTypeDecl.column,
            path: simpleTypeDecl.path ? `${simpleTypeDecl.path}/enumeration[${index + 1}]` : null,
            children: []
          })
        )
      })
    );
  }

  return children;
}

function buildAttributeNode(schema, attributeDecl, state) {
  const node = createTreeNode({
    kind: "attribute",
    name: attributeDecl.name,
    label: buildAttributeLabel(attributeDecl),
    typeName: attributeDecl.typeName,
    refName: attributeDecl.refName,
    use: attributeDecl.use,
    line: attributeDecl.line,
    column: attributeDecl.column,
    path: attributeDecl.path,
    children: []
  });

  if (attributeDecl.inlineType?.kind === "simpleType") {
    node.children.push(
      createTreeNode({
        kind: "simpleType",
        name: attributeDecl.inlineType.name,
        label: attributeDecl.inlineType.name || "simpleType",
        baseTypeName: attributeDecl.inlineType.baseTypeName,
        line: attributeDecl.inlineType.line,
        column: attributeDecl.inlineType.column,
        path: attributeDecl.inlineType.path,
        children: buildSimpleTypeChildren(schema, attributeDecl.inlineType)
      })
    );
  }

  return node;
}

function buildAttributesNodes(schema, attributes, state) {
  const nodes = [];

  for (const attr of asArray(attributes)) {
    if (!attr) continue;

    if (attr.kind === "attribute") {
      nodes.push(buildAttributeNode(schema, attr, state));
    }
    else if (attr.kind === "attributeGroupRef") {
      const target = state.expandRefs ? state.resolveAttributeGroup?.(attr.refName) : null;

      const refNode = createTreeNode({
        kind: "attributeGroupRef",
        refName: attr.refName,
        label: `attributeGroup: ${attr.refName}`,
        line: attr.line,
        column: attr.column,
        path: attr.path,
        children: []
      });

      if (target) {
        refNode.children.push(
          createTreeNode({
            kind: "attributeGroup",
            name: target.name,
            label: target.name || "attributeGroup",
            line: target.line,
            column: target.column,
            path: target.path,
            children: buildAttributesNodes(schema, target.attributes || [], state)
          })
        );
      }

      nodes.push(refNode);
    }
  }

  return nodes;
}

function buildGroupRefNode(schema, groupRefNode, state) {
  const node = createTreeNode({
    kind: "groupRef",
    refName: groupRefNode.refName,
    label: `group: ${groupRefNode.refName}`,
    minOccurs: groupRefNode.minOccurs,
    maxOccurs: groupRefNode.maxOccurs,
    line: groupRefNode.line,
    column: groupRefNode.column,
    path: groupRefNode.path,
    children: []
  });

  if (!state.expandRefs) return node;

  const target = resolveGroup(schema, groupRefNode.refName);
  if (!target) return node;

  const visitedKey = makeVisitedKey("group", target.name || target.path);
  if (state.visited.has(visitedKey)) return node;

  state.visited.add(visitedKey);

  node.children.push(
    createTreeNode({
      kind: "group",
      name: target.name,
      label: target.name || "group",
      line: target.line,
      column: target.column,
      path: target.path,
      children: target.content ? [buildContentNode(schema, target.content, state)] : []
    })
  );

  state.visited.delete(visitedKey);
  return node;
}

function buildContentNode(schema, contentNode, state) {
  if (!contentNode) return null;

  switch (contentNode.kind) {
    case "sequence":
    case "choice":
    case "all":
      return createTreeNode({
        kind: contentNode.kind,
        label: contentNode.kind,
        minOccurs: contentNode.minOccurs,
        maxOccurs: contentNode.maxOccurs,
        line: contentNode.line,
        column: contentNode.column,
        path: contentNode.path,
        children: asArray(contentNode.children)
          .map((child) => buildContentNode(schema, child, state))
          .filter(Boolean)
      });

    case "element":
      return buildElementNode(schema, contentNode, state);

    case "groupRef":
      return buildGroupRefNode(schema, contentNode, state);

    case "any":
      return createTreeNode({
        kind: "any",
        label: "any",
        minOccurs: contentNode.minOccurs,
        maxOccurs: contentNode.maxOccurs,
        line: contentNode.line,
        column: contentNode.column,
        path: contentNode.path,
        children: []
      });

    default:
      return createTreeNode({
        kind: contentNode.kind || "unknown",
        label: contentNode.kind || "unknown",
        line: contentNode.line,
        column: contentNode.column,
        path: contentNode.path,
        children: []
      });
  }
}

function buildComplexTypeNode(schema, complexTypeDecl, state) {
  const content = getEffectiveContent(schema, complexTypeDecl);
  const attributes = getEffectiveAttributes(schema, complexTypeDecl);

  const children = [];

  if (complexTypeDecl.derivation?.kind || complexTypeDecl.derivation?.baseTypeName) {
    children.push(
      createTreeNode({
        kind: "derivation",
        label: complexTypeDecl.derivation.kind || "derivation",
        baseTypeName: complexTypeDecl.derivation.baseTypeName,
        derivation: complexTypeDecl.derivation.kind,
        line: complexTypeDecl.line,
        column: complexTypeDecl.column,
        path: complexTypeDecl.path ? `${complexTypeDecl.path}/derivation` : null,
        children: []
      })
    );
  }

  if (content) {
    const contentTree = buildContentNode(schema, content, state);
    if (contentTree) children.push(contentTree);
  }

  const attributeNodes = buildAttributesNodes(schema, attributes, state);
  children.push(...attributeNodes);

  return createTreeNode({
    kind: "complexType",
    name: complexTypeDecl.name,
    label: complexTypeDecl.name || "complexType",
    baseTypeName: complexTypeDecl.derivation?.baseTypeName || null,
    derivation: complexTypeDecl.derivation?.kind || null,
    line: complexTypeDecl.line,
    column: complexTypeDecl.column,
    path: complexTypeDecl.path,
    children
  });
}

function buildSimpleTypeNode(schema, simpleTypeDecl) {
  return createTreeNode({
    kind: "simpleType",
    name: simpleTypeDecl.name,
    label: simpleTypeDecl.name || "simpleType",
    baseTypeName: simpleTypeDecl.baseTypeName,
    line: simpleTypeDecl.line,
    column: simpleTypeDecl.column,
    path: simpleTypeDecl.path,
    children: buildSimpleTypeChildren(schema, simpleTypeDecl)
  });
}

function buildReferencedGlobalElementNode(schema, refName, state) {
  const target = resolveGlobalElement(schema, refName);
  if (!target) return null;

  const visitedKey = makeVisitedKey("element", target.name || target.path);
  if (state.visited.has(visitedKey)) {
    return createTreeNode({
      kind: "elementRefTarget",
      name: target.name,
      label: target.name || refName,
      typeName: target.typeName,
      line: target.line,
      column: target.column,
      path: target.path,
      children: []
    });
  }

  state.visited.add(visitedKey);
  const node = buildElementNode(schema, target, state);
  state.visited.delete(visitedKey);
  return node;
}

function buildElementNode(schema, elementDecl, state) {
  const node = createTreeNode({
    kind: "element",
    name: elementDecl.name,
    label: buildElementLabel(elementDecl),
    typeName: elementDecl.typeName,
    refName: elementDecl.refName,
    minOccurs: elementDecl.minOccurs,
    maxOccurs: elementDecl.maxOccurs,
    line: elementDecl.line,
    column: elementDecl.column,
    path: elementDecl.path,
    children: []
  });

  if (elementDecl.refName && state.expandRefs) {
    const targetNode = buildReferencedGlobalElementNode(schema, elementDecl.refName, state);
    if (targetNode) {
      node.children.push(targetNode);
      return node;
    }
  }

  const resolvedType = resolveElementType(schema, elementDecl);

  if (!resolvedType) {
    return node;
  }

  if (resolvedType.kind === "builtinType") {
    node.children.push(
      createTreeNode({
        kind: "builtinType",
        label: resolvedType.name,
        typeName: resolvedType.name,
        line: elementDecl.line,
        column: elementDecl.column,
        path: elementDecl.path ? `${elementDecl.path}/builtinType` : null,
        children: []
      })
    );
    return node;
  }

  if (resolvedType.kind === "simpleType") {
    node.children.push(buildSimpleTypeNode(schema, resolvedType));
    return node;
  }

  if (resolvedType.kind === "complexType") {
    const typeKey = makeVisitedKey("complexType", resolvedType.name || resolvedType.path);
    if (state.visited.has(typeKey)) {
      node.children.push(
        createTreeNode({
          kind: "complexType",
          name: resolvedType.name,
          label: resolvedType.name || "complexType",
          line: resolvedType.line,
          column: resolvedType.column,
          path: resolvedType.path,
          children: []
        })
      );
      return node;
    }

    state.visited.add(typeKey);
    node.children.push(buildComplexTypeNode(schema, resolvedType, state));
    state.visited.delete(typeKey);
    return node;
  }

  return node;
}

function selectRoots(schema, options = {}) {
  if (options.rootElementName) {
    const root = resolveGlobalElement(schema, options.rootElementName);
    return root ? [root] : [];
  }

  return Object.values(schema.globals.elements || {});
}

export function extractTreeFromSchema(schema, options = {}, helpers = {}) {
  const roots = selectRoots(schema, options);

  const state = {
    expandRefs: options.expandRefs !== false,
    visited: new Set(),
    resolveAttributeGroup: helpers.resolveAttributeGroup
  };

  const tree = roots.map((root) => buildElementNode(schema, root, state));

  return {
    roots: schema.roots,
    tree
  };
}