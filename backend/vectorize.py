# backend/vectorize.py

import json
import warnings

import numpy as np
from shapely.geometry import shape, mapping
from rasterio.features import shapes
from rasterio.transform import from_bounds

warnings.filterwarnings("ignore")

CLASS_NAMES = [
    "urban_land", "agriculture_land", "rangeland",
    "forest_land", "water", "barren_land"
]

def mask_to_geojson(
    pred_mask: np.ndarray,
    confidence: float | np.ndarray | None = None,
    image_width: int | None = None,
    image_height: int | None = None,
    bounds: tuple[float, float, float, float] = (0, 0, 1, 1),
    valid_mask: np.ndarray | None = None
) -> dict:
    """
    Converts prediction mask to GeoJSON FeatureCollection.
    
    pred_mask  : HxW numpy array of class indices
    confidence : mean confidence score or per-pixel confidence map
    bounds     : geographic bounds (left, bottom, right, top)
                 defaults to normalized 0-1 if no real CRS available
    """

    height, width = pred_mask.shape
    image_width = image_width or width
    image_height = image_height or height

    # Affine transform maps pixel coordinates to geographic coordinates.
    transform = from_bounds(
        bounds[0], bounds[1],
        bounds[2], bounds[3],
        image_width, image_height
    )

    features = []

    # Vectorize each class separately
    for class_idx, class_name in enumerate(CLASS_NAMES):
        # Binary mask for this class
        binary_mask = pred_mask == class_idx
        if valid_mask is not None:
            binary_mask &= valid_mask
        binary_mask = binary_mask.astype(np.uint8)

        if binary_mask.sum() == 0:
            continue  # skip classes not present

        # Convert to polygons
        for geom, val in shapes(binary_mask, transform=transform):
            if val == 0:
                continue  # skip background

            polygon = shape(geom)

            if not polygon.is_valid or polygon.area < 0.0001:
                continue  # skip tiny/invalid polygons

            class_confidence = confidence
            if isinstance(confidence, np.ndarray):
                class_pixels = confidence[pred_mask == class_idx]
                class_confidence = float(np.mean(class_pixels)) if class_pixels.size else None

            feature = {
                "type"      : "Feature",
                "geometry"  : mapping(polygon),
                "properties": {
                    "class_id"   : class_idx,
                    "class_idx"  : class_idx,
                    "class"      : class_name,
                    "class_name" : class_name,
                    "confidence" : round(float(class_confidence), 4)
                                   if class_confidence is not None else None,
                    "area_units" : round(polygon.area, 6),
                    "area_m2"     : round(polygon.area * 111000 ** 2, 2),
                    "qc_flag"    : "review" if class_confidence is not None
                                   and float(class_confidence) < 0.65
                                   else "ok"
                }
            }
            features.append(feature)

    geojson = {
        "type"    : "FeatureCollection",
        "features": features
    }

    return geojson


def save_geojson(geojson: dict, output_path: str):
    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"GeoJSON saved → {output_path}")