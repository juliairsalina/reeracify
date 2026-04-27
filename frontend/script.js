const API_BASE_URL = "http://127.0.0.1:8000";

const landing = document.getElementById("landing");
const dashboard = document.getElementById("dashboard");
const bottomMetrics = document.getElementById("bottomMetrics");

const resumeUpload = document.getElementById("resumeUpload");
const demoBtn = document.getElementById("demoBtn");

const categorySelect = document.getElementById("categorySelect");
const roleSelect = document.getElementById("roleSelect");
const levelSelect = document.getElementById("levelSelect");

const editorContent = document.getElementById("editorContent");
const previewPaper = document.getElementById("previewPaper");

const atsScore = document.getElementById("atsScore");
const rankScore = document.getElementById("rankScore");
const rankBar = document.getElementById("rankBar");

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

function loadRoles() {
  roleSelect.innerHTML = '<option value="">Select Role</option>';
  levelSelect.innerHTML = '<option value="">Select Level</option>';

  const roles = jobData[categorySelect.value];
  if (!roles) return;

  Object.keys(roles).forEach(role => {
    roleSelect.innerHTML += `<option value="${role}">${role}</option>`;
  });
}

function loadLevels() {
  levelSelect.innerHTML = '<option value="">Select Level</option>';

  const levels = jobData[categorySelect.value]?.[roleSelect.value];
  if (!levels) return;

  levels.forEach(level => {
    levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
  });
}

function showDashboard() {
  landing.classList.add("hidden");
  dashboard.classList.remove("hidden");
  bottomMetrics.classList.remove("hidden");
}

function setGauge(score) {
  const progress = document.querySelector(".semi-progress");
  if (!progress) return;

  const safeScore = Math.max(0, Math.min(score, 100));
  progress.style.clipPath = `inset(0 ${100 - safeScore}% 0 0)`;
}

function setLoadingState() {
  showDashboard();

  atsScore.textContent = "Loading...";
  rankScore.textContent = "Loading...";
  rankBar.style.width = "0%";

  document.getElementById("keywordPercent").textContent = "0%";
  document.getElementById("formatPercent").textContent = "0%";
  document.getElementById("completePercent").textContent = "0%";

  document.getElementById("keywordBar").style.width = "0%";
  document.getElementById("formatBar").style.width = "0%";
  document.getElementById("completeBar").style.width = "0%";

  document.getElementById("keywords").innerHTML = "";
  document.getElementById("suggestions").innerHTML = "<p>Analyzing resume...</p>";
  document.getElementById("suggestionCount").textContent = "0";

  editorContent.innerHTML = '<p class="empty-state">Extracting resume content...</p>';
  previewPaper.innerHTML = '<p class="empty-state">Generating preview...</p>';
}

function updatePreview() {
  previewPaper.innerHTML = editorContent.innerHTML;
}

async function evaluateFromFinalJson() {
  const response = await fetch(`${API_BASE_URL}/evaluate-file`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Evaluation failed: " + response.status);
  }

  const data = await response.json();
  renderBackendData(data);
}

function renderBackendData(data) {
  const score = data.ats_score ?? 0;
  const ruleSignals = data.rule_based_signals || {};
  const evaluation = data.evaluation_agent_result || {};

  const keywordResult = ruleSignals.keyword_result || {};
  const presentKeywords = keywordResult.present_keywords || [];
  const missingKeywords = keywordResult.missing_keywords || [];

  const weakPhraseFlags = ruleSignals.weak_phrase_flags || [];
  const grammarFlags = ruleSignals.grammar_flags || [];
  const weakBullets = evaluation.weak_bullets || [];
  const priorities = evaluation.improvement_priorities || [];
  const competitiveness = evaluation.competitiveness_category || "Waiting";

  atsScore.textContent = score + "%";
  setGauge(score);

  rankScore.textContent = competitiveness;
  rankBar.style.width = score + "%";

  const keywordPercent = Math.round(
    (presentKeywords.length / Math.max(presentKeywords.length + missingKeywords.length, 1)) * 100
  );

  const formatPercent = score;
  const completePercent = score;

  document.getElementById("keywordPercent").textContent = keywordPercent + "%";
  document.getElementById("formatPercent").textContent = formatPercent + "%";
  document.getElementById("completePercent").textContent = completePercent + "%";

  document.getElementById("keywordBar").style.width = keywordPercent + "%";
  document.getElementById("formatBar").style.width = formatPercent + "%";
  document.getElementById("completeBar").style.width = completePercent + "%";

  const keywordsBox = document.getElementById("keywords");
  keywordsBox.innerHTML = "";

  presentKeywords.forEach(keyword => {
    keywordsBox.innerHTML += `<span>${keyword}</span>`;
  });

  const suggestions = [];

  missingKeywords.forEach(keyword => {
    suggestions.push(`Missing keyword: ${keyword}`);
  });

  weakPhraseFlags.forEach(item => {
    suggestions.push(item.reason || `Weak phrase found: ${item.text}`);
  });

  grammarFlags.forEach(item => {
    if (item.text) suggestions.push(`Grammar issue: ${item.text}`);
  });

  weakBullets.forEach(item => {
    suggestions.push(item.reason || `Weak bullet: ${item.text}`);
  });

  priorities.forEach(item => {
    suggestions.push(item);
  });

  const suggestionsBox = document.getElementById("suggestions");
  const suggestionCount = document.getElementById("suggestionCount");

  suggestionsBox.innerHTML = "";
  suggestionCount.textContent = suggestions.length;

  if (suggestions.length === 0) {
    suggestionsBox.innerHTML = "<p>No major issues found.</p>";
  } else {
    suggestions.forEach(item => {
      suggestionsBox.innerHTML += `<p>⚠ ${item}</p>`;
    });
  }

  const allBullets = ruleSignals.all_bullets || [];

  if (allBullets.length > 0) {
    editorContent.innerHTML = "";

    allBullets.forEach(bullet => {
      editorContent.innerHTML += `
        <p>
          <span class="highlight" data-bullet-id="${bullet.id}">
            ${bullet.text}
          </span>
        </p>
      `;
    });
  } else {
    editorContent.innerHTML = '<p class="empty-state">Resume content received, but no bullets returned from backend.</p>';
  }

  updatePreview();
}

resumeUpload.addEventListener("change", async function () {
  const file = resumeUpload.files[0];
  if (!file) return;

  if (!roleSelect.value || !levelSelect.value) {
    alert("Please select role and level first.");
    resumeUpload.value = "";
    return;
  }

  setLoadingState();

  try {
    await evaluateFromFinalJson();
  } catch (error) {
    console.error(error);
    alert("Cannot connect to backend. Make sure FastAPI is running on " + API_BASE_URL);
  }
});

categorySelect.addEventListener("change", loadRoles);
roleSelect.addEventListener("change", loadLevels);

if (demoBtn) {
  demoBtn.addEventListener("click", function () {
    alert("Demo data removed. Please upload a real resume.");
  });
}

document.getElementById("zoomIn").addEventListener("click", function () {
  const paper = document.getElementById("previewPaper");
  let currentZoom = Number(paper.dataset.zoom || 1);
  currentZoom += 0.1;
  paper.dataset.zoom = currentZoom;
  paper.style.transform = `scale(${currentZoom})`;
  document.getElementById("zoomText").textContent = Math.round(48 * currentZoom) + "%";
});

document.getElementById("zoomOut").addEventListener("click", function () {
  const paper = document.getElementById("previewPaper");
  let currentZoom = Number(paper.dataset.zoom || 1);
  currentZoom -= 0.1;

  if (currentZoom < 0.6) currentZoom = 0.6;

  paper.dataset.zoom = currentZoom;
  paper.style.transform = `scale(${currentZoom})`;
  document.getElementById("zoomText").textContent = Math.round(48 * currentZoom) + "%";
});

document.getElementById("downloadBtn").addEventListener("click", function () {
  window.print();
});

document.getElementById("reevaluateBtn").addEventListener("click", async function () {
  setLoadingState();

  try {
    const response = await fetch(`${API_BASE_URL}/reevaluate-file`, {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Re-evaluation failed: " + response.status);
    }

    const data = await response.json();
    renderBackendData(data);
  } catch (error) {
    console.error(error);
    alert("Cannot re-evaluate. Make sure FastAPI is running on " + API_BASE_URL);
  }
});

loadRoles();