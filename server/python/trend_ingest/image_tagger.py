"""Image tagging AI adapter. Default is a heuristic mock; swap in a ViT later."""

from __future__ import annotations

from typing import List
from urllib.parse import unquote, urlparse

from .models import GarmentCategory, StructuredGarment, TaggedLook


def _hash_embedding(tokens: List[str], dims: int = 16) -> List[float]:
    vec = [0.0] * dims
    blob = "|".join(tokens).lower()
    for i, ch in enumerate(blob):
        vec[ord(ch) % dims] += (ord(ch) % 13) / 13.0
    mag = sum(v * v for v in vec) ** 0.5 or 1.0
    return [round(v / mag, 4) for v in vec]


class ImageTaggingAI:
    """Turns an image URL into structured tops / bottoms / styles."""

    KEYWORDS = {
        GarmentCategory.TOP: ("blazer", "crop", "tee", "shirt", "knit", "cami", "blouse", "hoodie"),
        GarmentCategory.BOTTOM: ("skirt", "jean", "trouser", "short", "pant", "midi"),
        GarmentCategory.OUTERWEAR: ("coat", "jacket", "trench"),
        GarmentCategory.SHOES: ("boot", "sneaker", "heel", "loafer", "sandal"),
        GarmentCategory.ACCESSORY: ("bag", "hoop", "belt", "hat", "sunglass"),
    }

    STYLE_WORDS = ("plaid", "preppy", "90s", "tailored", "streetwear", "quiet luxury", "clubwear", "classic")

    def tag_image(self, image_url: str) -> TaggedLook:
        hay = unquote(image_url).lower()
        path = urlparse(image_url).path.lower()
        blob = f"{hay} {path}"
        garments: List[StructuredGarment] = []
        tags: List[str] = []

        for category, words in self.KEYWORDS.items():
            for word in words:
                if word in blob:
                    tags.append(word)
                    garments.append(
                        StructuredGarment(
                            category=category,
                            name=word.title(),
                            style_tags=[word],
                        )
                    )

        for style in self.STYLE_WORDS:
            if style.replace(" ", "") in blob.replace(" ", "") or style in blob:
                tags.append(style)

        if not garments:
            garments = [
                StructuredGarment(category=GarmentCategory.TOP, name="Blazer", style_tags=["tailored"]),
                StructuredGarment(category=GarmentCategory.BOTTOM, name="Trouser", style_tags=["classic"]),
            ]
            tags.extend(["blazer", "trouser", "tailored"])

        unique_tags = list(dict.fromkeys(tags))
        return TaggedLook(
            image_url=image_url,
            tags=unique_tags,
            garments=garments,
            embedding=_hash_embedding(unique_tags),
        )
