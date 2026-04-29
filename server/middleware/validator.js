const multer = require("multer");
const presetEngine = require("../services/presetEngine");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_DIMENSION = 512;
const MAX_DIMENSION = 4096;

/** Multer config — stores in memory for processing */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
    }
  },
});

/**
 * Validate the metadata fields (category, style, modelType).
 * Express middleware — attaches validated data to req.validated.
 */
function validateMetadata(req, res, next) {
  const { category, style, modelType, userConfig, outputConfig, customInstructions } = req.body;

  // Category is required
  if (!category || !presetEngine.getCategory(category)) {
    return res.status(400).json({
      error: "Invalid category",
      validCategories: presetEngine.getCategoryKeys(),
    });
  }

  // Style is required
  if (!style || !presetEngine.getStyle(style)) {
    return res.status(400).json({
      error: "Invalid style",
      validStyles: presetEngine.getStyleKeys(),
    });
  }

  // Model type required only for wearable categories
  if (presetEngine.categoryRequiresModel(category)) {
    if (!modelType || !presetEngine.getModelType(modelType)) {
      return res.status(400).json({
        error: `Category "${category}" requires a model type`,
        validModelTypes: presetEngine.getModelTypeKeys(),
      });
    }
  }

  // File must be present
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  // Attach validated data
  req.validated = { category, style, modelType: modelType || null, userConfig, outputConfig, customInstructions };
  next();
}

module.exports = { upload, validateMetadata };
