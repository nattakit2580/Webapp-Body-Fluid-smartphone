# -*- coding: utf-8 -*-
import os
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import cv2

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ultralytics import YOLO

APP = FastAPI(title="Body Fluid cell Classification YOLO Inference API + Mobile UI")

# ถ้าคุณเรียกผ่าน Firebase Hosting rewrite (โดเมนเดียวกัน) ปกติไม่ต้อง CORS
# แต่เปิดไว้ช่วยตอนทดสอบ local ได้
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Path Resolver (Project Root / Public / Model)
# =========================
BASE_DIR = Path(__file__).resolve().parent                # .../backend
ROOT_DIR = BASE_DIR.parent                                # project root (มี public/, models/)
PUBLIC_DIR_CANDIDATES = [
    ROOT_DIR / "public",                                  # root/public
    BASE_DIR / "public",                                  # backend/public (เผื่อบางคนวางไว้ตรงนี้)
]
PUBLIC_DIR = next((p for p in PUBLIC_DIR_CANDIDATES if p.exists() and p.is_dir()), PUBLIC_DIR_CANDIDATES[0])
PUBLIC_DIR = PUBLIC_DIR.resolve()

# =========================
# Robust model path resolver
# =========================
DEFAULT_MODEL_CANDIDATES = [
    BASE_DIR / "models" / "best.pt",          # backend/models/best.pt
    ROOT_DIR / "models" / "best.pt",          # root/models/best.pt
]

_env_model = os.environ.get("MODEL_PATH", "").strip()
if _env_model:
    p = Path(_env_model)
    MODEL_PATH = p if p.is_absolute() else (BASE_DIR / p)
else:
    MODEL_PATH = next((p for p in DEFAULT_MODEL_CANDIDATES if p.exists()), DEFAULT_MODEL_CANDIDATES[0])

MODEL_PATH = MODEL_PATH.resolve()

if not MODEL_PATH.exists():
    # สร้าง message ที่ช่วย debug ได้จริง
    msg = (
        f"MODEL_PATH not found: {MODEL_PATH}\n"
        f"- Current working directory (CWD): {Path.cwd()}\n"
        f"- main.py directory (BASE_DIR): {BASE_DIR}\n"
        f"- project root (ROOT_DIR): {ROOT_DIR}\n\n"
        f"Fix options:\n"
        f"1) Put model at one of these paths:\n"
        f"   - {DEFAULT_MODEL_CANDIDATES[0]}\n"
        f"   - {DEFAULT_MODEL_CANDIDATES[1]}\n\n"
        f"2) Or set env MODEL_PATH to an absolute path, e.g.\n"
        f"   Windows PowerShell:\n"
        f"     $env:MODEL_PATH = 'C:\\\\path\\\\to\\\\best.pt'\n"
        f"     uvicorn main:APP --host 0.0.0.0 --port 8000\n"
        f"   CMD:\n"
        f"     set MODEL_PATH=C:\\\\path\\\\to\\\\best.pt\n"
        f"     uvicorn main:APP --host 0.0.0.0 --port 8000\n"
    )
    raise RuntimeError(msg)

# โหลดครั้งเดียว ลด cold start
model = YOLO(str(MODEL_PATH))

# =========================
# Helpers
# =========================
def _read_image(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return img

# =========================
# API Routes (รองรับทั้ง /api/* และแบบเดิม)
# =========================

@APP.get("/api/health")
@APP.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_PATH.name,
        "model_path": str(MODEL_PATH),
        "public_dir": str(PUBLIC_DIR),
    }

@APP.post("/api/predict")
@APP.post("/predict")
async def predict(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image")

    data = await file.read()
    img = _read_image(data)

    # Run YOLO
    results = model(img, verbose=False)

    r0 = results[0]
    detections: List[Dict[str, Any]] = []

    if r0.boxes is not None and len(r0.boxes) > 0:
        xyxy = r0.boxes.xyxy.cpu().numpy().tolist()
        conf = r0.boxes.conf.cpu().numpy().tolist()
        cls = r0.boxes.cls.cpu().numpy().tolist()

        names = r0.names  # dict[int,str] usually

        for (x1, y1, x2, y2), c, k in zip(xyxy, conf, cls):
            k_int = int(k)
            if isinstance(names, dict):
                cname = names.get(k_int, str(k_int))
            else:
                cname = str(k_int)

            detections.append({
                "class_id": k_int,
                "class_name": cname,
                "confidence": float(c),
                "bbox_xyxy": [float(x1), float(y1), float(x2), float(y2)],
            })

    return {
        "model": MODEL_PATH.name,
        "model_path": str(MODEL_PATH),
        "image_shape": [int(img.shape[0]), int(img.shape[1]), int(img.shape[2])],
        "num_detections": len(detections),
        "detections": detections,
    }

# =========================
# Serve Mobile UI (public/index.html) at "/"
# IMPORTANT: mount ต้องอยู่ "หลัง" API routes เพื่อไม่ให้ทับ /api/*
# =========================
if not PUBLIC_DIR.exists():
    msg = (
        f"PUBLIC_DIR not found: {PUBLIC_DIR}\n"
        f"- Checked candidates:\n"
        f"  - {PUBLIC_DIR_CANDIDATES[0]}\n"
        f"  - {PUBLIC_DIR_CANDIDATES[1]}\n\n"
        f"Fix: create folder 'public' at project root and put index.html, app.js, styles.css, logo files inside it.\n"
    )
    raise RuntimeError(msg)

APP.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="mobile_ui")

# ===== Optional: allow "python main.py" to run a dev server =====
if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:APP", host="0.0.0.0", port=port, reload=False)
