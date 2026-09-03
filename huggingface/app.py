import gradio as gr
import numpy as np
import spaces
import torch
from PIL import Image

from backend.inference import load_model, predict as run_prediction


MODEL_PATH = "huggingface/unet_resnet34_803.pth"
model = load_model(MODEL_PATH)
cpu_device = torch.device("cpu")


@spaces.GPU(duration=60)
def predict_image(image):
    if image is None:
        raise gr.Error("Please upload a satellite image.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    try:
        prediction_mask, prediction_rgb, confidence = run_prediction(
            model, image, device
        )
        return (
            Image.fromarray(prediction_rgb),
            Image.fromarray(prediction_mask.astype(np.uint8), mode="L"),
            confidence,
        )
    finally:
        model.to(cpu_device)


demo = gr.Interface(
    fn=predict_image,
    inputs=gr.Image(type="pil", label="Satellite Image"),
    outputs=[
        gr.Image(type="pil", label="Land Cover Prediction"),
        gr.Image(type="pil", label="Class Mask", visible=False),
        gr.Number(label="Confidence", visible=False),
    ],
    api_name="predict",
    title="GeoTrack Land Cover Segmentation",
    description="Upload a satellite image to generate a land-cover segmentation map.",
)


if __name__ == "__main__":
    demo.launch(share=True)
