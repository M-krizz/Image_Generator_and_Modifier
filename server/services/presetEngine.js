const presets = require("../presets/presets.json");

/**
 * Look up the category config from presets.
 * @param {string} categoryKey — e.g. "rings", "idol"
 * @returns {object|null} category preset or null
 */
function getCategory(categoryKey) {
  return presets.categories[categoryKey] || null;
}

/**
 * Look up the style config from presets.
 * @param {string} styleKey — e.g. "cultural", "luxury"
 * @returns {object|null} style preset or null
 */
function getStyle(styleKey) {
  return presets.styles[styleKey] || null;
}

/**
 * Look up the model type config from presets.
 * @param {string} modelKey — e.g. "female", "male"
 * @returns {object|null} model preset or null
 */
function getModelType(modelKey) {
  return presets.modelTypes[modelKey] || null;
}

/** Get all available category keys */
function getCategoryKeys() {
  return Object.keys(presets.categories);
}

/** Get all available style keys */
function getStyleKeys() {
  return Object.keys(presets.styles);
}

/** Get all available model type keys */
function getModelTypeKeys() {
  return Object.keys(presets.modelTypes);
}

/** Check whether a category requires a model (wearable items) */
function categoryRequiresModel(categoryKey) {
  const cat = presets.categories[categoryKey];
  return cat ? cat.requiresModel : false;
}

/** Build the full preset config object for a given combination */
function resolvePreset(categoryKey, styleKey, modelKey) {
  const category = getCategory(categoryKey);
  const style = getStyle(styleKey);
  const model = category?.requiresModel ? getModelType(modelKey) : null;

  if (!category || !style) return null;

  return {
    category,
    style,
    model,
    presetId: `${categoryKey}_${styleKey}${model ? "_" + modelKey : ""}`,
  };
}

/** Return full preset metadata for the frontend (dropdowns) */
function getFormOptions() {
  const categories = Object.entries(presets.categories).map(([key, val]) => ({
    value: key,
    label: val.label,
    requiresModel: val.requiresModel,
  }));

  const styles = Object.entries(presets.styles).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

  const modelTypes = Object.entries(presets.modelTypes).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

  const uiOptions = presets.uiOptions;

  return { categories, styles, modelTypes, uiOptions };
}

module.exports = {
  getCategory, getStyle, getModelType,
  getCategoryKeys, getStyleKeys, getModelTypeKeys,
  categoryRequiresModel, resolvePreset, getFormOptions,
};
