import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveAttributeType,
  resolveElementType,
  resolveGlobalElement,
  resolveGroup,
} from "../resolver/schemaResolvers.js";
import { createSampleValueForType } from "./sampleValueFactory.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createNamespaceContext(schema, rootDecl, options) {
  const map = new Map();
  const reverse = new Map();

  let counter = 1;

  function register(ns, preferredPrefix = null) {
    if (!ns) return null;
    if (map.has(ns)) return map.get(ns);

    let prefix = preferredPrefix;

    if (!prefix) {
      prefix =
        ns === schema.targetNamespace
          ? options.targetPrefix || "tns"
          : `ns${counter++}`;
    }

    map.set(ns, prefix);
    reverse.set(prefix, ns);

    return prefix;
  }

  if (rootDecl.namespaceUri) {
    register(rootDecl.namespaceUri, options.targetPrefix || "tns");
  }

  return {
    register,
    getPrefix(ns) {
      return map.get(ns) || register(ns);
    },
    getAll() {
      return map;
    },
  };
}

function repeatCount(minOccurs, maxOccurs, mode) {
  if (mode === "minimal") {
    return typeof minOccurs === "number" ? minOccurs : 1;
  }

  if (mode === "full") {
    if (typeof maxOccurs === "number") {
      return Math.max(
        typeof minOccurs === "number" ? minOccurs : 1,
        Math.min(maxOccurs, 2),
      );
    }
    return Math.max(typeof minOccurs === "number" ? minOccurs : 1, 1);
  }

  return 1;
}

function pickChoiceChildren(children, mode) {
  if (!children.length) return [];
  if (mode === "minimal") return [children[0]];
  return [children[0]];
}

function mergeAttributes(target, source) {
  Object.assign(target, source);
}

function qualifiedElementName(schema, elementDecl, state, isRoot = false) {
  const localName = elementDecl.name || elementDecl.refName || "element";
  const bare = localName.includes(":") ? localName.split(":")[1] : localName;

  const ns = elementDecl.namespaceUri;

  if (!ns) return bare;

  const prefix = state.nsContext.getPrefix(ns);

  return prefix ? `${prefix}:${bare}` : bare;
}

function buildRootNamespaceAttributes(schema, rootDecl, state) {
  const attrs = {};

  const nsMap = state.nsContext.getAll();

  for (const [ns, prefix] of nsMap.entries()) {
    attrs[`xmlns:${prefix}`] = ns;
  }

  return attrs;
}

function buildAttributesObject(schema, attributes, options, state) {
  const out = {};

  for (const attr of asArray(attributes)) {
    if (!attr) continue;

    if (attr.kind === "attribute") {
      if (attr.use !== "required" && !options.includeOptionalAttributes)
        continue;

      const attrName = attr.name || attr.refName || "attr";
      const resolvedType = resolveAttributeType(schema, attr);

      out[attrName] =
        attr.fixedValue ??
        attr.defaultValue ??
        createSampleValueForType(schema, resolvedType);
    } else if (attr.kind === "attributeGroupRef") {
      const group = state.resolveAttributeGroup?.(attr.refName);
      if (!group) continue;
      mergeAttributes(
        out,
        buildAttributesObject(schema, group.attributes || [], options, state),
      );
    }
  }

  return out;
}

function buildRepresentativeNodesFromContent(schema, contentNode, options, state) {
  if (!contentNode) return [];

  switch (contentNode.kind) {
    case "sequence":
    case "all": {
      for (const child of asArray(contentNode.children)) {
        const built = buildRepresentativeNodesFromContent(
          schema,
          child,
          options,
          state,
        );
        if (built.length) return built;
      }
      return [];
    }

    case "choice": {
      const selected = pickChoiceChildren(
        asArray(contentNode.children),
        options.mode,
      );
      for (const child of selected) {
        const built = buildRepresentativeNodesFromContent(
          schema,
          child,
          options,
          state,
        );
        if (built.length) return built;
      }
      return [];
    }

    case "groupRef": {
      const group = resolveGroup(schema, contentNode.refName);
      if (!group?.content) return [];
      return buildRepresentativeNodesFromContent(
        schema,
        group.content,
        options,
        state,
      );
    }

    case "element":
      return [
        buildElementNode(
          schema,
          {
            ...contentNode,
            minOccurs: 1,
            maxOccurs: 1,
          },
          options,
          state,
          false,
        ),
      ];

    case "any":
      return [
        {
          name: "anyElement",
          attributes: {},
          children: [],
          text: "example",
        },
      ];

    default:
      return [];
  }
}

function buildNodesFromContent(schema, contentNode, options, state) {
  if (!contentNode) return [];

  switch (contentNode.kind) {
    case "sequence":
    case "all": {
      const result = [];
      for (const child of asArray(contentNode.children)) {
        result.push(...buildNodesFromContent(schema, child, options, state));
      }
      return result;
    }

    case "choice": {
      const selected = pickChoiceChildren(
        asArray(contentNode.children),
        options.mode,
      );
      const result = [];
      for (const child of selected) {
        result.push(...buildNodesFromContent(schema, child, options, state));
      }
      return result;
    }

    case "groupRef": {
      const group = resolveGroup(schema, contentNode.refName);
      if (!group?.content) return [];
      return buildNodesFromContent(schema, group.content, options, state);
    }

    case "element":
      return buildElementInstances(schema, contentNode, options, state, false);

    case "any":
      return options.mode === "full"
        ? [
            {
              name: "anyElement",
              attributes: {},
              children: [],
              text: "example",
            },
          ]
        : [];

    default:
      return [];
  }
}

function buildComplexTypeContent(schema, complexTypeDecl, options, state) {
  const content = getEffectiveContent(schema, complexTypeDecl);
  const attributes = getEffectiveAttributes(schema, complexTypeDecl);

  let children = content
    ? buildNodesFromContent(schema, content, options, state)
    : [];

  if (
    options.mode === "minimal" &&
    children.length === 0 &&
    content
  ) {
    children = buildRepresentativeNodesFromContent(
      schema,
      content,
      options,
      state,
    );
  }

  return {
    attributes: buildAttributesObject(schema, attributes, options, state),
    children,
  };
}

function buildSimpleTypeText(schema, simpleTypeDecl) {
  return createSampleValueForType(schema, simpleTypeDecl);
}

function buildElementNode(schema, elementDecl, options, state, isRoot = false) {
  const resolvedType = resolveElementType(schema, elementDecl);

  const node = {
    name: qualifiedElementName(schema, elementDecl, state, isRoot),
    attributes: isRoot
      ? buildRootNamespaceAttributes(schema, elementDecl, state)
      : {},
    children: [],
    text: null,
  };

  if (
    resolvedType?.kind === "builtinType" ||
    resolvedType?.kind === "simpleType"
  ) {
    node.text =
      elementDecl.fixedValue ??
      elementDecl.defaultValue ??
      createSampleValueForType(schema, resolvedType);
    return node;
  }

  if (resolvedType?.kind === "complexType") {
    const built = buildComplexTypeContent(schema, resolvedType, options, state);
    node.attributes = {
      ...node.attributes,
      ...built.attributes,
    };

    if (
      resolvedType.contentModel === "simple" &&
      resolvedType.derivation?.baseTypeName
    ) {
      const baseType = resolveElementType(schema, {
        typeName: resolvedType.derivation.baseTypeName,
      });

      node.text =
        elementDecl.fixedValue ??
        elementDecl.defaultValue ??
        createSampleValueForType(schema, baseType);

      node.children = [];
      return node;
    }

    node.children = built.children;
    return node;
  }

  if (elementDecl.inlineType?.kind === "simpleType") {
    node.text =
      elementDecl.fixedValue ??
      elementDecl.defaultValue ??
      buildSimpleTypeText(schema, elementDecl.inlineType);
    return node;
  }

  node.text = elementDecl.fixedValue ?? elementDecl.defaultValue ?? "example";
  return node;
}

function buildElementInstances(
  schema,
  elementDecl,
  options,
  state,
  isRoot = false,
) {
  if (elementDecl.refName) {
    const target = resolveGlobalElement(schema, elementDecl.refName);
    if (target) {
      const mergedDecl = {
        ...target,
        minOccurs: elementDecl.minOccurs,
        maxOccurs: elementDecl.maxOccurs,
      };
      return buildElementInstances(schema, mergedDecl, options, state, isRoot);
    }
  }

  const count = repeatCount(
    elementDecl.minOccurs,
    elementDecl.maxOccurs,
    options.mode,
  );
  const result = [];

  for (let i = 0; i < count; i += 1) {
    result.push(
      buildElementNode(schema, elementDecl, options, state, isRoot && i === 0),
    );
  }

  return result;
}

function selectRoot(schema, options = {}) {
  if (options.rootElementName) {
    return resolveGlobalElement(schema, options.rootElementName);
  }

  return Object.values(schema.globals.elements || {})[0] || null;
}

export function generateXmlFromSchema(schema, options = {}, helpers = {}) {
  const normalizedOptions = {
    mode: options.mode === "full" ? "full" : "minimal",
    includeOptionalAttributes: options.includeOptionalAttributes === true,
  };

  const root = selectRoot(schema, options);
  if (!root) {
    return {
      rootElementName: null,
      rootNode: null,
    };
  }

  const nsContext = createNamespaceContext(schema, root, options);

  const state = {
    resolveAttributeGroup: helpers.resolveAttributeGroup,
    targetPrefix: options.targetPrefix || "tns",
    nsContext,
  };

const [rootNode] = buildElementInstances(
  schema,
  root,
  normalizedOptions,
  state,
  true,
);

// 🔥 PATCH: rebuild root xmlns AFTER full traversal
if (rootNode) {
  const finalNsAttrs = buildRootNamespaceAttributes(schema, root, state);

  rootNode.attributes = {
    ...finalNsAttrs,
    ...rootNode.attributes, // preserve any existing attrs
  };
}

  return {
    rootElementName: root.name,
    rootNode,
  };
}