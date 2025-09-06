# Font Detection - Minimal Quickstart

Detect the font of rendered text images. Generate synthetic data with Playwright + Google Fonts, then train a ResNet classifier.

## TL;DR

```bash
# setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
# install torch/vision for your platform
pip install torch torchvision  # or CUDA wheels from pytorch.org

# generate dataset into ./data/
python render_phrases.py

# open and run a notebook (choose one)
# - train.ipynb   (ResNet-18, fast)
# - train2.ipynb  (ResNet-50, longer, early stop)
```

## Data layout (expected)

```
data/
  Inter/            # class folder
  Roboto/
  ...
```

`render_phrases.py` creates this automatically using Google Fonts.

## Inference (CLI)

```bash
# single image
python inference.py --ckpt runs/font_densenet/best.ckpt.pt --image path/to/image.png

# multiple images
python inference.py --ckpt runs/font_densenet/best.ckpt.pt \
  --image img1.png --image img2.png --image img3.png

# options
python inference.py --ckpt ... --image ... --topk 5 --img-size 224 --device auto|cpu|cuda|mps
```

## Notes

- First run downloads a Chromium runtime via Playwright.
- `render_phrases.py` clears `./data` before writing; comment it out to append.
- On restart, load your checkpoint before evaluating (or re-run training).
- ResNet head is `fc` (not `classifier`). Keep `fc` trainable during warmup.
- CUDA AMP warning: use `torch.amp.GradScaler('cuda', enabled=...)`.

## License

MIT
