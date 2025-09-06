import argparse
from pathlib import Path
from typing import List

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


def get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def build_model(num_classes: int) -> nn.Module:
    model = models.resnet50(weights=None)
    model.fc = nn.Sequential(nn.Dropout(p=0.2), nn.Linear(model.fc.in_features, num_classes))
    return model


def load_checkpoint(ckpt_path: Path, device: torch.device):
    ckpt = torch.load(ckpt_path, map_location=device)
    if "model_state" not in ckpt or "classes" not in ckpt:
        raise ValueError("Checkpoint missing required keys: 'model_state' and 'classes'")
    return ckpt["model_state"], ckpt["classes"]


def make_transforms(img_size: int) -> transforms.Compose:
    return transforms.Compose([
        transforms.Grayscale(3),
        transforms.Resize(int(img_size * 1.15), antialias=True),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def load_images(paths: List[Path]) -> List[Image.Image]:
    images = []
    for p in paths:
        img = Image.open(p).convert("RGB")
        images.append(img)
    return images


def main():
    parser = argparse.ArgumentParser(description="Font classifier inference")
    parser.add_argument("--ckpt", type=Path, required=True, help="Path to best.ckpt.pt")
    parser.add_argument("--image", type=Path, action="append", required=True,
                        help="Image path (repeat for multiple)")
    parser.add_argument("--topk", type=int, default=5, help="Show top-K predictions")
    parser.add_argument("--img-size", type=int, default=224, help="Model input size")
    parser.add_argument("--device", type=str, choices=["auto", "cpu", "cuda", "mps"], default="auto")
    args = parser.parse_args()

    # Resolve device
    if args.device == "auto":
        device = get_device()
    else:
        device = torch.device(args.device)

    # Load checkpoint/classes
    state, classes = load_checkpoint(args.ckpt, device)
    model = build_model(num_classes=len(classes)).to(device)
    model.load_state_dict(state)
    model.eval()

    # Preprocess
    tfms = make_transforms(args.img_size)
    img_paths = [p for p in args.image if p.exists()]
    if not img_paths:
        raise SystemExit("No valid image paths provided.")

    batch = torch.stack([tfms(Image.open(p).convert("RGB")) for p in img_paths]).to(device)

    with torch.no_grad():
        logits = model(batch)
        probs = torch.softmax(logits, dim=1)
        confs, idxs = probs.topk(k=min(args.topk, len(classes)), dim=1)

    # Print results
    for i, p in enumerate(img_paths):
        print(f"\n{p}:")
        for k in range(confs.size(1)):
            cls = classes[idxs[i, k].item()]
            conf = float(confs[i, k].item())
            prefix = "*" if k == 0 else " "
            print(f"{prefix} {cls:20s}  {conf:.4f}")


if __name__ == "__main__":
    main()
