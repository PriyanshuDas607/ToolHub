import os
import uuid
import shutil
from fastapi import UploadFile
from app.config import TEMP_DIR

def save_upload_file(upload_file: UploadFile) -> tuple[str, str]:
    """Uploaded file ko unique job_id ke saath save karta hai."""
    job_id = str(uuid.uuid4())
    ext = os.path.splitext(upload_file.filename)[1].lower()
    input_path = os.path.join(TEMP_DIR, f"{job_id}_input{ext}")
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    return job_id, input_path

def cleanup_job_files(*file_paths: str):
    """Response bhejne ke baad server se temporary files delete karta hai."""
    for path in file_paths:
        try:
            if path and os.path.exists(path):
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
        except Exception as e:
            print(f"Cleanup error for {path}: {e}")
