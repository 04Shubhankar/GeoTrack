import gradio as gr
import numpy as np
import spaces
import torch
from PIL import Image
import segmentation_models_pytorch as smp


NUM_CLASSES = 6
MODEL_PATH = "huggingface/unet_resnet34_803.pth"
INPUT_SIZE = 256

CLASS_COLORS = np.array([
    [0, 255, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 255],
], dtype=np.uint8)


def load_model():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = smp.Unet(
        encoder_name="resnet34",
        encoder_weights=None,
        in_channels=3,
        classes=NUM_CLASSES,
        activation=None,
    )
    checkpoint = torch.load(MODEL_PATH, map_location=device)
    state_dict = checkpoint.get("state_dict", checkpoint)
    state_dict = {
        key.replace("module.", "", 1): value
        for key, value in state_dict.items()
    }
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model, device


model, cpu_device = load_model()


@spaces.GPU(duration=60)
def predict(image):
    if image is None:
        raise gr.Error("Please upload a satellite image.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    try:
        original_size = image.size
        image_array = np.array(image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE)))
        tensor = torch.from_numpy(image_array.transpose(2, 0, 1)).float() / 255.0
        tensor = tensor.unsqueeze(0).to(device)

        with torch.no_grad():
            probabilities = torch.softmax(model(tensor), dim=1)
            prediction = torch.argmax(probabilities, dim=1).squeeze(0).cpu().numpy()

        mask = Image.fromarray(CLASS_COLORS[prediction])
        return mask.resize(original_size, Image.Resampling.NEAREST)
    finally:
        model.to(cpu_device)


demo = gr.Interface(
    fn=predict,
    inputs=gr.Image(type="pil", label="Satellite Image"),
    outputs=gr.Image(type="pil", label="Land Cover Prediction"),
    title="GeoTrack Land Cover Segmentation",
    description="Upload a satellite image to generate a land-cover segmentation map.",
)


if __name__ == "__main__":
    demo.launch()
