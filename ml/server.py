from pathlib import Path
from io import BytesIO
from typing import List, Optional

import torch
import torch.nn as nn
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse


app = FastAPI(title="Font Classifier API", version="0.1.0")


def get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def build_model(num_classes: int) -> nn.Module:
    from torchvision import models  # local import to speed startup if torchvision is heavy
    model = models.resnet50(weights=None)
    model.fc = nn.Sequential(
        nn.Dropout(p=0.2),
        nn.Linear(model.fc.in_features, num_classes),
    )
    return model


def load_checkpoint(ckpt_path: Path, device: torch.device):
    ckpt = torch.load(ckpt_path, map_location=device)
    if "model_state" not in ckpt or "classes" not in ckpt:
        raise ValueError("Checkpoint missing required keys: 'model_state' and 'classes'")
    return ckpt["model_state"], ckpt["classes"]


def make_transforms(img_size: int):
    from torchvision import transforms
    return transforms.Compose([
        transforms.Grayscale(3),
        transforms.Resize(int(img_size * 1.15), antialias=True),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


# Globals populated at startup
device: Optional[torch.device] = None
classes: Optional[List[str]] = None
model: Optional[nn.Module] = None
tfms = None


@app.on_event("startup")
def startup() -> None:
    global device, classes, model, tfms

    device = get_device()
    ckpt_path = Path(__file__).parent / "checkpoints" / "best.ckpt.pt"
    if not ckpt_path.exists():
        raise RuntimeError(f"Checkpoint not found: {ckpt_path}")

    state, cls = load_checkpoint(ckpt_path, device)
    classes = list(cls)
    model = build_model(num_classes=len(classes)).to(device)
    model.load_state_dict(state)
    model.eval()
    tfms = make_transforms(img_size=224)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/predict")
def predict(image: UploadFile = File(...)) -> JSONResponse:
    if model is None or classes is None or tfms is None or device is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file")

    try:
        raw = image.file.read()
        img = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    with torch.no_grad():
        batch = tfms(img).unsqueeze(0).to(device)
        logits = model(batch)
        probs = torch.softmax(logits, dim=1)[0]

        confs, idxs = torch.sort(probs, descending=True)
        confs = confs.cpu().tolist()
        idxs = idxs.cpu().tolist()

    # Print all predictions to stdout
    for rank, (conf, idx) in enumerate(zip(confs, idxs)):
        prefix = "*" if rank == 0 else " "
        print(f"{prefix} {classes[idx]:20s}  {conf:.4f}")

    top_idx = idxs[0]
    top_conf = float(confs[0])
    top_font = classes[top_idx]

    return JSONResponse({"font": top_font, "confidence": top_conf})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)