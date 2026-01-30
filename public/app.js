/* -*- coding: utf-8 -*- */

// Local vs Firebase Hosting
const LOCAL_BACKEND = "http://127.0.0.1:8000";
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = isLocalHost ? LOCAL_BACKEND : "/api";

const API_HEALTH = `${API_BASE}/health`;
const API_PREDICT = `${API_BASE}/predict`;


const el = (id) => document.getElementById(id);

const yearEl = el("year");
const apiText = el("apiText");
const dot = el("dot");
const pillApi = el("pillApi");

const fileInput = el("fileInput");
const btnCamera = el("btnCamera");
const btnRetake = el("btnRetake");
const btnToggleBoxes = el("btnToggleBoxes");

const badge = el("badge");
const statusText = el("statusText");

const previewImg = el("previewImg");
const overlay = el("overlay");
const empty = el("empty");
const loading = el("loading");

const imgSize = el("imgSize");
const detCount = el("detCount");
const apiStatus = el("apiStatus");

const results = el("results");
const resultsEmpty = el("resultsEmpty");

const summary = el("summary");
const sumTitle = el("sumTitle");
const sumSub = el("sumSub");

let currentFile = null;
let lastDetections = [];
let showBoxes = true;

yearEl.textContent = String(new Date().getFullYear());
apiText.textContent = `API: ${API_PREDICT}`;

function setBadge(type, text) {
  badge.textContent = text;

  badge.style.borderColor = "rgba(255,255,255,.14)";
  badge.style.background = "rgba(255,255,255,.06)";

  if (type === "loading") {
    badge.style.borderColor = "rgba(255,205,77,.35)";
    badge.style.background = "rgba(255,205,77,.10)";
  } else if (type === "ok") {
    badge.style.borderColor = "rgba(53,208,127,.40)";
    badge.style.background = "rgba(53,208,127,.12)";
  } else if (type === "bad") {
    badge.style.borderColor = "rgba(255,93,93,.40)";
    badge.style.background = "rgba(255,93,93,.12)";
  }
}

function showLoading(on) {
  if (on) loading.classList.add("show");
  else loading.classList.remove("show");
}

function clearCanvas() {
  const ctx = overlay.getContext("2d");
  overlay.width = 1;
  overlay.height = 1;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function fitCanvasToImage() {
  const w = Math.max(1, Math.floor(previewImg.clientWidth));
  const h = Math.max(1, Math.floor(previewImg.clientHeight));
  overlay.width = w;
  overlay.height = h;
}

function confToPct(c) {
  return `${(Number(c) * 100).toFixed(1)}%`;
}

function formatBBox(b) {
  const [x1, y1, x2, y2] = b.map(v => Number(v).toFixed(1));
  return `[${x1}, ${y1}, ${x2}, ${y2}]`;
}

function renderResults(detections) {
  results.innerHTML = "";

  if (!detections || detections.length === 0) {
    resultsEmpty.textContent = "ไม่พบกล่อง (detections=0) — ลองถ่ายใหม่ให้ชัด/ใกล้ขึ้น";
    results.appendChild(resultsEmpty);
    return;
  }

  detections.forEach((d, i) => {
    const item = document.createElement("div");
    item.className = "item";

    const no = document.createElement("div");
    no.className = "no";
    no.textContent = String(i + 1);

    const body = document.createElement("div");
    body.className = "body";

    const line1 = document.createElement("div");
    line1.className = "line1";
    line1.textContent = `${d.class_name} • ${confToPct(d.confidence)}`;

    const line2 = document.createElement("div");
    line2.className = "line2";
    line2.textContent = `class_id: ${d.class_id}`;

    const mono = document.createElement("div");
    mono.className = "mono";
    mono.textContent = `bbox_xyxy: ${formatBBox(d.bbox_xyxy)}`;

    body.appendChild(line1);
    body.appendChild(line2);
    body.appendChild(mono);

    item.appendChild(no);
    item.appendChild(body);

    results.appendChild(item);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawBoxes(detections) {
  if (!showBoxes || !detections || detections.length === 0) {
    clearCanvas();
    return;
  }
  if (!previewImg.naturalWidth || !previewImg.naturalHeight) {
    clearCanvas();
    return;
  }

  fitCanvasToImage();
  const ctx = overlay.getContext("2d");

  const sx = overlay.width / previewImg.naturalWidth;
  const sy = overlay.height / previewImg.naturalHeight;

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.lineWidth = 2;
  ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.textBaseline = "top";

  detections.forEach((d) => {
    const [x1, y1, x2, y2] = d.bbox_xyxy.map(Number);
    const rx = x1 * sx;
    const ry = y1 * sy;
    const rw = (x2 - x1) * sx;
    const rh = (y2 - y1) * sy;

    ctx.strokeStyle = "rgba(106, 228, 255, 0.92)";
    ctx.shadowColor = "rgba(106, 228, 255, 0.35)";
    ctx.shadowBlur = 10;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.shadowBlur = 0;

    const label = `${d.class_name} ${confToPct(d.confidence)}`;
    const pad = 6;
    const textW = ctx.measureText(label).width;
    const boxW = textW + pad * 2;
    const boxH = 18;

    const ly = Math.max(0, ry - boxH - 2);

    ctx.fillStyle = "rgba(11, 18, 32, 0.88)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, rx, ly, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(232,238,255,0.96)";
    ctx.fillText(label, rx + pad, ly + 3);
  });
}

function setApiPillOnline(isOnline) {
  if (isOnline) {
    dot.style.background = "rgba(106,228,255,.85)";
    dot.style.boxShadow = "0 0 0 6px rgba(106,228,255,.08)";
    pillApi.style.borderColor = "rgba(106,228,255,.22)";
  } else {
    dot.style.background = "rgba(255,93,93,.85)";
    dot.style.boxShadow = "0 0 0 6px rgba(255,93,93,.08)";
    pillApi.style.borderColor = "rgba(255,93,93,.22)";
  }
}

async function pingAPI() {
  try {
    apiStatus.textContent = "checking…";
    const r = await fetch(API_HEALTH, { method: "GET" });
    if (!r.ok) throw new Error(`health ${r.status}`);
    const j = await r.json();
    apiStatus.textContent = j && j.ok ? "online" : "unknown";
    setApiPillOnline(true);
  } catch (e) {
    apiStatus.textContent = "offline";
    setApiPillOnline(false);
  }
}

function resetResultsUI() {
  detCount.textContent = "-";
  results.innerHTML = "";
  results.appendChild(resultsEmpty);
  summary.style.display = "none";
}

function updateSummary(detections) {
  if (!detections || detections.length === 0) {
    summary.style.display = "none";
    return;
  }

  // top by confidence
  const top = [...detections].sort((a,b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  const topName = top.class_name ?? "unknown";
  const topConf = confToPct(top.confidence ?? 0);

  summary.style.display = "flex";
  sumTitle.textContent = `Top: ${topName}`;
  sumSub.textContent = `ความมั่นใจสูงสุด ${topConf} • รวมทั้งหมด ${detections.length} กล่อง`;
}

function setPreviewFile(file) {
  currentFile = file;
  lastDetections = [];
  resetResultsUI();

  const url = URL.createObjectURL(file);
  previewImg.onload = () => {
    previewImg.classList.add("ready");
    empty.style.display = "none";
    imgSize.textContent = `${previewImg.naturalWidth} × ${previewImg.naturalHeight}`;

    btnRetake.disabled = false;
    btnToggleBoxes.disabled = false;

    // predict auto
    doPredict().catch(() => {});
  };
  previewImg.src = url;
}

async function doPredict() {
  if (!currentFile) return;

  try {
    setBadge("loading", "กำลังทำนาย");
    statusText.textContent = "กำลังส่งภาพไปยัง YOLO…";
    showLoading(true);

    const fd = new FormData();
    fd.append("file", currentFile);

    const res = await fetch(API_PREDICT, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data && data.detail ? data.detail : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    const detections = Array.isArray(data.detections) ? data.detections : [];
    lastDetections = detections;

    detCount.textContent = String(data.num_detections ?? detections.length ?? 0);

    renderResults(detections);
    updateSummary(detections);
    drawBoxes(detections);

    setBadge("ok", "สำเร็จ");
    statusText.textContent = `ทำนายเสร็จ: พบ ${detections.length} กล่อง`;
  } catch (err) {
    console.error(err);
    setBadge("bad", "ผิดพลาด");
    statusText.textContent = `ทำนายไม่สำเร็จ: ${String(err.message || err)}`;
    clearCanvas();
  } finally {
    showLoading(false);
  }
}

/* Events */
btnCamera.addEventListener("click", () => fileInput.click());

btnRetake.addEventListener("click", () => {
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/")) return;

  setBadge("idle", "กำลังเตรียมรูป");
  statusText.textContent = "โหลดรูปแล้วกำลังเริ่มทำนาย…";
  setPreviewFile(f);
});

btnToggleBoxes.addEventListener("click", () => {
  showBoxes = !showBoxes;
  if (showBoxes) {
    btnToggleBoxes.textContent = "👁️ ซ่อนกรอบ";
    drawBoxes(lastDetections);
  } else {
    btnToggleBoxes.textContent = "👁️ แสดงกรอบ";
    clearCanvas();
  }
});

window.addEventListener("resize", () => drawBoxes(lastDetections));

/* Init */
function init() {
  setBadge("idle", "พร้อมใช้งาน");
  statusText.textContent = "กดปุ่มเพื่อเริ่ม";
  pingAPI();
}
init();
