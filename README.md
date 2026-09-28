---
title: GeoTrack API
emoji: 🛰️
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 5.49.1
app_file: huggingface/app.py
pinned: false
---
<div align="center">
  <img width="364" height="355" alt="GeoTrack" src="https://github.com/user-attachments/assets/42a7c773-698c-4f76-ad1a-c2d273ff6f03" />

  # 🛰️ GeoTrack
</div>

Digitize orthophotos and satellite imagery into GIS-ready outputs — automatically.

[Live Demo](https://geo-track-coral.vercel.app) • [How It Works](#how-it-works)

---

## The Problem

Mapping land use from satellite imagery is slow and expensive:

- Manual digitization takes hours per image
- Requires trained GIS professionals
- Inconsistent output quality across operators
- Tools like QGIS demand expertise just to get started

**Result: A bottleneck between raw imagery and actionable geospatial data.**

---

## The Solution

Upload an image. AI segments it. Get GeoJSON and a PDF report in seconds.
No manual tracing. No GIS expertise required.

---

## Features

- 🖼️ Upload orthophotos or select from satellite imagery
- 🤖 AI-powered LULC feature extraction
- 🗺️ GeoJSON export — ready for QGIS, ArcGIS, Google Earth Engine
- 📄 Automated PDF report generation
- ☁️ Cloud storage via Supabase

---

## How It Works

1. **Upload or Select** — Upload an orthophoto directly, or draw/select an area on the map to fetch satellite imagery
2. **AI Segments** — Model identifies and classifies Land Use / Land Cover features
3. **Export** — Download GeoJSON for GIS tools or a PDF report for documentation

---

## Try It Now

Live Demo: [geo-track-coral.vercel.app](https://geo-track-coral.vercel.app)
No signup. Just upload and generate.

---

## Built With

- **Backend:** Python + FastAPI (Render)
- **Model:** Segmentation model via Gradio (HuggingFace Space)
- **Frontend:** HTML / CSS / JS (Vercel)
- **Storage:** Supabase

---
# GeoTrack hosted architecture

The Hugging Face Space runs `huggingface/app.py` and hosts the model. The
Render service runs `backend/app.py`, calls the Space using `HF_SPACE_ID`, and
handles GeoJSON, PDF reports, Supabase storage, and the frontend.

Configure these Render environment variables:

- `HF_SPACE_ID`: Hugging Face Space ID, such as `username/geotrack`
- `HF_TOKEN`: optional token if the Space is private
- `SUPABASE_URL`
- `SUPABASE_KEY`

Use this Render start command from the repository root:

```text
uvicorn backend.app:app --host 0.0.0.0 --port $PORT
```
> If Render ignores `runtime.txt`, set `PYTHON_VERSION=3.11.9` manually to avoid build failures.

---

## Connect

[LinkedIn](https://www.linkedin.com/in/shubhankarbhide/) | [GitHub](https://github.com/04Shubhankar)
