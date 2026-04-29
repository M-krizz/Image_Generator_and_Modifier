import { useState, useEffect, useCallback, useRef } from "react";

const STEPS = ["Upload", "Configure", "Review", "Generate", "Results"];

export default function App() {
  const [view, setView] = useState("form"); // form | review | progress | results | error
  const [options, setOptions] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [category, setCategory] = useState("");
  const [style, setStyle] = useState("");
  const [modelType, setModelType] = useState("");
  const [userConfig, setUserConfig] = useState({});
  const [outputConfig, setOutputConfig] = useState({});
  const [customInstructions, setCustomInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [results, setResults] = useState(null);
  const [jobMeta, setJobMeta] = useState(null);
  const [error, setError] = useState("");
  const [currentJobId, setCurrentJobId] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState({});
  const pollRef = useRef(null);
  const dropRef = useRef(null);

  // Load options on mount
  useEffect(() => {
    fetch("/api/options").then(r => r.json()).then(setOptions).catch(() => {});
  }, []);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const needsModel = options?.categories.find(c => c.value === category)?.requiresModel;
  const formValid = file && category && style && (!needsModel || modelType);
  const activeStep = view === "form" ? (file ? 1 : 0) : view === "review" ? 2 : view === "progress" ? 3 : 4;

  // ── File handling ──
  const handleFile = useCallback((f) => {
    if (!f) return;
    const ok = ["image/jpeg", "image/png", "image/webp"];
    if (!ok.includes(f.type)) return alert("Upload JPEG, PNG, or WebP only.");
    if (f.size > 10 * 1024 * 1024) return alert("Max file size is 10 MB.");
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("image", file);
    formData.append("category", category);
    formData.append("style", style);
    if (modelType) formData.append("modelType", modelType);
    if (Object.keys(userConfig).length > 0) {
      formData.append("userConfig", JSON.stringify(userConfig));
    }
    if (Object.keys(outputConfig).length > 0) {
      formData.append("outputConfig", JSON.stringify(outputConfig));
    }
    if (customInstructions.trim()) {
      formData.append("customInstructions", customInstructions.trim());
    }

    setView("progress");
    setProgress(10);
    setProgressMsg("Preparing photoshoot...");

    try {
      const res = await fetch("/api/draft", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setDraftId(data.draftId);
      setDraftPrompt(data.prompt);
      setView("review");
    } catch (err) {
      setError(err.message);
      setView("error");
    }
  };

  const handleRefine = async () => {
    setIsRefining(true);
    try {
      const res = await fetch("/api/refine-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, prompt: draftPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraftPrompt(data.prompt);
    } catch (err) {
      alert("Failed to refine prompt: " + err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerate = async () => {
    setView("progress");
    setProgress(5);
    setProgressMsg("Generating images...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, finalPrompt: draftPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setCurrentJobId(data.jobId);
      pollRef.current = setInterval(() => pollJob(data.jobId), 2000);
    } catch (err) {
      setError(err.message);
      setView("error");
    }
  };

  const pollJob = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const job = await res.json();
      if (job.status === "processing") {
        setProgress(Math.max(job.progress, 10));
        setProgressMsg(job.message || "Processing…");
      } else if (job.status === "completed") {
        clearInterval(pollRef.current);
        setResults(job.results);
        setJobMeta(job);
        setView("results");
      } else if (job.status === "failed") {
        clearInterval(pollRef.current);
        setError(job.message || "Generation failed.");
        setView("error");
      }
    } catch {
      clearInterval(pollRef.current);
      setError("Lost connection to server.");
      setView("error");
    }
  };

  // ── Feedback ──
  const sendFeedback = async (url, rating) => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJobId, imageUrl: url, rating }),
      });
      setFeedbackSent(prev => ({ ...prev, [url]: rating }));
    } catch {}
  };

  // ── Reset ──
  const reset = () => {
    setView("form");
    setFile(null);
    setPreview(null);
    setCategory("");
    setStyle("");
    setModelType("");
    setUserConfig({});
    setOutputConfig({});
    setCustomInstructions("");
    setDraftId(null);
    setDraftPrompt("");
    setResults(null);
    setJobMeta(null);
    setError("");
    setProgress(0);
    setFeedbackSent({});
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (!options) return <div className="loader-screen"><div className="spinner" /><p>Loading…</p></div>;

  return (
    <div className="app">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* Header */}
      <header className="header">
        <div className="brand">
          <span className="brand-icon">✦</span>
          <h1 className="brand-name">ProductViz</h1>
        </div>
        <p className="brand-sub">AI-Powered Product Visualization Engine</p>
      </header>

      {/* Steps */}
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i <= activeStep ? "active" : ""} ${i < activeStep ? "done" : ""}`}>
            <div className="step-dot">{i < activeStep ? "✓" : i + 1}</div>
            <span className="step-label">{s}</span>
          </div>
        ))}
      </div>

      <main className="main">
        {/* ── FORM VIEW ── */}
        {view === "form" && (
          <form className="card card-form" onSubmit={handleSubmit}>
            <h2 className="card-title">Upload &amp; Configure</h2>

            <div
              ref={dropRef}
              className={`dropzone ${preview ? "has-preview" : ""}`}
              onClick={() => document.getElementById("file-input").click()}
              onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add("drag-over"); }}
              onDragLeave={() => dropRef.current?.classList.remove("drag-over")}
              onDrop={handleDrop}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="dropzone-preview" />
              ) : (
                <div className="dropzone-placeholder">
                  <span className="dropzone-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </span>
                  <p className="dropzone-text">Drop your product image here</p>
                  <p className="dropzone-hint">or click to browse · JPEG, PNG, WebP · Max 10 MB</p>
                </div>
              )}
              <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Product Category</span>
                <select value={category} onChange={e => { 
                  setCategory(e.target.value); 
                  setModelType(""); 
                  setUserConfig({}); 
                  // outputConfig remains unchanged as it's global
                }} required>
                  <option value="" disabled>Select category…</option>
                  {options.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Visual Style</span>
                <select value={style} onChange={e => setStyle(e.target.value)} required>
                  <option value="" disabled>Select style…</option>
                  {options.styles.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>

              {needsModel && (
                <label className="field field-full">
                  <span className="field-label">Model Type</span>
                  <select value={modelType} onChange={e => setModelType(e.target.value)} required>
                    <option value="" disabled>Select model…</option>
                    {options.modelTypes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            {/* Dynamic UI Options - Core */}
            {(category && options.uiOptions.categories[category]?.core) && (
              <>
                <div className="section-divider">
                  <span>Category Settings</span>
                </div>
                <div className="form-grid">
                  {Object.entries(options.uiOptions.categories[category].core).map(([key, vals]) => (
                    <label key={key} className="field">
                      <span className="field-label" style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                      <select 
                        value={userConfig[key] || ""} 
                        onChange={e => setUserConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">Default (from Preset)</option>
                        {vals.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Output Configuration - Core */}
            {category && options.uiOptions.output?.core && (
              <>
                <div className="section-divider">
                  <span>Output Configuration</span>
                </div>
                <div className="form-grid">
                  {Object.entries(options.uiOptions.output.core).map(([key, vals]) => (
                    <label key={key} className="field">
                      <span className="field-label" style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                      <select 
                        value={outputConfig[key] || ""} 
                        onChange={e => setOutputConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">Default</option>
                        {vals.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Advanced Settings Toggle */}
            {category && (
              <div className="advanced-toggle-wrapper">
                <button 
                  type="button" 
                  className="btn-advanced-toggle" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <svg 
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", transition: "0.3s" }}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                  {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                </button>
              </div>
            )}

            {/* Advanced Settings Area */}
            {category && showAdvanced && (
              <div className="advanced-settings-area">
                {/* Category Advanced */}
                {options.uiOptions.categories[category]?.advanced && (
                  <>
                    <div className="section-divider">
                      <span>Advanced Category Settings</span>
                    </div>
                    <div className="form-grid">
                      {Object.entries(options.uiOptions.categories[category].advanced).map(([key, vals]) => (
                        <label key={key} className="field">
                          <span className="field-label" style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <select 
                            value={userConfig[key] || ""} 
                            onChange={e => setUserConfig(prev => ({ ...prev, [key]: e.target.value }))}
                          >
                            <option value="">Default</option>
                            {vals.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {/* Output Configuration - Advanced */}
                {options.uiOptions.output?.advanced && (
                  <>
                    <div className="section-divider">
                      <span>Advanced Output Controls</span>
                    </div>
                    <div className="form-grid">
                      {Object.entries(options.uiOptions.output.advanced).map(([key, vals]) => (
                        <label key={key} className="field">
                          <span className="field-label" style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <select 
                            value={outputConfig[key] || ""} 
                            onChange={e => setOutputConfig(prev => ({ ...prev, [key]: e.target.value }))}
                          >
                            <option value="">Default</option>
                            {vals.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {/* Global Options */}
                <div className="section-divider">
                  <span>Global Overrides</span>
                </div>
                <div className="form-grid">
                  {Object.entries(options.uiOptions.global).map(([key, vals]) => (
                    <label key={key} className="field">
                      <span className="field-label" style={{ textTransform: "capitalize" }}>{key}</span>
                      <select 
                        value={userConfig[key] || ""} 
                        onChange={e => setUserConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">Default</option>
                        {vals.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="section-divider">
              <span>Additional Custom Details (Optional)</span>
            </div>
            <label className="field field-full">
              <span className="field-label" style={{ fontWeight: "normal", color: "var(--text-3)", fontSize: "13px" }}>
                Want something specific? Describe any custom lighting, props, or background details here.
              </span>
              <textarea 
                className="prompt-textarea"
                style={{ minHeight: "80px", padding: "12px", marginTop: "8px" }}
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="e.g. Add a subtle reflection on the table surface..."
              />
            </label>

            <button type="submit" className="btn-primary" disabled={!formValid}>
              <span>Draft Prompt</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </form>
        )}

        {/* ── REVIEW VIEW ── */}
        {view === "review" && (
          <div className="card card-review">
            <h2 className="card-title">Review &amp; Enhance Prompt</h2>
            <p className="card-subtitle">
              You can manually edit the generated prompt below, or use our AI to enhance the photography details.
            </p>
            
            <textarea 
              className="prompt-textarea"
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              rows={12}
            />

            <div className="review-actions">
              <button 
                className="btn-secondary btn-enhance" 
                onClick={handleRefine}
                disabled={isRefining}
              >
                {isRefining ? <span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> : "✨"} 
                {isRefining ? "Enhancing..." : "Enhance with AI"}
              </button>
              
              <button className="btn-primary" onClick={handleGenerate}>
                <span>Generate Images</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
            <button className="btn-back" onClick={() => setView("form")}>← Back to Configuration</button>
          </div>
        )}

        {/* ── PROGRESS VIEW ── */}
        {view === "progress" && (
          <div className="card card-progress">
            <div className="progress-visual">
              <div className="spinner large" />
              <h2 className="progress-title">Creating Your Images</h2>
              <p className="progress-msg">{progressMsg}</p>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-pct">{progress}%</p>
          </div>
        )}

        {/* ── RESULTS VIEW ── */}
        {view === "results" && results && (
          <div className="card card-results">
            <div className="results-header">
              <h2 className="card-title">Your Generated Images</h2>
              <p className="results-meta">
                {results.length} variants · Preset: <code>{jobMeta?.presetId}</code>
              </p>
            </div>

            <div className="results-grid">
              {results.map((img, i) => (
                <div key={i} className="result-card">
                  {img.isBest && <span className="badge-best">★ Best Pick</span>}
                  <img src={img.url} alt={`Variant ${i + 1}`} className="result-img" onClick={() => window.open(img.url, "_blank")} />
                  <div className="result-footer">
                    <span className="result-score">Quality: {img.score}/100</span>
                    <div className="result-actions">
                      <button
                        className={`btn-icon ${feedbackSent[img.url] === "up" ? "active-up" : ""}`}
                        onClick={() => sendFeedback(img.url, "up")}
                        title="Good result"
                      >👍</button>
                      <button
                        className={`btn-icon ${feedbackSent[img.url] === "down" ? "active-down" : ""}`}
                        onClick={() => sendFeedback(img.url, "down")}
                        title="Bad result"
                      >👎</button>
                      <a href={img.url} download className="btn-icon" title="Download">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-secondary" onClick={reset}>← Generate Another</button>
          </div>
        )}

        {/* ── ERROR VIEW ── */}
        {view === "error" && (
          <div className="card card-error">
            <div className="error-icon">⚠️</div>
            <h2>Generation Failed</h2>
            <p className="error-msg">{error}</p>
            <button className="btn-secondary" onClick={reset}>← Try Again</button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Powered by AI · No prompts, pure presets · Built for product excellence</p>
      </footer>
    </div>
  );
}
