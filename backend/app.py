# backend/app.py

import os
import uuid
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from inference import load_model, predict
from vectorize import mask_to_geojson, save_geojson

from report_generator import create_report
from storage import upload_file, save_report_metadata

# ── Setup ─────────────────────────────────────────────
app   = FastAPI(title="GeoTrack API")
model = load_model()

UPLOAD_DIR   = r"F:\GeoTrack\outputs\uploads"
RESULT_DIR   = r"F:\GeoTrack\outputs\results"
GEOJSON_DIR  = r"F:\GeoTrack\outputs\geojson"
OVERLAYS_DIR = r"F:\GeoTrack\outputs\overlays"
REPORT_DIR = r"F:\GeoTrack\outputs\reports"
os.makedirs(REPORT_DIR, exist_ok=True)

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)
os.makedirs(GEOJSON_DIR, exist_ok=True)
os.makedirs(OVERLAYS_DIR, exist_ok=True)

# ── CORS — allows frontend to talk to backend ─────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Serve frontend ────────────────────────────────────
app.mount(
    "/static",
    StaticFiles(directory=r"F:\GeoTrack\frontend"),
    name="static"
)

# ── Routes ────────────────────────────────────────────
@app.get("/")
def root():
    return FileResponse(r"F:\GeoTrack\frontend\index.html")


@app.post("/predict")
async def predict_route(file: UploadFile = File(...)):
    """
    Accepts image upload → runs U-Net → returns:
    - predicted mask as PNG
    - GeoJSON download link
    - confidence score
    - class breakdown
    """
    try:
        # Save uploaded file
        job_id    = str(uuid.uuid4())[:8]
        img_path  = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
        
        with open(img_path, "wb") as f:
            f.write(await file.read())

        # Run inference
        pred_mask, pred_rgb, confidence = predict(model, img_path)
        h, w = pred_mask.shape

        # Save predicted mask as PNG
        mask_path = os.path.join(RESULT_DIR, f"{job_id}_mask.png")
        Image.fromarray(pred_rgb).save(mask_path)
        # Upload predicted mask to Supabase
        mask_image_url = upload_file(
            bucket_name="geotrack-images",
            file_path=mask_path,
            destination_path=f"masks/{job_id}_mask.png"
        )

        # Save original resized
        orig_path = os.path.join(RESULT_DIR, f"{job_id}_original.png")
        Image.open(img_path).convert("RGB")\
             .resize((256, 256)).save(orig_path)
        # Upload original image to Supabase
        original_image_url = upload_file(
            bucket_name="geotrack-images",
            file_path=orig_path,
            destination_path=f"originals/{job_id}_original.png"
        )

        # Generate GeoJSON
        geojson      = mask_to_geojson(pred_mask, confidence, w, h)
        geojson_path = os.path.join(GEOJSON_DIR, f"{job_id}_output.geojson")
        save_geojson(geojson, geojson_path)

        geojson_url = upload_file(
            bucket_name="geotrack-raw-data",
            file_path=geojson_path,
            destination_path=f"geojson/{job_id}_output.geojson"
        )
        

        # Class breakdown
        class_names = [
            "urban_land", "agriculture_land", "rangeland",
            "forest_land", "water", "barren_land"
        ]
        class_pixels = {}
        total_pixels = pred_mask.size
        for i, name in enumerate(class_names):
            count = int((pred_mask == i).sum())
            if count > 0:
                class_pixels[name] = round(count / total_pixels * 100, 2)

        # Generate PDF Report
        report_path = os.path.join(REPORT_DIR, f"{job_id}_report.pdf")
        create_report(
            output_path=report_path,
            job_id=job_id,
            original_image_path=orig_path,
            mask_image_path=mask_path,
            confidence=confidence,
            class_breakdown=class_pixels,
            geojson_url=geojson_url
        )
        # Upload PDF report to Supabase
        report_url = upload_file(
            bucket_name="geotrack-reports",
            file_path=report_path,
            destination_path=f"reports/{job_id}_report.pdf"
        )

        # Save iteration metadata to Supabase database
        save_report_metadata(
            job_id=job_id,
            confidence=confidence,
            class_breakdown=class_pixels,
            original_image_url=original_image_url,
            mask_image_url=mask_image_url,
            geojson_url=geojson_url,
            report_url=report_url
        )

        # Delete local files after successful Supabase upload
        files_to_delete = [
            img_path,
            orig_path,
            mask_path,
            geojson_path,
            report_path
        ]

        for file_path in files_to_delete:
            if os.path.exists(file_path):
                os.remove(file_path)

        return JSONResponse({
            "job_id"         : job_id,
            "confidence"     : confidence,
            "class_breakdown": class_pixels,
            "mask_url"       : f"/results/{job_id}_mask.png",
            "original_url"   : f"/results/{job_id}_original.png",
            "geojson_url"    : f"/results/{job_id}_output.geojson",
            "report_url"     : f"/results/{job_id}_report.pdf"
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/results/{filename}")
def get_result(filename: str):
    # Check in results directory first (for masks and originals)
    path = os.path.join(RESULT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    
    # Check in geojson directory
    path = os.path.join(GEOJSON_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    
    # Check in reports directory
    path = os.path.join(REPORT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    
    # Check in overlays directory
    path = os.path.join(OVERLAYS_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    
    return JSONResponse({"error": "File not found"}, status_code=404)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)