/**
 * Prompt Builder v2 — constructs highly specific, deterministic prompts.
 * No user text ever enters the prompt. Everything is preset-derived.
 *
 * Key upgrade: category-specific prompt templates with precise placement
 * instructions, not generic descriptions.
 */

/* ─── Category-specific prompt templates ─── */
const CATEGORY_TEMPLATES = {
  rings: (style, model, config = {}) => [
    `Create a close-up macro photograph of ${model.description}'s hand wearing this exact ring.`,
    `Placement: The ring is worn on the ${config.placement || "ring finger"} of the ${model.label.toLowerCase()} hand, aligned naturally with finger curvature.`,
    `Hand pose: ${config.pose || "relaxed elegant pose with slight finger separation"} — natural skin folds and knuckle detail visible.`,
    `${model.skinDetail}.`,
    `Environment: ${config.environment || "clean neutral luxury background with subtle gradient"}.`,
    `Lighting: ${config.lighting || style.lighting || "soft studio lighting with diffused highlights and gentle shadows"}.`,
    `Camera: ${config.camera || "macro lens, f/2.8 aperture, shallow depth of field with ring in sharp focus"}.`,
    `Mood: ${config.mood || style.mood || "elegant, premium, refined"}.`,
    `The ring must physically sit on the finger with correct perspective, not floating or pasted.`,
  ],

  necklace_sets: (style, model, config = {}) => [
    `Create a portrait photograph showing this exact necklace set worn by ${model.description}.`,
    `Placement: The necklace sits along the ${config.placement || "collarbone"} following natural neck curvature.`,
    `Pose: ${config.pose || "front-facing portrait with slight head tilt"}.`,
    `Environment: ${config.environment || "studio background with soft gradient"}.`,
    `Lighting: ${config.lighting || style.lighting || "soft frontal lighting with subtle highlights"}.`,
    `Camera: ${config.camera || "85mm portrait lens, f/4"}.`,
    `${model.skinDetail}. Realistic neck shadows and reflections must be visible.`,
    `The jewelry must remain identical and naturally integrated.`,
  ],

  frames: (style, config = {}) => [
    `Create a lifestyle interior photograph showing this exact photo frame displayed beautifully.`,
    `Environment: ${config.environment || "cozy living room with warm tones and natural textures"}.`,
    `Placement: ${config.placement || "centered as a decorative focal point"}.`,
    `Lighting: ${config.lighting || style.lighting || "warm directional light"}.`,
    `Camera: ${config.camera || "medium shot, straight-on or very slight 5-degree angle"}.`,
    `Mood: ${config.mood || style.mood || "warm, inviting, stylish"}.`,
    `The frame is the clear hero of the image, positioned using the rule of thirds.`,
  ],

  fridge_magnet: (style, config = {}) => [
    `Create a lifestyle photograph of this exact fridge magnet attached to a refrigerator door.`,
    `Surface: ${config.surface || "modern stainless steel refrigerator"}.`,
    `Placement: ${config.placement || "single focus at eye level"}.`,
    `Lighting: ${config.lighting || style.lighting || "natural kitchen window light"}.`,
    `Camera: ${config.camera || "close-up, slightly angled (15-degree), f/3.5"}.`,
    `The magnet must appear physically attached to the surface with correct perspective — slight shadow beneath it.`,
  ],

  idol: (style, config = {}) => [
    `Create a reverent, atmospheric photograph of this exact idol/figurine in a beautiful display setting.`,
    `Environment: ${config.environment || "sacred altar with soft flower petals"}.`,
    `Placement: ${config.placement || "centered on an ornate surface"}.`,
    `Lighting: ${config.lighting || style.lighting || "soft rim lighting to create a subtle halo effect"}.`,
    `Camera: ${config.camera || "medium close-up from a slightly low angle (10-15 degrees below eye level)"}.`,
    `Mood: ${config.mood || style.mood || "reverent, spiritual, peaceful"}.`,
    `The idol's details — every carving, paint stroke, material texture — must be perfectly preserved and sharp.`,
  ],

  wooden_craft: (style, config = {}) => [
    `Create a warm interior photograph showcasing this exact wooden craft piece.`,
    `Environment: ${config.environment || "cozy living room with warm tones and natural textures"}.`,
    `Surface: ${config.surface || "wooden table with visible grain"}.`,
    `Placement: ${config.placement || "centered as a decorative focal point"}.`,
    `Lighting: ${config.lighting || style.lighting || "warm directional light emphasizing texture"}.`,
    `Camera: ${config.camera || "30-degree angle, f/4 depth of field"}.`,
    `Mood: ${config.mood || style.mood || "warm, artisanal, handcrafted aesthetic"}.`,
    `The product's carving details and finish must be perfectly preserved.`,
  ],

  coasters: (style, config = {}) => [
    `Create a styled tabletop photograph featuring this exact set of coasters.`,
    `Surface: ${config.surface || "premium wooden table"}.`,
    `Environment: ${config.environment || "coffee setup with casual lifestyle elements"}.`,
    `Lighting: ${config.lighting || style.lighting || "soft, diffused natural light"}.`,
    `Camera: ${config.camera || "overhead (45-60 degree angle), f/4, styled flat-lay composition"}.`,
    `The coaster pattern, material, color, and edge details must be perfectly preserved.`,
  ],

  utility: (style, config = {}) => [
    `Create a lifestyle photograph of this exact utility product shown in its natural use environment.`,
    `Environment: ${config.environment || "clean, well-organized modern kitchen or home setting"}.`,
    `Placement: ${config.placement || "in use or ready to use"}.`,
    `Lighting: ${config.lighting || style.lighting || "even, bright lighting suggesting a clean environment"}.`,
    `Camera: ${config.camera || "medium shot, lifestyle perspective at natural eye level"}.`,
    `The product design, material, branding, and functional features must be exactly preserved.`,
  ],

  serveware: (style, config = {}) => [
    `Create an appetizing dining photograph featuring this exact serveware piece.`,
    `Environment: ${config.environment || "elegantly set dining table"}.`,
    `Placement: ${config.placement || "centered with complementary napkins and cutlery"}.`,
    `Lighting: ${config.lighting || style.lighting || "warm, inviting light from above-left simulating natural window light"}.`,
    `Camera: ${config.camera || "slightly elevated 30-degree dining perspective, f/3.5"}.`,
    `The serveware's glaze, pattern, color, material, and form must be rendered with absolute fidelity.`,
  ],
};

/**
 * Build the full generation prompt from a resolved preset config.
 * @param {object} preset — from presetEngine.resolvePreset()
 * @returns {string} the complete prompt string
 */
function buildPrompt(preset) {
  const { category, style, model } = preset;
  const categoryKey = preset.presetId.split("_")[0] +
    (preset.presetId.split("_").length > 2 && !model ? "_" + preset.presetId.split("_")[1] : "");

  // Find the correct template key
  const templateKey = Object.keys(CATEGORY_TEMPLATES).find((k) =>
    preset.presetId.startsWith(k)
  );

  const lines = [];

  // Category-specific template
  if (templateKey && CATEGORY_TEMPLATES[templateKey]) {
    const template = CATEGORY_TEMPLATES[templateKey];
    const templateLines = model 
      ? template(style, model, preset.userConfig || {}) 
      : template(style, preset.userConfig || {});
    lines.push(...templateLines);
  } else {
    // Fallback generic
    lines.push(
      `Create a photorealistic product photograph showing ${category.scene}.`
    );
    if (model) {
      lines.push(`The person should be ${model.description} with ${model.skinDetail}.`);
    }
    lines.push(`Product placement: ${preset.userConfig?.placement || category.placement}.`);
    lines.push(`Camera: ${preset.userConfig?.camera || category.camera}.`);
  }

  // Global Overrides Layer
  if (preset.userConfig) {
    let hasOverrides = false;
    const overrides = [];
    if (preset.userConfig.environment) overrides.push(`Environment override: ${preset.userConfig.environment}`);
    if (preset.userConfig.lighting) overrides.push(`Lighting override: ${preset.userConfig.lighting}`);
    if (preset.userConfig.camera) overrides.push(`Camera override: ${preset.userConfig.camera}`);
    if (preset.userConfig.mood) overrides.push(`Mood override: ${preset.userConfig.mood}`);
    
    if (overrides.length > 0) {
      lines.push("");
      lines.push(`── USER CONFIGURATION ──`);
      lines.push(...overrides);
    }
  }

  // Style layer (applied on top of category template)
  lines.push("");
  lines.push(`── STYLE DIRECTION ──`);
  lines.push(`Visual mood: ${style.label} — ${preset.userConfig?.mood || style.mood}.`);
  lines.push(`Lighting direction: ${preset.userConfig?.lighting || style.lighting}.`);
  lines.push(`Environment/background: ${preset.userConfig?.environment || style.background}.`);
  lines.push(`Color palette: ${style.colorPalette}.`);

  // Output Config Layer
  if (preset.outputConfig) {
    const config = preset.outputConfig;
    lines.push("");
    lines.push(`── OUTPUT CONFIGURATION ──`);
    
    if (config.aspectRatio)
      lines.push(`Framing: image composed in a ${config.aspectRatio} aspect ratio, subject centered.`);
    if (config.resolution)
      lines.push(`Resolution: ${config.resolution}-resolution output with fine detail and sharp textures.`);
    if (config.composition)
      lines.push(`Composition: ${config.composition}.`);
    if (config.zoom)
      lines.push(`Shot type: ${config.zoom} focusing tightly on the product.`);
    if (config.depthOfField)
      lines.push(`Depth of field: ${config.depthOfField}.`);
    if (config.colorStyle)
      lines.push(`Color grading: ${config.colorStyle}.`);
    if (config.sharpness)
      lines.push(`Image sharpness: ${config.sharpness}.`);
    if (config.backgroundIntensity)
      lines.push(`Background: ${config.backgroundIntensity}.`);
    if (config.shadowStyle)
      lines.push(`Shadows: ${config.shadowStyle}.`);
  }

  // Custom User Instructions
  if (preset.customInstructions) {
    lines.push("");
    lines.push(`── ADDITIONAL CUSTOM DETAILS ──`);
    lines.push(preset.customInstructions);
  }

  // Product preservation rules (CRITICAL)
  lines.push("");
  lines.push(`── ABSOLUTE RULES (NON-NEGOTIABLE) ──`);
  lines.push(`1. The product in the uploaded image MUST remain IDENTICAL — every detail of shape, color, texture, material, pattern, and design must be preserved exactly.`);
  lines.push(`2. Do NOT reimagine, stylize, or artistically reinterpret the product. It must look exactly like the uploaded photo.`);
  lines.push(`3. The product must interact realistically with the scene — correct shadows, reflections, perspective, and occlusion.`);
  lines.push(`4. No text, watermarks, logos, or signatures anywhere in the image.`);
  lines.push(`5. Final output: photorealistic, professional product photography quality, suitable for e-commerce use.`);

  return lines.join("\n");
}

/**
 * Build a variant prompt with composition tweaks for multi-generation.
 * @param {string} basePrompt
 * @param {number} variantIndex — 0, 1, 2
 * @returns {string}
 */
function buildVariantPrompt(basePrompt, variantIndex) {
  const variations = [
    "", // variant 0 = base prompt, no changes
    "\n\n── COMPOSITION VARIANT ──\nShift the camera angle by 10-15 degrees to the right. Adjust depth of field slightly deeper. Maintain all product and style requirements exactly.",
    "\n\n── COMPOSITION VARIANT ──\nUse a marginally tighter crop focusing more closely on the product. Shift the key light 20 degrees clockwise. Maintain all product and style requirements exactly.",
  ];

  return basePrompt + (variations[variantIndex] || "");
}

/**
 * Build a retry prompt — used when initial generation fails or scores low.
 * Simplifies the prompt while keeping critical rules.
 * @param {object} preset
 * @returns {string}
 */
function buildRetryPrompt(preset) {
  const { category, style, model } = preset;

  const lines = [
    `Generate a photorealistic product image.`,
    model
      ? `Scene: ${category.scene}. The person is ${model.description}.`
      : `Scene: ${category.scene}.`,
    `Product placement: ${category.placement}.`,
    `Style: ${style.label}. ${style.lighting}. ${style.background}.`,
    ``,
    `IMPORTANT: The product from the uploaded image must remain EXACTLY as-is — same shape, color, material, design. Do not alter it. Professional photography quality. No text or watermarks.`,
  ];

  return lines.join("\n");
}

module.exports = { buildPrompt, buildVariantPrompt, buildRetryPrompt };
