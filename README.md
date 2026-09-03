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

The repository pins Render to Python 3.11.9 in `runtime.txt`. This avoids
building `pydantic-core` from Rust on Python 3.14.