# backend/app.py

import os
import uuid
import logging
import json

import numpy as np
from PIL import Image, ImageDraw
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from backend.vectorize import mask_to_geojson, save_geojson
from backend.huggingface_client import predict_remote

from backend.report_generator import create_report
from backend.storage import upload_file, save_report_metadata, list_report_metadata

logger = logging.getLogger(__name__)

# ── Setup ─────────────────────────────────────────────
app   = FastAPI(title="GeoTrack API")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
UPLOAD_DIR = os.path.join(OUTPUT_DIR, "uploads")
RESULT_DIR = os.path.join(OUTPUT_DIR, "results")
GEOJSON_DIR = os.path.join(OUTPUT_DIR, "geojson")
OVERLAYS_DIR = os.path.join(OUTPUT_DIR, "overlays")
REPORT_DIR = os.path.join(OUTPUT_DIR, "reports")
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
    StaticFiles(directory=os.path.join(BASE_DIR, "frontend")),
    name="static"
)

# ── Routes ────────────────────────────────────────────
@app.get("/")
def root():
    return FileResponse(os.path.join(BASE_DIR, "frontend", "index.html"))


@app.get("/reports")
def reports(limit: int = Query(default=50, ge=1, le=100)):
    """Return report metadata stored in Supabase for the dashboard."""
    try:
        return {"reports": list_report_metadata(limit)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/predict")
async def predict_route(
    file: UploadFile = File(...),
    aoi_polygon: str = Form(default="")
):
    """
    Accepts image upload → runs U-Net → returns:
    - predicted mask as PNG
    - GeoJSON download link
    - confidence score
    - class breakdown
    """
    stage = "saving upload"
    try:
        # Save uploaded file
        job_id    = str(uuid.uuid4())[:8]
        img_path  = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")
        
        with open(img_path, "wb") as f:
            f.write(await file.read())

        stage = "requesting Hugging Face prediction"
        pred_mask, pred_rgb, confidence = predict_remote(img_path)
        h, w = pred_mask.shape

        valid_mask = None
        if aoi_polygon:
            try:
                polygon = json.loads(aoi_polygon)
                if not isinstance(polygon, list) or len(polygon) < 3:
                    raise ValueError("aoi_polygon must contain at least three points")
                if any(
                    not isinstance(point, dict)
                    or not isinstance(point.get("lat"), (int, float))
                    or not isinstance(point.get("lng"), (int, float))
                    for point in polygon
                ):
                    raise ValueError("aoi_polygon points must contain numeric lat and lng values")

                min_lng = min(point["lng"] for point in polygon)
                max_lng = max(point["lng"] for point in polygon)
                min_lat = min(point["lat"] for point in polygon)
                max_lat = max(point["lat"] for point in polygon)
                if min_lng == max_lng or min_lat == max_lat:
                    raise ValueError("aoi_polygon must cover a non-zero area")

                pixel_points = [
                    (
                        round((point["lng"] - min_lng) / (max_lng - min_lng) * (w - 1)),
                        round((max_lat - point["lat"]) / (max_lat - min_lat) * (h - 1))
                    )
                    for point in polygon
                ]
                polygon_image = Image.new("1", (w, h), 0)
                ImageDraw.Draw(polygon_image).polygon(pixel_points, fill=1)
                valid_mask = np.asarray(polygon_image, dtype=bool)
                if not valid_mask.any():
                    raise ValueError("aoi_polygon does not cover any image pixels")
                pred_rgb = pred_rgb.copy()
                pred_rgb[~valid_mask] = 0
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                raise HTTPException(status_code=400, detail=f"Invalid aoi_polygon: {exc}") from exc

        stage = "uploading prediction mask"
        mask_path = os.path.join(RESULT_DIR, f"{job_id}_mask.png")
        Image.fromarray(pred_rgb).save(mask_path)
        # Upload predicted mask to Supabase
        mask_image_url = upload_file(
            bucket_name="geotrack-images",
            file_path=mask_path,
            destination_path=f"masks/{job_id}_mask.png"
        )

        stage = "uploading original image"
        orig_path = os.path.join(RESULT_DIR, f"{job_id}_original.png")
        Image.open(img_path).convert("RGB")\
             .resize((256, 256)).save(orig_path)
        # Upload original image to Supabase
        original_image_url = upload_file(
            bucket_name="geotrack-images",
            file_path=orig_path,
            destination_path=f"originals/{job_id}_original.png"
        )

        stage = "generating GeoJSON"
        geojson      = mask_to_geojson(
            pred_mask,
            confidence,
            w,
            h,
            valid_mask=valid_mask
        )
        geojson_path = os.path.join(GEOJSON_DIR, f"{job_id}_output.geojson")
        save_geojson(geojson, geojson_path)

        geojson_url = upload_file(
            bucket_name="geotrack-raw-data",
            file_path=geojson_path,
            destination_path=f"geojson/{job_id}_output.geojson"
        )
        

        stage = "calculating class breakdown"
        class_names = [
            "urban_land", "agriculture_land", "rangeland",
            "forest_land", "water", "barren_land"
        ]
        class_pixels = {}
        total_pixels = int(valid_mask.sum()) if valid_mask is not None else pred_mask.size
        for i, name in enumerate(class_names):
            class_mask = pred_mask == i
            if valid_mask is not None:
                class_mask &= valid_mask
            count = int(class_mask.sum())
            if count > 0:
                class_pixels[name] = round(count / total_pixels * 100, 2)

        stage = "generating PDF report"
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
        stage = "uploading PDF report"
        report_url = upload_file(
            bucket_name="geotrack-reports",
            file_path=report_path,
            destination_path=f"reports/{job_id}_report.pdf"
        )

        stage = "saving report metadata"
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
            "mask_url"       : mask_image_url,
            "original_url"   : original_image_url,
            "geojson_url"    : geojson_url,
            "report_url"     : report_url
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Prediction failed during stage: %s", stage)
        return JSONResponse({"error": f"Prediction failed during {stage}: {e}"}, status_code=500)


@app.get("/results/{job_id}/geojson")
def get_job_geojson(job_id: str):
    """Return a retained local GeoJSON artifact for a prediction job."""
    path = os.path.join(GEOJSON_DIR, f"{job_id}_output.geojson")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="GeoJSON not found for this job")
    return FileResponse(path, media_type="application/geo+json")


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
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=False)