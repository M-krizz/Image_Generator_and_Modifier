const gemini = require("./geminiWrapper");
const promptBuilder = require("./promptBuilder");
const storage = require("./storage");
const analytics = require("./analytics");
const { v4: uuidv4 } = require("uuid");

/**
 * Generate image variants with free-tier-aware delays.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @param {object} preset
 * @param {string} basePrompt
 * @param {string} jobId
 * @param {number} count
 * @param {function} onProgress
 */
async function generate(imageBuffer, mimeType, preset, basePrompt, jobId, count = 1, onProgress) {
  const maxVariants = parseInt(process.env.MAX_VARIANTS, 10) || 1;
  const numVariants = Math.min(count, maxVariants);
  const delayBetween = parseInt(process.env.RATE_LIMIT_DELAY_MS, 10) || 5000;
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < numVariants; i++) {
    // Delay between variants to avoid rate limits on free tier
    if (i > 0) {
      if (onProgress) onProgress(i + 1, numVariants + 1, `Cooling down before variant ${i + 1}...`);
      await new Promise(r => setTimeout(r, delayBetween));
    }

    const prompt = promptBuilder.buildVariantPrompt(basePrompt, i);
    if (onProgress) onProgress(i + 1, numVariants + 1, `Generating variant ${i + 1}/${numVariants}...`);

    try {
      const result = await gemini.generateImage(imageBuffer, mimeType, prompt);
      const saved = saveResult(result);
      results.push(saved);
    } catch (err) {
      console.error(`Variant ${i + 1} failed:`, err.message);
      analytics.trackFailure({
        jobId,
        category: preset.category?.label || "unknown",
        presetId: preset.presetId,
        error: err.message,
        variantIndex: i,
      });

      // Retry with simplified prompt (only on first failure, and only if no results yet)
      if (results.length === 0) {
        if (onProgress) onProgress(i + 1, numVariants + 1, `Retrying with simplified prompt...`);
        // Extra delay before retry
        await new Promise(r => setTimeout(r, delayBetween * 2));
        try {
          const retryPrompt = promptBuilder.buildRetryPrompt(preset);
          const result = await gemini.generateImage(imageBuffer, mimeType, retryPrompt);
          const saved = saveResult(result, "_retry");
          results.push(saved);
        } catch (retryErr) {
          console.error("Retry also failed:", retryErr.message);
          analytics.trackFailure({
            jobId,
            category: preset.category?.label || "unknown",
            presetId: preset.presetId,
            error: `Retry: ${retryErr.message}`,
            variantIndex: i,
          });
        }
      }
    }
  }

  // Track generation outcome
  analytics.trackGeneration({
    jobId,
    category: preset.presetId.split("_")[0],
    style: preset.style?.label || "unknown",
    presetId: preset.presetId,
    variantsGenerated: results.length,
    bestScore: 0,
    durationMs: Date.now() - startTime,
  });

  return results;
}

function saveResult(result, suffix = "") {
  const ext = result.mimeType.includes("png") ? "png" : "jpg";
  const filename = `gen_${uuidv4().slice(0, 8)}${suffix}.${ext}`;
  const filePath = storage.saveGenerated(filename, result.buffer);
  const url = storage.getPublicUrl("generated", filename);
  return { filename, path: filePath, url, buffer: result.buffer };
}

module.exports = { generate };
