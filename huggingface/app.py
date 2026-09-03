import gradio as gr
import numpy as np
import spaces
import torch
from PIL import Image

from backend.inference import load_model, predict as run_prediction


NUM_CLASSES = 6
MODEL_PATH = "huggingface/unet_resnet34_803.pth"
model, cpu_device = load_model(MODEL_PATH)


@spaces.GPU(duration=60)
def predict_image(image):
    if image is None:
        raise gr.Error("Please upload a satellite image.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    try:
        _, prediction_rgb, _ = run_prediction(model, image, device)
        return Image.fromarray(prediction_rgb)
    finally:
        model.to(cpu_device)


demo = gr.Interface(
    fn=predict_image,
    inputs=gr.Image(type="pil", label="Satellite Image"),
    outputs=gr.Image(type="pil", label="Land Cover Prediction"),
    title="GeoTrack Land Cover Segmentation",
    description="Upload a satellite image to generate a land-cover segmentation map.",
)


if __name__ == "__main__":
    demo.launch()
