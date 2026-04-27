// ============================================================
// Backend API base URL
// FastAPI backend should run with:
// uvicorn app.main:app --reload
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000";


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
// Keep this aligned with backend role_level_rubrics.csv
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

  atsScore.textContent = "Loading...";
  atsStatusText.textContent = message;

  rankScore.textContent = "Loading...";
  competitivenessText.textContent = "Waiting for backend result...";
  rankBar.style.width = "0%";

  keywordPercent.textContent = "0%";
  formatPercent.textContent = "0%";
  completePercent.textContent = "0%";

  keywordBar.style.width = "0%";
  formatBar.style.width = "0%";
  completeBar.style.width = "0%";

  keywordsBox.innerHTML = "";
  missingKeywordsBox.innerHTML = "";

  evaluationReasoning.innerHTML = "<p>Analyzing resume...</p>";
  suggestionsBox.innerHTML = "<p>Analyzing resume...</p>";
  suggestionCount.textContent = "0";

  editorContent.innerHTML = '<p class="empty-state">Loading resume content...</p>';
  previewPaper.innerHTML = '<p class="empty-state">Generating preview...</p>';

  summaryScore.textContent = "0";
  keywordScore.textContent = "0";
  impactScore.textContent = "0";
  lengthScore.textContent = "0";
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

  selectedBulletIdInput.value = bulletId;
  selectedBulletText.textContent = bulletText;
  rewriteSuggestionsBox.innerHTML = "<p>Generating rewrite suggestions...</p>";
  acceptRewriteBtn.disabled = true;

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
    rewriteSuggestionsBox.innerHTML = `
      <p class="status-message error">${escapeHtml(error.message)}</p>
    `;
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

  acceptRewriteBtn.disabled = true;

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
    acceptRewriteBtn.disabled = false;
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
  // ============================================================
  // TODO: PREPROCESSING INTEGRATION
  //
  // Intended final flow:
  // frontend uploads resume file
  // -> preprocessing extracts and structures resume
  // -> preprocessing writes sample/final.json
  // -> backend /evaluate-file reads sample/final.json
  //
  // Current temporary behavior:
  // preprocessing is not ready yet.
  // Upload only triggers /evaluate-file.
  // So make sure sample/final.json already exists manually.
  //
  // Later expected preprocessing call:
  //
  // const formData = new FormData();
  // formData.append("resume", file);
  // formData.append("target_role", roleSelect.value);
  // formData.append("target_level", levelSelect.value);
  //
  // await fetch(`${API_BASE_URL}/preprocess`, {
  //   method: "POST",
  //   body: formData
  // });
  //
  // Then:
  // await evaluateFromFinalJson();
  // ============================================================

  console.log("Preprocessing placeholder. File selected:", file?.name);
  return true;
}


// ============================================================
// Render backend result
// ============================================================

function renderBackendData(data) {
  latestEvaluationData = data;
  latestRuleBasedSignals = data.rule_based_signals || {};
  latestEvaluationAgentResult = data.evaluation_agent_result || {};

  const score = Number(data.ats_score ?? latestRuleBasedSignals.ats_score ?? 0);

  atsScore.textContent = `${score}%`;
  atsStatusText.textContent =
    score >= 80 ? "Excellent" :
    score >= 60 ? "Competitive" :
    "Needs work";

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

  rankScore.textContent = `${numericRank}/100`;
  rankBar.style.width = `${Math.max(0, Math.min(numericRank, 100))}%`;

  const label =
    category === "상" ? "Strong" :
    category === "중" ? "Competitive" :
    "Needs improvement";

  competitivenessText.textContent = `${label} (${category})`;
}

function renderKeywordCards(ruleSignals) {
  const keywordResult = ruleSignals.keyword_result || {};
  const presentKeywords = keywordResult.present_keywords || [];
  const missingKeywords = keywordResult.missing_keywords || [];

  keywordsBox.innerHTML = "";
  missingKeywordsBox.innerHTML = "";

  if (presentKeywords.length === 0) {
    keywordsBox.innerHTML = "<span>No keywords found</span>";
  } else {
    presentKeywords.forEach(keyword => {
      keywordsBox.innerHTML += `<span>${escapeHtml(keyword)}</span>`;
    });
  }

  if (missingKeywords.length === 0) {
    missingKeywordsBox.innerHTML = "<span>None</span>";
  } else {
    missingKeywords.forEach(keyword => {
      missingKeywordsBox.innerHTML += `<span>${escapeHtml(keyword)}</span>`;
    });
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

  keywordPercent.textContent = `${keywordScoreValue}%`;
  formatPercent.textContent = `${formatScoreValue}%`;
  completePercent.textContent = `${completeScoreValue}%`;

  keywordBar.style.width = `${keywordScoreValue}%`;
  formatBar.style.width = `${formatScoreValue}%`;
  completeBar.style.width = `${completeScoreValue}%`;

  summaryScore.textContent = completeScoreValue;
  keywordScore.textContent = keywordScoreValue;
  impactScore.textContent = calculateImpactScore(ruleSignals);
  lengthScore.textContent = Math.min(100, score);
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

  (evaluation.improvement_priorities || []).forEach(priority => {
    suggestions.push(priority);
  });

  evaluationReasoning.innerHTML = evaluation.reasoning
    ? `<p>${escapeHtml(evaluation.reasoning)}</p>`
    : "<p>No evaluation reasoning returned.</p>";

  suggestionsBox.innerHTML = "";
  suggestionCount.textContent = suggestions.length;

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

  if (allBullets.length === 0) {
    editorContent.innerHTML = '<p class="empty-state">No bullets found in final.json.</p>';
    return;
  }

  const experienceBullets = allBullets.filter(item => item.section === "experience");
  const projectBullets = allBullets.filter(item => item.section === "projects");

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
  const className = isWeak ? "resume-bullet weak" : "resume-bullet";

  return `
    <span
      class="${className}"
      data-bullet-id="${escapeHtml(bullet.id)}"
      data-bullet-text="${escapeHtml(bullet.text)}"
      title="Click to rewrite this bullet"
    >
      ${escapeHtml(bullet.text)}
    </span>
  `;
}


// ============================================================
// Rewrite modal
// ============================================================

function openRewriteModal() {
  rewriteModal.style.display = "flex";
  rewriteModal.classList.remove("hidden");
}

function closeRewriteModal() {
  rewriteModal.style.display = "none";
  rewriteModal.classList.add("hidden");

  selectedBullet = {
    id: "",
    text: "",
  };

  selectedRewriteSuggestion = "";
  selectedBulletIdInput.value = "";
  selectedBulletText.textContent = "No bullet selected.";
  rewriteSuggestionsBox.innerHTML = "<p>No rewrite suggestions yet.</p>";
  acceptRewriteBtn.disabled = true;
}

function renderRewriteSuggestions(data) {
  const suggestions = data.rewrite_suggestions || [];

  rewriteSuggestionsBox.innerHTML = "";
  selectedRewriteSuggestion = "";
  acceptRewriteBtn.disabled = true;

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
      acceptRewriteBtn.disabled = false;
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
// Event listeners
// ============================================================

if (resumeUpload) {
  resumeUpload.addEventListener("change", async function () {
    const file = resumeUpload.files[0];
    if (!file) return;

    if (!roleSelect.value || !levelSelect.value) {
      alert("Please select role and level first.");
      resumeUpload.value = "";
      return;
    }

    try {
      setLoadingState("Preparing resume...");

      // Temporary until preprocessing is connected.
      await runPreprocessingPlaceholder(file);

      // Current backend reads sample/final.json.
      await evaluateFromFinalJson();

    } catch (error) {
      showError(
        "Cannot evaluate resume. Make sure backend is running and sample/final.json exists.\n\n" +
        error.message
      );
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

  // Important: force modal hidden on page load.
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
}

initPage();