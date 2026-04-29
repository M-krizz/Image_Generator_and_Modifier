/**
 * Analytics — tracks generation outcomes, user feedback, and failure patterns.
 * Stores data in a local JSON file for analysis and preset improvement.
 */

const fs = require("fs");
const path = require("path");

const ANALYTICS_DIR = path.join(process.env.STORAGE_DIR || "./storage", "analytics");
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, "tracking.json");

let data = {
  totalGenerations: 0,
  totalFeedback: 0,
  categoryStats: {},
  presetStats: {},
  feedbackLog: [],
  failureLog: [],
};

/** Initialise analytics — load existing data or create fresh */
function init() {
  fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  if (fs.existsSync(ANALYTICS_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf-8"));
    } catch {
      console.warn("⚠️  Analytics file corrupted, starting fresh.");
    }
  }
  save();
}

/** Persist analytics to disk */
function save() {
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Track a completed generation job.
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.category
 * @param {string} opts.style
 * @param {string} opts.presetId
 * @param {number} opts.variantsGenerated — how many images succeeded
 * @param {number} opts.bestScore — top ranked image score
 * @param {number} opts.durationMs — total generation time
 */
function trackGeneration({ jobId, category, style, presetId, variantsGenerated, bestScore, durationMs }) {
  data.totalGenerations++;

  // Category-level stats
  if (!data.categoryStats[category]) {
    data.categoryStats[category] = { total: 0, successes: 0, failures: 0, avgScore: 0, scores: [] };
  }
  const catStat = data.categoryStats[category];
  catStat.total++;
  if (variantsGenerated > 0) {
    catStat.successes++;
    catStat.scores.push(bestScore);
    catStat.avgScore = Math.round(catStat.scores.reduce((a, b) => a + b, 0) / catStat.scores.length);
  } else {
    catStat.failures++;
  }

  // Preset-level stats
  if (!data.presetStats[presetId]) {
    data.presetStats[presetId] = { total: 0, avgScore: 0, scores: [], thumbsUp: 0, thumbsDown: 0 };
  }
  const pStat = data.presetStats[presetId];
  pStat.total++;
  if (bestScore) {
    pStat.scores.push(bestScore);
    pStat.avgScore = Math.round(pStat.scores.reduce((a, b) => a + b, 0) / pStat.scores.length);
  }

  save();
}

/**
 * Track a generation failure.
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.category
 * @param {string} opts.presetId
 * @param {string} opts.error — error message
 * @param {number} opts.variantIndex
 */
function trackFailure({ jobId, category, presetId, error, variantIndex }) {
  if (!data.categoryStats[category]) {
    data.categoryStats[category] = { total: 0, successes: 0, failures: 0, avgScore: 0, scores: [] };
  }

  data.failureLog.push({
    jobId,
    category,
    presetId,
    error,
    variantIndex,
    timestamp: new Date().toISOString(),
  });

  // Keep last 200 failures only
  if (data.failureLog.length > 200) {
    data.failureLog = data.failureLog.slice(-200);
  }

  save();
}

/**
 * Record user feedback (thumbs up / thumbs down).
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.presetId
 * @param {string} opts.category
 * @param {string} opts.imageUrl
 * @param {"up"|"down"} opts.rating
 */
function trackFeedback({ jobId, presetId, category, imageUrl, rating }) {
  data.totalFeedback++;

  // Update preset stats
  if (data.presetStats[presetId]) {
    if (rating === "up") data.presetStats[presetId].thumbsUp++;
    else data.presetStats[presetId].thumbsDown++;
  }

  // Append to feedback log
  data.feedbackLog.push({
    jobId,
    presetId,
    category,
    imageUrl,
    rating,
    timestamp: new Date().toISOString(),
  });

  // Keep last 500 feedback entries
  if (data.feedbackLog.length > 500) {
    data.feedbackLog = data.feedbackLog.slice(-500);
  }

  save();
}

/** Get a summary report of analytics data */
function getSummary() {
  const categoryBreakdown = {};
  for (const [cat, stats] of Object.entries(data.categoryStats)) {
    categoryBreakdown[cat] = {
      total: stats.total,
      successRate: stats.total ? Math.round((stats.successes / stats.total) * 100) : 0,
      avgScore: stats.avgScore,
      failures: stats.failures,
    };
  }

  const presetBreakdown = {};
  for (const [preset, stats] of Object.entries(data.presetStats)) {
    presetBreakdown[preset] = {
      total: stats.total,
      avgScore: stats.avgScore,
      thumbsUp: stats.thumbsUp,
      thumbsDown: stats.thumbsDown,
      satisfaction: (stats.thumbsUp + stats.thumbsDown) > 0
        ? Math.round((stats.thumbsUp / (stats.thumbsUp + stats.thumbsDown)) * 100)
        : null,
    };
  }

  return {
    totalGenerations: data.totalGenerations,
    totalFeedback: data.totalFeedback,
    categoryBreakdown,
    presetBreakdown,
    recentFailures: data.failureLog.slice(-10),
  };
}

module.exports = { init, trackGeneration, trackFailure, trackFeedback, getSummary };
