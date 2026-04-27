* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
  background: #e9edf3;
  color: #111827;
}

.hidden {
  display: none !important;
}

.navbar {
  height: 72px;
  background: white;
  border-bottom: 1px solid #d9dee8;
  display: flex;
  align-items: center;
  padding: 0 22px;
  gap: 22px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 20px;
  border-right: 1px solid #d9dee8;
}

.logo,
.big-icon {
  background: #3761b6;
  color: white;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  width: 34px;
  height: 34px;
}

.brand h2 {
  margin: 0;
  font-size: 19px;
}

.brand p {
  margin: 3px 0 0;
  font-size: 10px;
  letter-spacing: 1px;
  color: #64748b;
}

.controls {
  display: flex;
  gap: 12px;
}

select,
button,
.upload-btn {
  background: white;
  border: 1px solid #d6dce8;
  border-radius: 10px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
}

.upload-btn {
  display: inline-block;
}

.linkedin-btn {
  margin-left: auto;
  color: #2563eb;
  border-color: #bfdbfe;
}

.landing {
  height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #0f172a;
}

.big-icon {
  width: 82px;
  height: 82px;
  font-size: 38px;
  margin-bottom: 22px;
  box-shadow: 0 12px 28px rgba(55, 97, 182, 0.35);
}

.landing h1 {
  font-size: 40px;
  margin: 0 0 8px;
}

.landing p {
  max-width: 470px;
  color: #64748b;
  font-size: 20px;
  line-height: 1.45;
}

.steps {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 32px 0;
}

.step {
  width: 120px;
  height: 88px;
  background: white;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.step span {
  font-size: 11px;
  color: #64748b;
}

.demo-btn {
  width: 230px;
  padding: 13px;
}

.landing small {
  margin-top: 10px;
  color: #64748b;
}

.dashboard {
  display: grid;
  grid-template-columns: 230px 1fr 1fr;
  gap: 16px;
  padding: 16px 22px 0;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card,
.editor-panel,
.preview-panel {
  background: white;
  border-radius: 10px;
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.08);
  border: 1px solid #e5e7eb;
}

.card {
  padding: 18px;
}

.card h3,
.panel-header h3 {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  letter-spacing: 0.8px;
}

.gauge {
  width: 140px;
  height: 80px;
  margin: 20px auto 0;
  position: relative;
}

.gauge::before {
  content: "";
  width: 130px;
  height: 65px;
  border: 8px solid #e5e7eb;
  border-bottom: none;
  border-radius: 130px 130px 0 0;
  position: absolute;
  left: 0;
  top: 0;
}

.gauge-fill {
  width: 130px;
  height: 65px;
  border: 8px solid #22c55e;
  border-bottom: none;
  border-radius: 130px 130px 0 0;
  position: absolute;
  left: 0;
  top: 0;
  clip-path: polygon(0 0, 78% 0, 78% 100%, 0 100%);
}

.gauge-cover {
  position: absolute;
  width: 100%;
  top: 34px;
  text-align: center;
}

.gauge-cover h1 {
  margin: 0;
  font-size: 34px;
}

.gauge-cover p {
  margin: 6px 0 0;
  color: #22c55e;
  font-weight: 700;
  font-size: 12px;
}

.rank-row {
  display: flex;
  justify-content: space-between;
  margin: 18px 0 8px;
  color: #6b7280;
  font-size: 13px;
}

.progress {
  height: 10px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

#rankBar {
  width: 0%;
  height: 100%;
  background: #f59e0b;
  border-radius: 999px;
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tags span {
  background: #e5e7eb;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.suggestion-card p {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
}

.pill {
  background: #e5e7eb;
  color: #64748b;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
}

.editor-panel,
.preview-panel {
  height: 450px;
  overflow: hidden;
}

.panel-header {
  height: 44px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.resume-text {
  height: 375px;
  padding: 16px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.8;
  color: #4b5563;
}

.resume-text h2 {
  font-size: 16px;
  color: #111827;
}

.resume-text h4 {
  color: #111827;
  margin-bottom: 4px;
}

.highlight {
  background: #fde68a;
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
}

.warning {
  color: #b91c1c;
  font-weight: 700;
}

.hint {
  font-size: 11px;
  padding-left: 14px;
  color: #64748b;
}

.preview-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-actions button {
  padding: 7px 10px;
  font-size: 8px;
}

#zoomText {
  color: #64748b;
  font-size: 12px;
}

.preview-area {
  height: 405px;
  background: #f1f5f9;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 20px;
}

.paper {
  width: 305px;
  min-height: 430px;
  background: white;
  padding: 28px;
  font-size: 8px;
  line-height: 1.55;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
  transform-origin: top center;
}

.paper h2 {
  font-size: 10px;
  text-align: center;
}

.paper h4 {
  font-size: 8px;
  margin-bottom: 2px;
}

.bottom-metrics {
  margin-top: 0;
  height: 90px;
  background: white;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 28px;
}

.bottom-metrics h4 {
  font-size: 11px;
  color: #64748b;
  margin-right: 10px;
}

.metric {
  width: 70px;
  height: 70px;
  background: #ecfdf5;
  border-radius: 10px;
  text-align: center;
  padding: 8px;
}

.metric h2 {
  margin: 0;
  color: #10b981;
}

.metric div {
  height: 3px;
  background: #10b981;
  border-radius: 999px;
  margin: 4px 0;
}

.metric p {
  margin: 0;
  font-size: 9px;
  color: #64748b;
  font-weight: 700;
}

#reevaluateBtn {
  margin-left: auto;
}

.tooltip {
  position: absolute;
  width: 280px;
  background: white;
  border: 1px solid #d6dce8;
  border-radius: 12px;
  padding: 14px;
  z-index: 99;
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.25);
}

.tooltip h4 {
  margin: 0 0 8px;
}

.tooltip p {
  font-size: 13px;
  color: #4b5563;
}

.tooltip button {
  width: 100%;
  background: #2563eb;
  color: white;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  width: 360px;
  background: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
}

.modal-box button {
  background: #2563eb;
  color: white;
}

@media (max-width: 1000px) {
  .dashboard {
    grid-template-columns: 1fr;
  }

  .navbar {
    height: auto;
    flex-wrap: wrap;
    padding: 14px;
  }

  .linkedin-btn {
    margin-left: 0;
  }

  .landing {
    height: auto;
    padding: 60px 20px;
  }

  .steps {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.ats-card {
  min-height: 285px;
}

.ats-breakdown {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 8px;
}

.mini-score {
  text-align: center;
}

.mini-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 6px;
}

.mini-bar {
  width: 100%;
  height: 9px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.mini-bar div {
  height: 100%;
  border-radius: 999px;
}

#keywordBar {
  width: 0%;
  background: #6366f1;
}

#formatBar {
  width: 0%;
  background: #f59e0b;
}

#completeBar {
  width: 0%;
  background: #3b82f6;
}

.mini-score b {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #334155;
}

/* ===== Clean integration update ===== */

.semi-gauge {
  width: 160px;
  height: 95px;
  margin: 20px auto 8px;
  position: relative;
  overflow: hidden;
}

.semi-track,
.semi-progress {
  position: absolute;
  width: 160px;
  height: 80px;
  border-radius: 160px 160px 0 0;
  border: 12px solid;
  border-bottom: 0;
  left: 0;
  top: 0;
}

.semi-track {
  border-color: #e5e7eb;
}

.semi-progress {
  border-color: #22c55e;
  clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
  transition: clip-path 0.6s ease;
}

.semi-center {
  position: absolute;
  width: 100%;
  top: 32px;
  text-align: center;
}

.semi-center h1 {
  margin: 0;
  font-size: 32px;
}

.semi-center p {
  margin: 4px 0 0;
  color: #64748b;
  font-weight: 700;
  font-size: 12px;
}

#rankBar,
#keywordBar,
#formatBar,
#completeBar {
  width: 0%;
  transition: width 0.5s ease;
}

.linkedin-btn:hover,
.demo-btn:hover,
.upload-btn:hover,
button:hover,
select:hover {
  transform: translateY(-1px);
}

button,
.upload-btn,
select {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
