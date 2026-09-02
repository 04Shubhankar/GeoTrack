import os

from dotenv import load_dotenv
from supabase import create_client


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Supabase credentials are missing. "
        "Set SUPABASE_URL and SUPABASE_KEY in your .env file."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_file(bucket_name: str, file_path: str, destination_path: str) -> str:
    """Upload a local file to a Supabase Storage bucket and return its public URL."""
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    _, ext = os.path.splitext(file_path)
    mime_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".json": "application/json",
        ".geojson": "application/geo+json",
        ".pdf": "application/pdf",
    }.get(ext.lower(), "application/octet-stream")

    supabase.storage.from_(bucket_name).upload(
        path=destination_path,
        file=file_bytes,
        file_options={
            "content-type": mime_type,
            "upsert": "true"
        }
    )

    return supabase.storage.from_(bucket_name).get_public_url(destination_path)


def save_report_metadata(job_id: str, report_url: str, confidence: float, class_breakdown: dict):
    """Optional metadata writer for report records.

    This is intentionally safe: if no `reports` table exists, it simply returns.
    """
    try:
        data = {
            "job_id": job_id,
            "report_url": report_url,
            "confidence": confidence,
            "class_breakdown": class_breakdown,
        }
        supabase.table("reports").insert(data).execute()
    except Exception:
        # If the table or schema is not configured yet, ignore silently.
        pass
