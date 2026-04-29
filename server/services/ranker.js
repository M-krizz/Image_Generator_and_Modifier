const sharp = require("sharp");

/**
 * Rank a list of generated images by quality metrics.
 * Returns the images sorted best-first with scores attached.
 *
 * @param {Array<{filename: string, buffer: Buffer, url: string}>} images
 * @returns {Promise<Array<{filename: string, url: string, score: number, metrics: object}>>}
 */
async function rank(images) {
  const scored = [];

  for (const img of images) {
    const metrics = await analyseImage(img.buffer);
    const score = computeScore(metrics);
    scored.push({
      filename: img.filename,
      url: img.url,
      score,
      metrics,
    });
  }

  // Sort descending by score (best first)
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Analyse an image buffer for quality metrics using sharp.
 */
async function analyseImage(buffer) {
  const image = sharp(buffer);
  const stats = await image.stats();
  const metadata = await image.metadata();

  // Sharpness estimate: entropy of the image (higher = more detail)
  const entropy = stats.entropy || 0;

  // Brightness: average brightness across channels (0–255)
  const brightness =
    stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;

  // Contrast: standard deviation across channels
  const contrast =
    stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;

  // Resolution score
  const resolution = (metadata.width || 0) * (metadata.height || 0);

  return { entropy, brightness, contrast, resolution, width: metadata.width, height: metadata.height };
}

/**
 * Compute a composite quality score from metrics.
 * Each factor is normalised and weighted.
 */
function computeScore(metrics) {
  // Sharpness/entropy: higher is better, typical range 5–8
  const sharpnessScore = Math.min(metrics.entropy / 8, 1) * 30;

  // Brightness: ideal around 120–140 (not too dark, not blown out)
  const brightnessDiff = Math.abs(metrics.brightness - 130);
  const brightnessScore = Math.max(0, 1 - brightnessDiff / 130) * 25;

  // Contrast: higher is generally better, typical 40–80
  const contrastScore = Math.min(metrics.contrast / 80, 1) * 25;

  // Resolution: reward higher res, typical 1M–4M pixels
  const resScore = Math.min(metrics.resolution / 4_000_000, 1) * 20;

  return Math.round(sharpnessScore + brightnessScore + contrastScore + resScore);
}

module.exports = { rank };
