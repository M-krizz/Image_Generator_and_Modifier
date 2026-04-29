const fs = require("fs");
const path = require("path");

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

const DIRS = {
  uploads: path.join(STORAGE_DIR, "uploads"),
  generated: path.join(STORAGE_DIR, "generated"),
  output: path.join(STORAGE_DIR, "output"),
};

/** Ensure all storage directories exist */
function init() {
  Object.values(DIRS).forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

/** Save an uploaded file buffer and return its path */
function saveUpload(filename, buffer) {
  const filePath = path.join(DIRS.uploads, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Save a generated image buffer and return its path */
function saveGenerated(filename, buffer) {
  const filePath = path.join(DIRS.generated, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Save a final output image buffer and return its path */
function saveOutput(filename, buffer) {
  const filePath = path.join(DIRS.output, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/** Get the absolute path for a stored file */
function getFilePath(type, filename) {
  return path.join(DIRS[type], filename);
}

/** Get public URL path for serving via Express */
function getPublicUrl(type, filename) {
  return `/storage/${type}/${filename}`;
}

module.exports = { init, saveUpload, saveGenerated, saveOutput, getFilePath, getPublicUrl, DIRS };
