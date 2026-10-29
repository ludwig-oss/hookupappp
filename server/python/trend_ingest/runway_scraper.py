"""Fashion-show runway source.

This is a fixture reader, not a live site crawler. Do not point it at Pinterest,
Vogue Runway, or other sites without an official API and permission.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from .models import GarmentCategory, StructuredGarment


class FashionShowRunwayScraper:
    SHOWS: Dict[str, dict] = {
        "default": {
            "show_name": "City Tailoring SS",
            "looks": [
                {
                    "image_url": "https://images.unsplash.com/photo-1507680434567-5733a8ac0c46",
                    "celebrity_or_muse": None,
                    "garments": [
                        {"category": "top", "name": "Ivory blouse", "style_tags": ["tailored"]},
                        {"category": "bottom", "name": "Navy trouser", "style_tags": ["classic"]},
                    ],
                }
            ],
        },
        "plaid": {
            "show_name": "Prep Revival",
            "looks": [
                {
                    "image_url": "https://images.unsplash.com/photo-1594938298603-c8148c3817b1",
                    "celebrity_or_muse": "Clueless archive",
                    "garments": [
                        {"category": "top", "name": "Yellow plaid blazer", "style_tags": ["plaid", "90s preppy"]},
                        {"category": "bottom", "name": "Pleated plaid skirt", "style_tags": ["plaid", "preppy"]},
                    ],
                }
            ],
        },
    }

    def scrape_show(self, show_key: Optional[str] = None) -> dict:
        key = (show_key or "default").lower()
        if "plaid" in key or "prep" in key:
            key = "plaid"
        bundle = self.SHOWS.get(key, self.SHOWS["default"])
        looks = []
        for look in bundle["looks"]:
            garments = [
                StructuredGarment(
                    category=GarmentCategory(g["category"]),
                    name=g["name"],
                    style_tags=g.get("style_tags") or [],
                )
                for g in look["garments"]
            ]
            looks.append(
                {
                    "show_name": bundle["show_name"],
                    "image_url": look["image_url"],
                    "celebrity_or_muse": look.get("celebrity_or_muse"),
                    "garments": garments,
                }
            )
        return {"show_name": bundle["show_name"], "looks": looks}

    def look_for_image(self, image_url: str) -> Optional[dict]:
        blob = image_url.lower()
        show_key = "plaid" if "plaid" in blob or "1594938298603" in blob else "default"
        show = self.scrape_show(show_key)
        looks: List[dict] = show["looks"]
        return looks[0] if looks else None
