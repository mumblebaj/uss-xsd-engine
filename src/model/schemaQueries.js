import {
  resolveElementDeclaration,
  resolveEffectiveComplexTypeForElement,
  resolveEffectiveSimpleTypeByName,
  resolveEffectiveSimpleTypeForElement
} from "./resolver/schemaResolvers.js";

export function getRootElements(schemaModel) {
  return schemaModel?.rootElements || [];
}

export function getElementModel(schemaModel, name) {
  if (!schemaModel || !name) return null;
  return schemaModel.elements?.get(name) || null;
}

export function getAttributeGroupModel(schemaModel, name) {
  if (!schemaModel || !name) return null;
  return schemaModel.attributeGroups?.get(name) || null;
}

export function getSimpleTypeModel(schemaModel, name) {
  if (!schemaModel || !name) return null;
  return schemaModel.simpleTypes?.get(name) || null;
}

export function getComplexTypeModel(schemaModel, name) {
  if (!schemaModel || !name) return null;
  return schemaModel.complexTypes?.get(name) || null;
}

export function getEffectiveElementName(schemaModel, elementModel) {
  const resolved = resolveElementDeclaration(schemaModel, elementModel);
  return resolved?.name || elementModel?.name || elementModel?.refName || "";
}

export function getResolvedElementModel(schemaModel, elementModel) {
  return resolveElementDeclaration(schemaModel, elementModel);
}

export function getEffectiveComplexType(schemaModel, elementModel) {
  return resolveEffectiveComplexTypeForElement(schemaModel, elementModel);
}

export function getSimpleContentModel(schemaModel, elementModel) {
  const effectiveComplexType = getEffectiveComplexType(schemaModel, elementModel);
  return effectiveComplexType?.simpleContent || null;
}

export function getComplexContentModel(schemaModel, elementModel) {
  const effectiveComplexType = getEffectiveComplexType(schemaModel, elementModel);
  return effectiveComplexType?.complexContent || null;
}

export function getContentModel(schemaModel, elementModel) {
  const effectiveComplexType = getEffectiveComplexType(schemaModel, elementModel);
  return effectiveComplexType?.content || null;
}

export function getSequenceChildren(schemaModel, elementModel) {
  const content = getContentModel(schemaModel, elementModel);
  return content?.kind === "sequence" ? (content.children || []) : [];
}

export function getChoiceChildren(schemaModel, elementModel) {
  const content = getContentModel(schemaModel, elementModel);
  return content?.kind === "choice" ? (content.children || []) : [];
}

export function getAllChildren(schemaModel, elementModel) {
  const content = getContentModel(schemaModel, elementModel);
  return content?.kind === "all" ? (content.children || []) : [];
}

export function getAttributes(schemaModel, elementModel) {
  const effectiveComplexType = getEffectiveComplexType(schemaModel, elementModel);
  return effectiveComplexType?.attributes || [];
}

export function getElementParticleChildren(schemaModel, elementModel) {
  const content = getContentModel(schemaModel, elementModel);
  return content?.children || [];
}

export function hasElement(schemaModel, name) {
  if (!schemaModel || !name) return false;
  return schemaModel.elements?.has(name) || false;
}

export function hasComplexType(schemaModel, name) {
  if (!schemaModel || !name) return false;
  return schemaModel.complexTypes?.has(name) || false;
}

export function hasSimpleType(schemaModel, name) {
  if (!schemaModel || !name) return false;
  return schemaModel.simpleTypes?.has(name) || false;
}

export function getEffectiveSimpleType(schemaModel, typeName) {
  return resolveEffectiveSimpleTypeByName(schemaModel, typeName);
}

export function getEffectiveSimpleTypeForElement(schemaModel, elementModel) {
  return resolveEffectiveSimpleTypeForElement(schemaModel, elementModel);
}