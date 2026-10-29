import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp_storage")
os.makedirs(TEMP_DIR, exist_ok=True)

# Standard DPI for OCR (300 DPI is mandatory for accurate font/spacing detection)
OCR_DPI = 300

# Gotenberg URL (Optional if running Gotenberg Docker, else falls back to CLI)
GOTENBERG_URL = os.getenv("GOTENBERG_URL", "http://localhost:3000")
