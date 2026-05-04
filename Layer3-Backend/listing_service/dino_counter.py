"""
dino_counter.py

Uses Grounding DINO (zero-shot object detection) to count individual
food items in an image.
HOW IT WORKS:
  1. We give it a PIL Image + a text prompt e.g. "burger"
  2. DINO draws bounding boxes around every detected burger
  3. We count the boxes → that's the quantity
  4. If no boxes found, or food isn't countable, returns None

"""

from typing import Optional
import torch
from PIL import Image

DINO_MODEL_NAME = "IDEA-Research/grounding-dino-base"

BOX_THRESHOLD  = 0.35
TEXT_THRESHOLD = 0.25

class DINOCounter:
    """
    Loads Grounding DINO once and exposes a count() method.
    Usage:
        counter = DINOCounter()
        n = counter.count(pil_image, "burger")
        # n = 3 (found 3 burgers), or None if none found
    """
    def __init__(self, model_name: str = DINO_MODEL_NAME):

        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        print(f"Loading Grounding DINO ({model_name})...")
        
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(model_name)
        self.model.eval()
        print("Grounding DINO ready.")
    def count(self, image: Image.Image, prompt: str) -> Optional[int]:
        """
        Count instances of `prompt` visible in `image`.
        Args:
            image  : PIL Image (RGB)
            prompt : plain English description of what to count, e.g. "burger"
                     Should come from lookup_tables.py dino_prompt field.
        Returns:
            int  — number of detected instances (>= 1)
            None — if nothing detected or count is 0
        
        HOW DINO READS THE PROMPT:
          DINO expects the text prompt to end with a period.
          We strip any trailing period first then add one, so callers
          don't have to remember to include it.
        """
        if prompt is None:
            return None
        
        text = prompt.strip().rstrip(".") + "."
       
        inputs = self.processor(
            images=image,
            text=text,
            return_tensors="pt"
        )
        # Run DINO inference
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        results = self.processor.post_process_grounded_object_detection(
            outputs,
            input_ids=inputs.input_ids,
            threshold=BOX_THRESHOLD,       # transformers 5.x: box_threshold+text_threshold merged
            target_sizes=[image.size[::-1]]
        )
      
        boxes = results[0]["boxes"]
        count = len(boxes)
        
        return int(count) if count > 0 else None

_dino_instance = None
def get_dino_counter(model_name: str = DINO_MODEL_NAME) -> DINOCounter:
    """
    Get (or create) the global DINOCounter.
    Same singleton pattern as get_recognizer():  loads once, reused over n over
    """
    global _dino_instance
    if _dino_instance is None:
        _dino_instance = DINOCounter(model_name=model_name)
    return _dino_instance