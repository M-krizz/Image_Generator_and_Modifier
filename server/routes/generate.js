const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { upload, validateMetadata } = require("../middleware/validator");
const presetEngine = require("../services/presetEngine");
const promptBuilder = require("../services/promptBuilder");
const promptRefiner = require("../services/promptRefiner");
const multiGenerator = require("../services/multiGenerator");
const ranker = require("../services/ranker");
const storage = require("../services/storage");
const analytics = require("../services/analytics");

const router = express.Router();

// In-memory job/draft store (swap for Redis/DB in production)
const drafts = new Map();
const jobs = new Map();

/**
 * GET /api/options
 * Returns all dropdown options for the frontend form.
 */
router.get("/options", (_req, res) => {
  res.json(presetEngine.getFormOptions());
});

/**
 * POST /api/draft
 * Accepts product image + metadata, resolves preset, builds base prompt.
 * Returns draft ID and prompt for user review.
 */
router.post(
  "/draft",
  upload.single("image"),
  validateMetadata,
  async (req, res) => {
    const draftId = uuidv4();
    const { category, style, modelType, userConfig, outputConfig, customInstructions } = req.validated;
    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Save upload temporarily/permanently
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const uploadFilename = `upload_${draftId.slice(0, 8)}.${ext}`;
    storage.saveUpload(uploadFilename, imageBuffer);

    // Resolve preset
    const preset = presetEngine.resolvePreset(category, style, modelType);
    if (!preset) {
      return res.status(400).json({ error: "Could not resolve preset for given options" });
    }

    // Attach user configurations
    if (userConfig) {
      preset.userConfig = typeof userConfig === "string" ? JSON.parse(userConfig) : userConfig;
    }

    // Attach output configurations
    if (outputConfig) {
      preset.outputConfig = typeof outputConfig === "string" ? JSON.parse(outputConfig) : outputConfig;
    }

    if (customInstructions) {
      preset.customInstructions = customInstructions;
    }

    // Generate base prompt
    const basePrompt = promptBuilder.buildPrompt(preset);

    // Store draft
    drafts.set(draftId, {
      draftId,
      imageBuffer,
      mimeType,
      uploadFilename,
      uploadUrl: storage.getPublicUrl("uploads", uploadFilename),
      preset,
      category,
      style,
      modelType,
      basePrompt
    });

    res.json({ draftId, prompt: basePrompt, uploadUrl: drafts.get(draftId).uploadUrl });
  }
);

/**
 * POST /api/refine-prompt
 * Uses AI to enhance the drafted prompt.
 */
router.post("/refine-prompt", express.json(), async (req, res) => {
  const { draftId, prompt } = req.body;
  if (!draftId || !prompt) {
    return res.status(400).json({ error: "Required: draftId, prompt" });
  }

  const draft = drafts.get(draftId);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  try {
    const enhancedPrompt = await promptRefiner.enhancePrompt(prompt, draft.preset.category?.label || "product");
    res.json({ prompt: enhancedPrompt });
  } catch (err) {
    console.error("Refine prompt error:", err);
    res.status(500).json({ error: "Failed to refine prompt" });
  }
});

/**
 * POST /api/generate
 * Starts generation job using drafted image and final prompt.
 */
router.post("/generate", express.json(), async (req, res) => {
  const { draftId, finalPrompt } = req.body;
  if (!draftId || !finalPrompt) {
    return res.status(400).json({ error: "Required: draftId, finalPrompt" });
  }

  const draft = drafts.get(draftId);
  if (!draft) return res.status(404).json({ error: "Draft not found or expired" });

  const jobId = draftId; // Use draftId as jobId for simplicity

  // Create job entry
  jobs.set(jobId, {
    id: jobId,
    status: "processing",
    progress: 0,
    message: "Starting generation...",
    category: draft.category,
    style: draft.style,
    modelType: draft.modelType,
    presetId: draft.preset.presetId,
    uploadUrl: draft.uploadUrl,
    results: null,
    createdAt: new Date().toISOString(),
  });

  // Return job ID immediately
  res.json({ jobId, status: "processing" });

  // Process in background
  processJob(jobId, draft.imageBuffer, draft.mimeType, draft.preset, finalPrompt).catch((err) => {
    console.error(`Job ${jobId} failed:`, err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.message = err.message;
    }
  });

  // Cleanup draft? We can keep it or delete it. Let's keep it for now.
});

/**
 * GET /api/jobs/:id
 * Poll job status and results.
 */
router.get("/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  // Don't send buffers to client
  const { ...safeJob } = job;
  res.json(safeJob);
});

/**
 * POST /api/feedback
 * Record user feedback (thumbs up / thumbs down) on a generated image.
 */
router.post("/feedback", express.json(), (req, res) => {
  const { jobId, imageUrl, rating } = req.body;

  if (!jobId || !imageUrl || !['up', 'down'].includes(rating)) {
    return res.status(400).json({ error: "Required: jobId, imageUrl, rating ('up' or 'down')" });
  }

  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  analytics.trackFeedback({
    jobId,
    presetId: job.presetId,
    category: job.category,
    imageUrl,
    rating,
  });

  res.json({ success: true, message: `Feedback '${rating}' recorded.` });
});

/**
 * GET /api/analytics
 * Returns analytics summary — category success rates, preset scores, feedback.
 */
router.get("/analytics", (_req, res) => {
  res.json(analytics.getSummary());
});

/**
 * Background job processor — runs the full pipeline.
 */
async function processJob(jobId, imageBuffer, mimeType, preset, finalPrompt) {
  const job = jobs.get(jobId);

  const updateProgress = (step, total, message) => {
    job.progress = Math.round((step / total) * 100);
    job.message = message;
  };

  try {
    // Step 1: Generate variants
    updateProgress(1, 4, "Generating image variants...");
    const generated = await multiGenerator.generate(
      imageBuffer,
      mimeType,
      preset,
      finalPrompt,
      jobId,
      parseInt(process.env.MAX_VARIANTS, 10) || 1,
      updateProgress
    );

    if (generated.length === 0) {
      throw new Error("All generation attempts failed. Please try again.");
    }

    // Step 2: Rank images
    updateProgress(3, 4, "Ranking generated images...");
    const ranked = await ranker.rank(generated);

    // Step 3: Save top results as final output
    updateProgress(4, 4, "Finalising results...");
    const finalResults = ranked.map((img, index) => ({
      url: img.url,
      score: img.score,
      rank: index + 1,
      isBest: index === 0,
      metrics: img.metrics,
    }));

    // Update job as complete
    job.status = "completed";
    job.progress = 100;
    job.message = "Done!";
    job.results = finalResults;
    job.completedAt = new Date().toISOString();
  } catch (err) {
    job.status = "failed";
    job.message = err.message;
    throw err;
  }
}

module.exports = router;
