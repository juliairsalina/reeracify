// ============================================================
// Backend API base URL
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000";
const PARSER_API_BASE_URL = "http://127.0.0.1:3000";

// ============================================================
// DOM elements
// ============================================================

const landing = document.getElementById("landing");
const dashboard = document.getElementById("dashboard");
const bottomMetrics = document.getElementById("bottomMetrics");

const resumeUpload = document.getElementById("resumeUpload");
const demoBtn = document.getElementById("demoBtn");

const evaluateFileBtn = document.getElementById("evaluateFileBtn");
const reevaluateFileBtn = document.getElementById("reevaluateFileBtn");
const reevaluateBtn = document.getElementById("reevaluateBtn");
const saveResumeBtn = document.getElementById("saveResumeBtn");

const categorySelect = document.getElementById("categorySelect");
const roleSelect = document.getElementById("roleSelect");
const levelSelect = document.getElementById("levelSelect");

const editorContent = document.getElementById("editorContent");
const previewPaper = document.getElementById("previewPaper");

const atsScore = document.getElementById("atsScore");
const atsStatusText = document.getElementById("atsStatusText");

const rankScore = document.getElementById("rankScore");
const rankBar = document.getElementById("rankBar");
const competitivenessText = document.getElementById("competitivenessText");

const keywordsBox = document.getElementById("keywords");
const missingKeywordsBox = document.getElementById("missingKeywords");

const suggestionsBox = document.getElementById("suggestions");
const suggestionCount = document.getElementById("suggestionCount");
const evaluationReasoning = document.getElementById("evaluationReasoning");

const keywordPercent = document.getElementById("keywordPercent");
const formatPercent = document.getElementById("formatPercent");
const completePercent = document.getElementById("completePercent");

const keywordBar = document.getElementById("keywordBar");
const formatBar = document.getElementById("formatBar");
const completeBar = document.getElementById("completeBar");

const summaryScore = document.getElementById("summaryScore");
const keywordScore = document.getElementById("keywordScore");
const impactScore = document.getElementById("impactScore");
const lengthScore = document.getElementById("lengthScore");

// Rewrite modal
const rewriteModal = document.getElementById("rewriteModal");
const selectedBulletIdInput = document.getElementById("selectedBulletId");
const selectedBulletText = document.getElementById("selectedBulletText");
const rewriteSuggestionsBox = document.getElementById("rewriteSuggestions");
const acceptRewriteBtn = document.getElementById("acceptRewriteBtn");
const ignoreRewriteBtn = document.getElementById("ignoreRewriteBtn");
const closeRewriteModalBtn = document.getElementById("closeRewriteModalBtn");

// Preview controls
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomText = document.getElementById("zoomText");
const downloadBtn = document.getElementById("downloadBtn");

// ============================================================
// Frontend state
// ============================================================

let latestEvaluationData = null;
let latestRuleBasedSignals = null;
let latestEvaluationAgentResult = null;

let selectedBullet = {
  id: "",
  text: "",
};

let selectedRewriteSuggestion = "";

// ============================================================
// Role / level data
// ============================================================

const jobData = {
  "Data / Software": {
    "Data Analyst": ["Entry-level", "Experienced"],
    "Backend Developer": ["Entry-level", "Experienced"]
  },
  "Marketing": {
    "Marketing Associate": ["Entry-level", "Experienced"],
    "Digital Marketing Specialist": ["Entry-level", "Experienced"]
  },
  "IT": {
    "IT Support Specialist": ["Entry-level", "Experienced"],
    "System Administrator": ["Entry-level", "Experienced"]
  },
  "Admin / Operations": {
    "Administrative Assistant": ["Entry-level", "Experienced"],
    "Operations Coordinator": ["Entry-level", "Experienced"],
    "Human Resources Assistant": ["Entry-level", "Experienced"],
    "Project Coordinator": ["Entry-level", "Experienced"],
    "Customer Success Associate": ["Entry-level", "Experienced"]
  }
};

// ============================================================
// Basic helpers
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(message) {
  console.error(message);
  alert(message);
}

function safeSetText(element, value) {
  if (element) element.textContent = value;
}

function safeSetHtml(element, value) {
  if (element) element.innerHTML = value;
}

function safeSetWidth(element, value) {
  if (element) element.style.width = value;
}

function showDashboard() {
  if (landing) landing.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");
  if (bottomMetrics) bottomMetrics.classList.remove("hidden");
}

function updatePreview() {
  if (!previewPaper || !editorContent) return;
  previewPaper.innerHTML = editorContent.innerHTML;
}

function setGauge(score) {
  const progress = document.querySelector(".semi-progress");
  if (!progress) return;

  const safeScore = Math.max(0, Math.min(Number(score) || 0, 100));
  progress.style.clipPath = `inset(0 ${100 - safeScore}% 0 0)`;
}

function getSelectedTargetRole() {
  return (
    roleSelect?.value ||
    latestRuleBasedSignals?.rubric_used?.target_role ||
    "Data Analyst"
  );
}

function getSelectedTargetLevel() {
  return (
    levelSelect?.value ||
    latestRuleBasedSignals?.rubric_used?.target_level ||
    "Entry-level"
  );
}

// ============================================================
// Dropdown setup
// ============================================================

function loadRoles() {
  if (!categorySelect || !roleSelect || !levelSelect) return;

  roleSelect.innerHTML = '<option value="">Select Role</option>';
  levelSelect.innerHTML = '<option value="">Select Level</option>';

  const roles = jobData[categorySelect.value];
  if (!roles) return;

  Object.keys(roles).forEach(role => {
    roleSelect.innerHTML += `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`;
  });
}

function loadLevels() {
  if (!categorySelect || !roleSelect || !levelSelect) return;

  levelSelect.innerHTML = '<option value="">Select Level</option>';

  const levels = jobData[categorySelect.value]?.[roleSelect.value];
  if (!levels) return;

  levels.forEach(level => {
    levelSelect.innerHTML += `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`;
  });
}

// ============================================================
// Loading state
// ============================================================

function setLoadingState(message = "Analyzing resume...") {
  showDashboard();

  safeSetText(atsScore, "Loading...");
  safeSetText(atsStatusText, message);

  safeSetText(rankScore, "Loading...");
  safeSetText(competitivenessText, "Waiting for backend result...");
  safeSetWidth(rankBar, "0%");

  safeSetText(keywordPercent, "0%");
  safeSetText(formatPercent, "0%");
  safeSetText(completePercent, "0%");

  safeSetWidth(keywordBar, "0%");
  safeSetWidth(formatBar, "0%");
  safeSetWidth(completeBar, "0%");

  safeSetHtml(keywordsBox, "");
  safeSetHtml(missingKeywordsBox, "");

  safeSetHtml(evaluationReasoning, "<p>Analyzing resume...</p>");
  safeSetHtml(suggestionsBox, "<p>Analyzing resume...</p>");
  safeSetText(suggestionCount, "0");

  safeSetHtml(editorContent, '<p class="empty-state">Loading resume content...</p>');
  safeSetHtml(previewPaper, '<p class="empty-state">Generating preview...</p>');

  safeSetText(summaryScore, "0");
  safeSetText(keywordScore, "0");
  safeSetText(impactScore, "0");
  safeSetText(lengthScore, "0");
}

// ============================================================
// Backend call helper
// ============================================================

async function callBackend(path, options = {}) {
  const fetchOptions = {
    method: options.method || "GET",
    ...options
  };

  if (options.body) {
    fetchOptions.headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
  }

  const response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

  if (!response.ok) {
    let detail = "";

    try {
      const errorBody = await response.json();
      detail = errorBody.detail ? `: ${errorBody.detail}` : "";
    } catch {
      detail = "";
    }

    throw new Error(`Backend error ${response.status}${detail}`);
  }

  return response.json();
}

// ============================================================
// Backend endpoint functions
// ============================================================

async function evaluateFromFinalJson() {
  setLoadingState("Reading sample/final.json...");

  const data = await callBackend("/evaluate-file", {
    method: "POST"
  });

  renderBackendData(data);
}

async function reevaluateFromFinalJson() {
  setLoadingState("Reevaluating sample/final.json...");

  const data = await callBackend("/reevaluate-file", {
    method: "POST"
  });

  renderBackendData(data);
}

async function requestRewriteForBullet(bulletId, bulletText) {
  if (!latestRuleBasedSignals || !latestEvaluationAgentResult) {
    showError("Please evaluate the resume first.");
    return;
  }

  selectedBullet = {
    id: bulletId,
    text: bulletText,
  };

  selectedRewriteSuggestion = "";

  if (selectedBulletIdInput) selectedBulletIdInput.value = bulletId;
  safeSetText(selectedBulletText, bulletText);
  safeSetHtml(rewriteSuggestionsBox, "<p>Generating rewrite suggestions...</p>");
  if (acceptRewriteBtn) acceptRewriteBtn.disabled = true;

  openRewriteModal();

  const payload = {
    target_role: getSelectedTargetRole(),
    target_level: getSelectedTargetLevel(),
    selected_bullet: bulletText,
    rule_based_signals: latestRuleBasedSignals,
    evaluation_agent_result: latestEvaluationAgentResult,
    user_instruction: "Make it stronger, clearer, and ATS-friendly. Do not invent fake numbers, tools, or achievements."
  };

  try {
    const data = await callBackend("/rewrite", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    renderRewriteSuggestions(data);
  } catch (error) {
    safeSetHtml(
      rewriteSuggestionsBox,
      `<p class="status-message error">${escapeHtml(error.message)}</p>`
    );
  }
}

async function acceptRewrite() {
  if (!selectedBullet.id) {
    showError("No bullet selected.");
    return;
  }

  if (!selectedRewriteSuggestion) {
    showError("Please select one rewrite suggestion first.");
    return;
  }

  if (acceptRewriteBtn) acceptRewriteBtn.disabled = true;

  const payload = {
    bullet_id: selectedBullet.id,
    accepted_bullet: selectedRewriteSuggestion
  };

  try {
    const data = await callBackend("/accept-rewrite", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeRewriteModal();

    if (data.reevaluation_result) {
      renderBackendData(data.reevaluation_result);
    } else {
      await reevaluateFromFinalJson();
    }
  } catch (error) {
    if (acceptRewriteBtn) acceptRewriteBtn.disabled = false;
    showError(error.message);
  }
}

async function ignoreRewrite() {
  try {
    await callBackend("/ignore-rewrite", {
      method: "POST"
    });
  } catch (error) {
    console.warn(error);
  }

  closeRewriteModal();
}

// ============================================================
// Preprocessing placeholder
// ============================================================

async function runPreprocessingPlaceholder(file) {
  const formData = new FormData();

  formData.append("resume", file);
  formData.append("target_role", roleSelect.value || "Data Analyst");
  formData.append("target_level", levelSelect.value || "Entry-level");

  const response = await fetch(`${PARSER_API_BASE_URL}/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let message = `Preprocessing failed with status ${response.status}`;

    try {
      const errorBody = await response.json();
      message = errorBody.detail || errorBody.error || message;
    } catch {
      // keep default message
    }

    throw new Error(message);
  }

  return response.json();
}

// ============================================================
// Render backend result
// ============================================================

function renderBackendData(data) {
  latestEvaluationData = data;
  latestRuleBasedSignals = data.rule_based_signals || {};
  latestEvaluationAgentResult = data.evaluation_agent_result || {};

  const score = Number(data.ats_score ?? latestRuleBasedSignals.ats_score ?? 0);

  safeSetText(atsScore, `${score}%`);
  safeSetText(
    atsStatusText,
    score >= 80 ? "Excellent" :
    score >= 60 ? "Competitive" :
    "Needs work"
  );

  setGauge(score);

  renderCompetitiveness(score, latestEvaluationAgentResult);
  renderKeywordCards(latestRuleBasedSignals);
  renderBreakdownScores(score, latestRuleBasedSignals);
  renderSuggestions(latestRuleBasedSignals, latestEvaluationAgentResult);
  renderResumeEditor(latestRuleBasedSignals, latestEvaluationAgentResult);
  updatePreview();
}

function renderCompetitiveness(score, evaluation) {
  const category = evaluation?.competitiveness_category || "중";

  let numericRank = score;

  if (category === "상") numericRank = Math.max(score, 85);
  if (category === "중") numericRank = Math.max(score, 60);
  if (category === "하") numericRank = Math.min(score, 55);

  safeSetText(rankScore, `${numericRank}/100`);
  safeSetWidth(rankBar, `${Math.max(0, Math.min(numericRank, 100))}%`);

  const label =
    category === "상" ? "Strong" :
    category === "중" ? "Competitive" :
    "Needs improvement";

  safeSetText(competitivenessText, `${label} (${category})`);
}

function renderKeywordCards(ruleSignals) {
  const keywordResult = ruleSignals.keyword_result || {};
  const presentKeywords = keywordResult.present_keywords || [];
  const missingKeywords = keywordResult.missing_keywords || [];

  if (keywordsBox) keywordsBox.innerHTML = "";
  if (missingKeywordsBox) missingKeywordsBox.innerHTML = "";

  if (keywordsBox) {
    if (presentKeywords.length === 0) {
      keywordsBox.innerHTML = "<span>No keywords found</span>";
    } else {
      presentKeywords.forEach(keyword => {
        keywordsBox.innerHTML += `<span>${escapeHtml(keyword)}</span>`;
      });
    }
  }

  if (missingKeywordsBox) {
    if (missingKeywords.length === 0) {
      missingKeywordsBox.innerHTML = "<span>None</span>";
    } else {
      missingKeywords.forEach(keyword => {
        missingKeywordsBox.innerHTML += `<span>${escapeHtml(keyword)}</span>`;
      });
    }
  }
}

function renderBreakdownScores(score, ruleSignals) {
  const keywordResult = ruleSignals.keyword_result || {};
  const presentKeywords = keywordResult.present_keywords || [];
  const missingKeywords = keywordResult.missing_keywords || [];

  const totalKeywords = presentKeywords.length + missingKeywords.length;

  const keywordScoreValue = totalKeywords > 0
    ? Math.round((presentKeywords.length / totalKeywords) * 100)
    : 0;

  const sectionPresence = ruleSignals.section_presence || {};
  const sectionValues = Object.values(sectionPresence);

  const completeScoreValue = sectionValues.length > 0
    ? Math.round((sectionValues.filter(Boolean).length / sectionValues.length) * 100)
    : score;

  const weakCount = (ruleSignals.weak_phrase_flags || []).length;
  const grammarCount = (ruleSignals.grammar_flags || []).length;

  const formatScoreValue = Math.max(0, 100 - weakCount * 10 - grammarCount * 8);

  safeSetText(keywordPercent, `${keywordScoreValue}%`);
  safeSetText(formatPercent, `${formatScoreValue}%`);
  safeSetText(completePercent, `${completeScoreValue}%`);

  safeSetWidth(keywordBar, `${keywordScoreValue}%`);
  safeSetWidth(formatBar, `${formatScoreValue}%`);
  safeSetWidth(completeBar, `${completeScoreValue}%`);

  safeSetText(summaryScore, completeScoreValue);
  safeSetText(keywordScore, keywordScoreValue);
  safeSetText(impactScore, calculateImpactScore(ruleSignals));
  safeSetText(lengthScore, Math.min(100, score));
}

function calculateImpactScore(ruleSignals) {
  const measurable = ruleSignals.measurable_evidence || {};
  const total = measurable.total_bullet_count || 0;
  const metricCount = measurable.metric_bullet_count || 0;

  if (total === 0) return 0;

  return Math.round((metricCount / total) * 100);
}

function renderSuggestions(ruleSignals, evaluation) {
  const suggestions = [];

  const keywordResult = ruleSignals.keyword_result || {};
  const missingKeywords = keywordResult.missing_keywords || [];

  missingKeywords.forEach(keyword => {
    suggestions.push(`Missing keyword: ${keyword}`);
  });

  (ruleSignals.weak_phrase_flags || []).forEach(item => {
    suggestions.push(item.reason || `Weak phrase found: ${item.text}`);
  });

  (ruleSignals.grammar_flags || []).forEach(item => {
    if (item.text) {
      suggestions.push(`Grammar/spelling issue: ${item.text}`);
    }
  });

  (evaluation.weak_bullets || []).forEach(item => {
    suggestions.push(item.reason || `Weak bullet: ${item.text}`);
  });

  (evaluation.improvement_priorities || []).forEach(priority => {
    suggestions.push(priority);
  });

  safeSetHtml(
    evaluationReasoning,
    evaluation.reasoning
      ? `<p>${escapeHtml(evaluation.reasoning)}</p>`
      : "<p>No evaluation reasoning returned.</p>"
  );

  if (suggestionsBox) suggestionsBox.innerHTML = "";
  safeSetText(suggestionCount, suggestions.length);

  if (!suggestionsBox) return;

  if (suggestions.length === 0) {
    suggestionsBox.innerHTML = "<p>No major issues found.</p>";
    return;
  }

  suggestions.forEach(item => {
    suggestionsBox.innerHTML += `<p>⚠ ${escapeHtml(item)}</p>`;
  });
}

// ============================================================
// Render resume bullets
// ============================================================

function renderResumeEditor(ruleSignals, evaluation) {
  const allBullets = ruleSignals.all_bullets || [];
  const weakBulletIds = new Set();

  (ruleSignals.weak_phrase_flags || []).forEach(item => {
    if (item.id) weakBulletIds.add(item.id);
  });

  (ruleSignals.grammar_flags || []).forEach(item => {
    if (item.id) weakBulletIds.add(item.id);
  });

  (evaluation.weak_bullets || []).forEach(item => {
    if (item.id) weakBulletIds.add(item.id);
  });

  if (!editorContent) return;

  if (allBullets.length === 0) {
    editorContent.innerHTML = '<p class="empty-state">No bullets found in final.json.</p>';
    return;
  }

  const experienceBullets = allBullets.filter(item => item.section === "experience");
  const projectBullets = allBullets.filter(item => item.section === "projects");
  const otherBullets = allBullets.filter(
    item => item.section !== "experience" && item.section !== "projects"
  );

  let html = "";

  if (experienceBullets.length > 0) {
    html += `<div class="resume-section"><h2>Experience</h2>`;
    experienceBullets.forEach(bullet => {
      html += renderBulletHtml(bullet, weakBulletIds);
    });
    html += `</div>`;
  }

  if (projectBullets.length > 0) {
    html += `<div class="resume-section"><h2>Projects</h2>`;
    projectBullets.forEach(bullet => {
      html += renderBulletHtml(bullet, weakBulletIds);
    });
    html += `</div>`;
  }

  if (otherBullets.length > 0) {
    html += `<div class="resume-section"><h2>Other</h2>`;
    otherBullets.forEach(bullet => {
      html += renderBulletHtml(bullet, weakBulletIds);
    });
    html += `</div>`;
  }

  editorContent.innerHTML = html;

  document.querySelectorAll(".resume-bullet").forEach(element => {
    element.addEventListener("click", () => {
      const bulletId = element.dataset.bulletId;
      const bulletText = element.dataset.bulletText;

      requestRewriteForBullet(bulletId, bulletText);
    });
  });
}

function renderBulletHtml(bullet, weakBulletIds) {
  const isWeak = weakBulletIds.has(bullet.id);
  const className = isWeak ? "resume-bullet weak highlight" : "resume-bullet";

  return `
    <p>
      <span
        class="${className}"
        data-bullet-id="${escapeHtml(bullet.id)}"
        data-bullet-text="${escapeHtml(bullet.text)}"
        title="Click to rewrite this bullet"
      >
        ${escapeHtml(bullet.text)}
      </span>
    </p>
  `;
}

// ============================================================
// Rewrite modal
// ============================================================

function openRewriteModal() {
  if (!rewriteModal) return;
  rewriteModal.style.display = "flex";
  rewriteModal.classList.remove("hidden");
}

function closeRewriteModal() {
  if (!rewriteModal) return;

  rewriteModal.style.display = "none";
  rewriteModal.classList.add("hidden");

  selectedBullet = {
    id: "",
    text: "",
  };

  selectedRewriteSuggestion = "";

  if (selectedBulletIdInput) selectedBulletIdInput.value = "";
  safeSetText(selectedBulletText, "No bullet selected.");
  safeSetHtml(rewriteSuggestionsBox, "<p>No rewrite suggestions yet.</p>");
  if (acceptRewriteBtn) acceptRewriteBtn.disabled = true;
}

function renderRewriteSuggestions(data) {
  const suggestions = data.rewrite_suggestions || [];

  if (!rewriteSuggestionsBox) return;

  rewriteSuggestionsBox.innerHTML = "";
  selectedRewriteSuggestion = "";
  if (acceptRewriteBtn) acceptRewriteBtn.disabled = true;

  if (suggestions.length === 0) {
    rewriteSuggestionsBox.innerHTML = "<p>No rewrite suggestions returned.</p>";
    return;
  }

  suggestions.forEach((item, index) => {
    const suggestion = item.suggestion || "";
    const why = item.why_it_is_better || "";
    const caution = item.caution || "";
    const usedSignals = item.used_signals || [];

    const card = document.createElement("div");
    card.className = "rewrite-suggestion";
    card.dataset.suggestion = suggestion;

    card.innerHTML = `
      <h4>Suggestion ${index + 1}</h4>
      <p><strong>${escapeHtml(suggestion)}</strong></p>
      <p>${escapeHtml(why)}</p>
      ${
        usedSignals.length > 0
          ? `<p><small>Used signals: ${escapeHtml(usedSignals.join(", "))}</small></p>`
          : ""
      }
      ${
        caution
          ? `<p class="caution">${escapeHtml(caution)}</p>`
          : ""
      }
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".rewrite-suggestion").forEach(el => {
        el.classList.remove("selected");
      });

      card.classList.add("selected");
      selectedRewriteSuggestion = suggestion;
      if (acceptRewriteBtn) acceptRewriteBtn.disabled = false;
    });

    rewriteSuggestionsBox.appendChild(card);
  });
}

// ============================================================
// Manual save placeholder
// ============================================================

function saveManualEdits() {
  alert(
    "Manual save is not fully connected yet. " +
    "For now, use rewrite suggestions and Accept Suggestion to save into sample/final.json."
  );
}

// ============================================================
// Preview controls: zoom in, zoom out, download/print
// ============================================================

function updateZoomText(currentZoom) {
  if (zoomText) {
    zoomText.textContent = Math.round(48 * currentZoom) + "%";
  }
}

if (zoomInBtn && previewPaper) {
  zoomInBtn.addEventListener("click", function () {
    let currentZoom = Number(previewPaper.dataset.zoom || 1);
    currentZoom += 0.1;

    previewPaper.dataset.zoom = currentZoom;
    previewPaper.style.transform = `scale(${currentZoom})`;
    previewPaper.style.transformOrigin = "top center";

    updateZoomText(currentZoom);
  });
}

if (zoomOutBtn && previewPaper) {
  zoomOutBtn.addEventListener("click", function () {
    let currentZoom = Number(previewPaper.dataset.zoom || 1);
    currentZoom -= 0.1;

    if (currentZoom < 0.6) currentZoom = 0.6;

    previewPaper.dataset.zoom = currentZoom;
    previewPaper.style.transform = `scale(${currentZoom})`;
    previewPaper.style.transformOrigin = "top center";

    updateZoomText(currentZoom);
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", function () {
    window.print();
  });
}

// ============================================================
// Event listeners
// ============================================================

if (resumeUpload) {
  resumeUpload.addEventListener("change", async function () {
    const file = resumeUpload.files[0];
    if (!file) return;

    if (!roleSelect?.value || !levelSelect?.value) {
      alert("Please select role and level first.");
      resumeUpload.value = "";
      return;
    }

    try {
      setLoadingState("Preprocessing uploaded resume...");

      // 1. Send uploaded resume to parser server.
      // Parser server should extract text, build final.json,
      // and save it to sample/final.json.
      await runPreprocessingPlaceholder(file);

      setLoadingState("Evaluating parsed resume...");

      // 2. After final.json is created, FastAPI reads it and evaluates.
      await evaluateFromFinalJson();

      // 3. Clear file input so user can upload the same file again if needed.
      resumeUpload.value = "";

    } catch (error) {
      showError(
        "Cannot process uploaded resume.\n\n" +
        error.message +
        "\n\nMake sure all servers are running:\n" +
        "1. Parser server: http://127.0.0.1:3000\n" +
        "2. FastAPI backend: http://127.0.0.1:8000"
      );

      resumeUpload.value = "";
    }
  });
}

if (evaluateFileBtn) {
  evaluateFileBtn.addEventListener("click", async function () {
    try {
      await evaluateFromFinalJson();
    } catch (error) {
      showError(error.message);
    }
  });
}

if (reevaluateFileBtn) {
  reevaluateFileBtn.addEventListener("click", async function () {
    try {
      await reevaluateFromFinalJson();
    } catch (error) {
      showError(error.message);
    }
  });
}

if (reevaluateBtn) {
  reevaluateBtn.addEventListener("click", async function () {
    try {
      await reevaluateFromFinalJson();
    } catch (error) {
      showError(
        "Cannot re-evaluate. Make sure FastAPI is running on " +
        API_BASE_URL +
        "\n\n" +
        error.message
      );
    }
  });
}

if (saveResumeBtn) {
  saveResumeBtn.addEventListener("click", saveManualEdits);
}

if (acceptRewriteBtn) {
  acceptRewriteBtn.addEventListener("click", acceptRewrite);
}

if (ignoreRewriteBtn) {
  ignoreRewriteBtn.addEventListener("click", ignoreRewrite);
}

if (closeRewriteModalBtn) {
  closeRewriteModalBtn.addEventListener("click", closeRewriteModal);
}

if (rewriteModal) {
  rewriteModal.addEventListener("click", function (event) {
    if (event.target === rewriteModal) {
      closeRewriteModal();
    }
  });
}

if (categorySelect) {
  categorySelect.addEventListener("change", loadRoles);
}

if (roleSelect) {
  roleSelect.addEventListener("change", loadLevels);
}

if (demoBtn) {
  demoBtn.addEventListener("click", async function () {
    try {
      await evaluateFromFinalJson();
    } catch (error) {
      showError(
        "Demo mode currently uses backend sample/final.json.\n\n" +
        error.message
      );
    }
  });
}

// ============================================================
// Initialize page
// ============================================================

function initPage() {
  loadRoles();

  if (rewriteModal) {
    rewriteModal.style.display = "none";
    rewriteModal.classList.add("hidden");
  }

  if (dashboard) {
    dashboard.classList.add("hidden");
  }

  if (bottomMetrics) {
    bottomMetrics.classList.add("hidden");
  }

  if (previewPaper) {
    previewPaper.dataset.zoom = previewPaper.dataset.zoom || 1;
  }

  updateZoomText(Number(previewPaper?.dataset.zoom || 1));
}

initPage();