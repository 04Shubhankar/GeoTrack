import os
from pathlib import Path

import numpy as np
from gradio_client import Client, handle_file
from PIL import Image


SPACE_ID = os.getenv("HF_SPACE_ID")
HF_TOKEN = os.getenv("HF_TOKEN")


def _file_path(value):
    if isinstance(value, dict):
        return value.get("path") or value.get("url")
    return value


def predict_remote(image_path: str):
    if not SPACE_ID:
        raise RuntimeError("HF_SPACE_ID is not configured")

    client = Client(SPACE_ID, hf_token=HF_TOKEN or None)
    result = client.predict(handle_file(image_path), api_name="/predict")

    if not isinstance(result, (tuple, list)) or len(result) != 3:
        raise RuntimeError("Hugging Face returned an unexpected prediction response")

    rgb_path = _file_path(result[0])
    mask_path = _file_path(result[1])
    confidence = float(result[2])
    if not rgb_path or not mask_path:
        raise RuntimeError("Hugging Face did not return prediction mask files")

    prediction_rgb = np.array(Image.open(Path(rgb_path)).convert("RGB"))
    prediction_mask = np.array(Image.open(Path(mask_path)).convert("L"))
    return prediction_mask, prediction_rgb, confidence