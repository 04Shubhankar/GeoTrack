---
title: GeoTrack Land Cover Segmentation
emoji: 🛰️
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
suggested_hardware: zero
---

# GeoTrack Hugging Face Space

Upload `unet_resnet34_803.pth` to this directory before pushing it to Hugging Face.

The Space accepts a satellite image and returns a six-class RGB segmentation mask.

Select **ZeroGPU** as the Space hardware. The `@spaces.GPU` decorator temporarily
allocates a GPU while `predict` runs and returns the model to CPU afterward.
