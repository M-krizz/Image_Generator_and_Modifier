/* ============================================
   Product Viz Engine — Frontend Logic
   ============================================ */

const API = "";

// DOM refs
const form = document.getElementById("generate-form");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const previewImg = document.getElementById("preview-image");
const categorySelect = document.getElementById("category-select");
const styleSelect = document.getElementById("style-select");
const modelSelect = document.getElementById("model-select");
const modelField = document.getElementById("model-field");
const btnGenerate = document.getElementById("btn-generate");
const btnLoader = document.getElementById("btn-loader");

const uploadSection = document.getElementById("upload-section");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const progressMessage = document.getElementById("progress-message");
const resultsSection = document.getElementById("results-section");
const resultsSub = document.getElementById("results-sub");
const resultsGrid = document.getElementById("results-grid");
const errorSection = document.getElementById("error-section");
const errorMessage = document.getElementById("error-message");

let selectedFile = null;
let formOptions = null;
let pollTimer = null;
let currentJobId = null;

/* ============================================
   Init — Load form options from server
   ============================================ */
async function init() {
  try {
    const res = await fetch(`${API}/api/options`);
    formOptions = await res.json();
    populateDropdowns();
  } catch (err) {
    console.error("Failed to load options:", err);
  }
}

function populateDropdowns() {
  formOptions.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.value;
    opt.textContent = c.label;
    categorySelect.appendChild(opt);
  });

  formOptions.styles.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.value;
    opt.textContent = s.label;
    styleSelect.appendChild(opt);
  });

  formOptions.modelTypes.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
}

/* ============================================
   Dropzone — Drag & Drop + Click
   ============================================ */
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag-over");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    alert("Please upload a JPEG, PNG, or WebP image.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert("File too large. Maximum 10 MB.");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    dropzone.classList.add("has-image");
  };
  reader.readAsDataURL(file);
  updateButton();
}

/* ============================================
   Category change — show/hide model selector
   ============================================ */
categorySelect.addEventListener("change", () => {
  const cat = formOptions.categories.find((c) => c.value === categorySelect.value);
  if (cat && cat.requiresModel) {
    modelField.style.display = "block";
  } else {
    modelField.style.display = "none";
    modelSelect.value = "";
  }
  updateButton();
});

styleSelect.addEventListener("change", updateButton);
modelSelect.addEventListener("change", updateButton);

function updateButton() {
  const cat = formOptions?.categories.find((c) => c.value === categorySelect.value);
  const needsModel = cat?.requiresModel;
  const valid =
    selectedFile &&
    categorySelect.value &&
    styleSelect.value &&
    (!needsModel || modelSelect.value);

  btnGenerate.disabled = !valid;
}

/* ============================================
   Form Submit — Generate
   ============================================ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append("image", selectedFile);
  formData.append("category", categorySelect.value);
  formData.append("style", styleSelect.value);
  if (modelSelect.value) formData.append("modelType", modelSelect.value);

  // Show progress
  showSection("progress");
  progressBar.style.width = "5%";
  progressMessage.textContent = "Uploading image…";

  try {
    const res = await fetch(`${API}/api/generate`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Generation failed");

    // Start polling
    currentJobId = data.jobId;
    pollJob(data.jobId);
  } catch (err) {
    showError(err.message);
  }
});

/* ============================================
   Poll Job Status
   ============================================ */
function pollJob(jobId) {
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/api/jobs/${jobId}`);
      const job = await res.json();

      if (job.status === "processing") {
        progressBar.style.width = `${Math.max(job.progress, 10)}%`;
        progressMessage.textContent = job.message || "Processing…";
      } else if (job.status === "completed") {
        clearInterval(pollTimer);
        showResults(job);
      } else if (job.status === "failed") {
        clearInterval(pollTimer);
        showError(job.message || "Generation failed. Please try again.");
      }
    } catch (err) {
      clearInterval(pollTimer);
      showError("Lost connection to server.");
    }
  }, 2000);
}

/* ============================================
   Show Results
   ============================================ */
function showResults(job) {
  showSection("results");
  resultsSub.textContent = `Preset: ${job.presetId} · ${job.results.length} images generated`;
  resultsGrid.innerHTML = "";

  job.results.forEach((img) => {
    const card = document.createElement("div");
    card.className = "result-card";

    card.innerHTML = `
      ${img.isBest ? '<span class="result-badge">★ Best</span>' : ""}
      <img src="${img.url}" alt="Generated variant" loading="lazy" />
      <div class="result-overlay">
        <span class="result-score">Score: ${img.score}/100</span>
      </div>
      <div class="result-actions">
        <button class="btn-feedback btn-thumbs-up" data-url="${img.url}" title="Good result">👍</button>
        <button class="btn-feedback btn-thumbs-down" data-url="${img.url}" title="Bad result">👎</button>
        <button class="btn-download" title="Download" onclick="downloadImage('${img.url}')">↓</button>
      </div>
    `;

    // Click image to open full size
    card.querySelector("img").addEventListener("click", () => {
      window.open(img.url, "_blank");
    });

    // Feedback buttons
    card.querySelector(".btn-thumbs-up").addEventListener("click", (e) => {
      e.stopPropagation();
      sendFeedback(img.url, "up", e.currentTarget);
    });
    card.querySelector(".btn-thumbs-down").addEventListener("click", (e) => {
      e.stopPropagation();
      sendFeedback(img.url, "down", e.currentTarget);
    });

    resultsGrid.appendChild(card);
  });
}

/* ============================================
   Feedback
   ============================================ */
async function sendFeedback(imageUrl, rating, btn) {
  try {
    const res = await fetch(`${API}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: currentJobId, imageUrl, rating }),
    });
    if (res.ok) {
      // Visual confirmation
      const parent = btn.closest(".result-actions");
      parent.querySelectorAll(".btn-feedback").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
  } catch (err) {
    console.error("Feedback failed:", err);
  }
}

/* ============================================
   Download helper
   ============================================ */
function downloadImage(url) {
  const a = document.createElement("a");
  a.href = url;
  a.download = url.split("/").pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ============================================
   Section Visibility
   ============================================ */
function showSection(name) {
  uploadSection.classList.toggle("hidden", name !== "upload");
  progressSection.classList.toggle("hidden", name !== "progress");
  resultsSection.classList.toggle("hidden", name !== "results");
  errorSection.classList.toggle("hidden", name !== "error");
}

function showError(msg) {
  showSection("error");
  errorMessage.textContent = msg;
}

/* ============================================
   Reset
   ============================================ */
document.getElementById("btn-reset").addEventListener("click", resetUI);
document.getElementById("btn-error-reset").addEventListener("click", resetUI);

function resetUI() {
  showSection("upload");
  selectedFile = null;
  fileInput.value = "";
  previewImg.src = "";
  dropzone.classList.remove("has-image");
  categorySelect.value = "";
  styleSelect.value = "";
  modelSelect.value = "";
  modelField.style.display = "none";
  btnGenerate.disabled = true;
  progressBar.style.width = "0%";
  resultsGrid.innerHTML = "";
  if (pollTimer) clearInterval(pollTimer);
}

/* ============================================
   Boot
   ============================================ */
init();
