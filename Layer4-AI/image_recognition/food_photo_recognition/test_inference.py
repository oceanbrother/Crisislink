'''
test_inference.py

PURPOSE: Prove that the ConvNeXt model weights work before  wiring them to the project

'''
import sys
import json
from pathlib import Path
import torch
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image

#path to directory where the trained convonext model weights are stored
m_dir = Path(__file__).parent / "models"
wgths_pth = m_dir / "best_food101_convnext.pth"
classes_pth = m_dir / "classes.json"

N_CLASSES = 101  # Food-101 dataset has 101 classes

# ====== PIPELINE PROCESSING ======

eval_transforms = transforms.Compose([
    transforms.Resize(256),          # scale shorter side to 256 (keeps aspect ratio)
    transforms.CenterCrop(224),      # cut centre 224x224 square
    transforms.ToTensor(),           # PIL image → tensor, values 0.0–1.0
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  # ImageNet mean per channel
        std=[0.229, 0.224, 0.225]    # ImageNet std per channel
    ),
])

# ====== DATA MODEL LOAD UP======
def load_model(wgths_pth):
    '''
    Reconstruct the same ConvNeXt-Tiny architecture used in training,
    then load the saved weights into it.
    '''
    ss_model = models.convnext_tiny(weights=None)
    ss_model.classifier[2] = torch.nn.Linear(768, N_CLASSES)

    state_dict = torch.load(wgths_pth, map_location="cpu")
    ss_model.load_state_dict(state_dict)
    ss_model.eval()

    print(f"Model loader from {wgths_pth}")
    return ss_model

# ====== RUN INFERENCE ======
def predict(model, img_path, classes, top_k=3):
    '''
    TEST RUN: run a single image inference through the model and get top k (3)
    predictions to test recognition capability
    '''
    img = Image.open(img_path).convert("RGB")

    tensor = eval_transforms(img).unsqueeze(0)

    with torch.no_grad():
        logits = model(tensor)                              # raw scores, shape (1, 101)
        probs = F.softmax(logits, dim=1)                   # probabilities, sum to 1.0

        # BUG FIX: torch.topk was missing — this finds the top-k values + their positions
        top_probs, top_indices = torch.topk(probs, k=top_k, dim=1)

        top_probs   = top_probs[0].tolist()    # BUG FIX: .tolist() not .toList()
        top_indices = top_indices[0].tolist()  # BUG FIX: same

    results = [
        (classes[idx], prob)
        for idx, prob in zip(top_indices, top_probs)
    ]
    return results

# ====== MAIN EXECUTION ======
if __name__ == "__main__":    # BUG FIX: == not 'in'
    if len(sys.argv) < 2:
        print("Usage: python test_inference.py path/to/food_image.jpg")
        sys.exit(1)

    img_path = sys.argv[1]

    with open(classes_pth) as f:
        classes = json.load(f)

    model = load_model(wgths_pth)

    results = predict(model, img_path, classes, top_k=3)

    print(f"\nTop-3 predictions:")
    for rank, (class_name, confidence) in enumerate(results, start=1):  # BUG FIX: rank, (...)
        print(f"  {rank}. {class_name:<25} {confidence * 100:.2f}%")    # BUG FIX: :.2f not :.f
