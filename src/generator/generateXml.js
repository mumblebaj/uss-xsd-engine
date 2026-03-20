import {
  getEffectiveAttributes,
  getEffectiveContent,
  resolveAttributeType,
  resolveElementType,
  resolveGlobalElement,
  resolveGroup
} from "../resolver/schemaResolvers.js";
import { createSampleValueForType } from "./sampleValueFactory.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function repeatCount(minOccurs, maxOccurs, mode) {
  if (mode === "minimal") {
    return typeof minOccurs === "number" ? minOccurs : 1;
  }

  if (mode === "full") {
    if (typeof maxOccurs === "number") {
      return Math.max(typeof minOccurs === "number" ? minOccurs : 1, Math.min(maxOccurs, 2));
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

function buildAttributesObject(schema, attributes, options, state) {
  const out = {};

  for (const attr of asArray(attributes)) {
    if (!attr) continue;

    if (attr.kind === "attribute") {
      if (attr.use !== "required" && !options.includeOptionalAttributes) continue;

      const resolvedType = resolveAttributeType(schema, attr);
      out[attr.name || attr.refName || "attr"] =
        attr.fixedValue ??
        attr.defaultValue ??
        createSampleValueForType(schema, resolvedType);
    }
    else if (attr.kind === "attributeGroupRef") {
      const group = state.resolveAttributeGroup?.(attr.refName);
      if (!group) continue;
      mergeAttributes(
        out,
        buildAttributesObject(schema, group.attributes || [], options, state)
      );
    }
  }

  return out;
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
      const selected = pickChoiceChildren(asArray(contentNode.children), options.mode);
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
      return buildElementInstances(schema, contentNode, options, state);

    case "any":
      return options.mode === "full"
        ? [{ name: "anyElement", attributes: {}, children: [], text: "example" }]
        : [];

    default:
      return [];
  }
}

function buildComplexTypeContent(schema, complexTypeDecl, options, state) {
  const content = getEffectiveContent(schema, complexTypeDecl);
  const attributes = getEffectiveAttributes(schema, complexTypeDecl);

  return {
    attributes: buildAttributesObject(schema, attributes, options, state),
    children: content ? buildNodesFromContent(schema, content, options, state) : []
  };
}

function buildSimpleTypeText(schema, simpleTypeDecl) {
  return createSampleValueForType(schema, simpleTypeDecl);
}

function buildElementNode(schema, elementDecl, options, state) {
  const elementName = elementDecl.name || elementDecl.refName || "element";
  const resolvedType = resolveElementType(schema, elementDecl);

  const node = {
    name: elementName,
    attributes: {},
    children: [],
    text: null
  };

  if (resolvedType?.kind === "builtinType" || resolvedType?.kind === "simpleType") {
    node.text =
      elementDecl.fixedValue ??
      elementDecl.defaultValue ??
      createSampleValueForType(schema, resolvedType);
    return node;
  }

  if (resolvedType?.kind === "complexType") {
    const built = buildComplexTypeContent(schema, resolvedType, options, state);
    node.attributes = built.attributes;
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

function buildElementInstances(schema, elementDecl, options, state) {
  if (elementDecl.refName) {
    const target = resolveGlobalElement(schema, elementDecl.refName);
    if (target) {
      const mergedDecl = {
        ...target,
        minOccurs: elementDecl.minOccurs,
        maxOccurs: elementDecl.maxOccurs
      };
      return buildElementInstances(schema, mergedDecl, options, state);
    }
  }

  const count = repeatCount(elementDecl.minOccurs, elementDecl.maxOccurs, options.mode);
  const result = [];

  for (let i = 0; i < count; i += 1) {
    result.push(buildElementNode(schema, elementDecl, options, state));
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
    includeOptionalAttributes: options.includeOptionalAttributes === true
  };

  const root = selectRoot(schema, options);
  if (!root) {
    return {
      rootElementName: null,
      rootNode: null
    };
  }

  const state = {
    resolveAttributeGroup: helpers.resolveAttributeGroup
  };

  const [rootNode] = buildElementInstances(schema, root, normalizedOptions, state);

  return {
    rootElementName: root.name,
    rootNode
  };
}