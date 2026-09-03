# backend/inference.py

import torch
import numpy as np
from pathlib import Path
from PIL import Image
import segmentation_models_pytorch as smp
import albumentations as A
from albumentations.pytorch import ToTensorV2

# ── Config ────────────────────────────────────────────
MODEL_PATH  = Path(__file__).resolve().parents[1] / "model" / "unet_resnet34_803.pth"
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TILE_SIZE   = 256
NUM_CLASSES = 6

CLASS_COLORS = {
    0: (0,   255, 255),  # urban_land
    1: (255, 255,   0),  # agriculture_land
    2: (255,   0, 255),  # rangeland
    3: (0,   255,   0),  # forest_land
    4: (0,     0, 255),  # water
    5: (255, 255, 255),  # barren_land
}

CLASS_NAMES = [
    "urban_land", "agriculture_land", "rangeland",
    "forest_land", "water", "barren_land"
]

def load_model(model_path=MODEL_PATH):
    model = smp.Unet(
        encoder_name    = "resnet34",  # must match training
        encoder_weights = None,
        in_channels     = 3,
        classes         = NUM_CLASSES,
        activation      = None
    )

    state_dict = torch.load(model_path, map_location=DEVICE)

    # Strip DataParallel 'module.' prefix added during Kaggle training
    state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}

    model.load_state_dict(state_dict)
    model.to(DEVICE)
    model.eval()
    print(f"Model loaded on {DEVICE}")
    return model

# ── Predict ───────────────────────────────────────────
def predict(model, image_source, device=None):
    """
    Takes image path → returns:
    - pred_mask  : HxW numpy array (class indices)
    - pred_rgb   : HxWx3 numpy array (colorized)
    - confidence : float (mean max softmax probability)
    """
    device = device or DEVICE

    # Accept both uploaded file paths and images supplied by Gradio.
    if isinstance(image_source, Image.Image):
        img = np.array(image_source.convert("RGB"))
    else:
        img = np.array(Image.open(image_source).convert("RGB"))
    h, w = img.shape[:2]

    # Resize to 256x256
    img_resized = np.array(
        Image.fromarray(img).resize((TILE_SIZE, TILE_SIZE))
    )

    # Preprocess
    transform = A.Compose([
        A.Normalize(mean=(0.485, 0.456, 0.406),
                    std=(0.229, 0.224, 0.225)),
        ToTensorV2()
    ])
    tensor = transform(image=img_resized)["image"]\
             .unsqueeze(0).to(device)

    # Inference
    with torch.no_grad():
        output     = model(tensor)
        probs      = torch.softmax(output, dim=1)
        pred_class = torch.argmax(probs, dim=1)\
                     .squeeze().cpu().numpy()
        confidence = probs.max(dim=1).values\
                     .mean().item()

    # Colorize prediction
    pred_rgb = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.uint8)
    for cls, color in CLASS_COLORS.items():
        pred_rgb[pred_class == cls] = color

    # Resize back to original
    pred_rgb_full = np.array(
        Image.fromarray(pred_rgb).resize((w, h), Image.NEAREST)
    )
    pred_mask_full = np.array(
        Image.fromarray(pred_class.astype(np.uint8))\
             .resize((w, h), Image.NEAREST)
    )

    return pred_mask_full, pred_rgb_full, round(confidence, 4)