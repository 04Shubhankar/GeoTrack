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

# ── Setup ─────────────────────────────────────────────
app   = FastAPI(title="GeoTrack API")
model = load_model()

UPLOAD_DIR = r"F:\GeoTrack\outputs\uploads"
RESULT_DIR = r"F:\GeoTrack\outputs\results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

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

        # Save original resized
        orig_path = os.path.join(RESULT_DIR, f"{job_id}_original.png")
        Image.open(img_path).convert("RGB")\
             .resize((256, 256)).save(orig_path)

        # Generate GeoJSON
        geojson      = mask_to_geojson(pred_mask, confidence, w, h)
        geojson_path = os.path.join(RESULT_DIR, f"{job_id}_output.geojson")
        save_geojson(geojson, geojson_path)

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

        return JSONResponse({
            "job_id"         : job_id,
            "confidence"     : confidence,
            "class_breakdown": class_pixels,
            "mask_url"       : f"/results/{job_id}_mask.png",
            "original_url"   : f"/results/{job_id}_original.png",
            "geojson_url"    : f"/results/{job_id}_output.geojson"
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/results/{filename}")
def get_result(filename: str):
    path = os.path.join(RESULT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return JSONResponse({"error": "File not found"}, status_code=404)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)