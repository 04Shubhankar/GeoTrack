# backend/vectorize.py

import numpy as np
import json
from shapely.geometry import shape, mapping
from rasterio.features import shapes
from rasterio.transform import from_bounds
import warnings
warnings.filterwarnings("ignore")

CLASS_NAMES = [
    "urban_land", "agriculture_land", "rangeland",
    "forest_land", "water", "barren_land"
]

def mask_to_geojson(
    pred_mask: np.ndarray,
    confidence: float,
    image_width: int,
    image_height: int,
    bounds: tuple = (0, 0, 1, 1)  # (left, bottom, right, top)
) -> dict:
    """
    Converts prediction mask to GeoJSON FeatureCollection.
    
    pred_mask  : HxW numpy array of class indices
    confidence : mean confidence score from inference
    bounds     : geographic bounds (left, bottom, right, top)
                 defaults to normalized 0-1 if no real CRS available
    """

    # Affine transform — maps pixel coords to geographic coords
    transform = from_bounds(
        bounds[0], bounds[1],
        bounds[2], bounds[3],
        image_width, image_height
    )

    features = []

    # Vectorize each class separately
    for class_idx in range(6):
        # Binary mask for this class
        binary_mask = (pred_mask == class_idx).astype(np.uint8)

        if binary_mask.sum() == 0:
            continue  # skip classes not present

        # Convert to polygons
        for geom, val in shapes(binary_mask, transform=transform):
            if val == 0:
                continue  # skip background

            polygon = shape(geom)

            if not polygon.is_valid or polygon.area < 0.0001:
                continue  # skip tiny/invalid polygons

            feature = {
                "type"      : "Feature",
                "geometry"  : mapping(polygon),
                "properties": {
                    "class_id"   : class_idx,
                    "class_name" : CLASS_NAMES[class_idx],
                    "confidence" : confidence,
                    "area_units" : round(polygon.area, 6),
                    "qc_flag"    : "review" if confidence < 0.65
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