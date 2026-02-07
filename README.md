# Body Fluid cell Classification • YOLO Mobile WebApp (Firebase Hosting + Cloud Run)

เว็บมือถือ: ถ่ายภาพ/อัปโหลด → ส่งไปทำนายด้วย YOLO (`yolo.pt`) → แสดงผล + วาดกรอบบนรูป

สถาปัตยกรรม:
- Frontend (static) -> Firebase Hosting
- Backend inference (FastAPI + Ultralytics YOLO) -> Google Cloud Run
- Firebase Hosting rewrite `/api/**` -> Cloud Run service

อ้างอิง:
- Firebase Hosting + Cloud Run integration (rewrites) (docs)

---

## 1) เตรียมไฟล์
1) วางโลโก้: `public/logo.jpeg`
2) วางโมเดล: `backend/models/yolo.pt`

---

## 2) รันทดสอบแบบ Local (แนะนำ)
### 2.1 Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
set MODEL_PATH=models/yolo.pt
uvicorn main:APP --host 0.0.0.0 --port 8080
