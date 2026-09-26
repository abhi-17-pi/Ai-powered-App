import base64
import os
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from django.conf import settings

from .ai_service import reload_env


class ImageGenerationError(Exception):
    """A safe, user-facing error raised when an image cannot be generated."""


def generate_image_file(prompt):
    """
    Generate an image from prompt and return its path relative to MEDIA_ROOT.
    Uses free high-speed AI image generation (Pollinations AI Flux / Stable Diffusion)
    with seamless fallback, and supports OpenAI DALL-E if OPENAI_API_KEY is configured.
    """
    reload_env()
    cleaned_prompt = (prompt or "").strip()
    if not cleaned_prompt:
        raise ImageGenerationError("Please describe the image you want to create.")

    image_bytes = None
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    # 1. If user configured OPENAI_API_KEY, attempt OpenAI image generation first
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key, timeout=60.0)
            model_name = os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3").strip() or "dall-e-3"
            response = client.images.generate(
                model=model_name,
                prompt=cleaned_prompt,
                size="1024x1024",
                response_format="b64_json",
            )
            image_base64 = response.data[0].b64_json
            image_bytes = base64.b64decode(image_base64, validate=True)
            print(f"[ImageService] Generated via OpenAI ({model_name})")
        except Exception as err:
            print(f"[ImageService] OpenAI image generation failed: {err}. Falling back to free AI engine...")
            image_bytes = None

    # 2. Free High-Speed AI Image Generation (Pollinations AI)
    if not image_bytes:
        encoded_prompt = urllib.parse.quote(cleaned_prompt)
        urls_to_try = [
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true",
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=768&height=768",
            f"https://image.pollinations.ai/prompt/{encoded_prompt}",
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=turbo",
        ]

        last_error = None
        for url in urls_to_try:
            try:
                print(f"[ImageService] Generating free image with prompt: {cleaned_prompt[:40]}...")
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                    },
                )
                with urllib.request.urlopen(req, timeout=35.0) as res:
                    if res.status == 200:
                        data = res.read()
                        if len(data) > 1000:
                            image_bytes = data
                            print(f"[ImageService] Image generated successfully ({len(image_bytes)} bytes)")
                            break
            except Exception as e:
                print(f"[ImageService] Attempt error ({e}), trying next fallback...")
                last_error = e

    if not image_bytes:
        raise ImageGenerationError(
            f"Could not generate image right now. Please try again with a simpler or different prompt."
        )

    generated_dir = Path(settings.MEDIA_ROOT) / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    (generated_dir / filename).write_bytes(image_bytes)

    return f"generated/{filename}"

