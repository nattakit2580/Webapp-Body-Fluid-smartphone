FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
WORKDIR /app

# opencv-headless บน Linux มักต้องใช้ libglib2.0 และ libgomp
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run ต้องฟังที่ $PORT (ปกติ 8080) ไม่งั้นจะขึ้น error port not listening
CMD ["sh", "-c", "uvicorn main:APP --host 0.0.0.0 --port ${PORT}"]
