FROM python:3.10-slim-bookworm

# Prevents interactive prompts during apt installation
ENV DEBIAN_FRONTEND=noninteractive

# Add contrib and non-free repos for Microsoft Core Fonts
RUN sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/g' /etc/apt/sources.list.d/debian.sources

# Install all system dependencies, OCR engines, LibreOffice, and Fonts
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    poppler-utils \
    ghostscript \
    libreoffice \
    ttf-mscorefonts-installer \
    fonts-liberation \
    fonts-dejavu \
    libgl1 \
    libglib2.0-0 \
    qpdf \
    unpaper \
    && fc-cache -f -v \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]

