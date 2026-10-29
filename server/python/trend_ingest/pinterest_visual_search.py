"""Mock Pinterest Visual Search API — no live Pinterest calls."""

from __future__ import annotations

from typing import List

from .models import PinterestVisualHit


class MockPinterestVisualSearchAPI:
    """Returns canned visually similar pins for an image URL."""

    CATALOG = [
        PinterestVisualHit(
            pin_url="https://pinterest.example/pin/clueless-plaid",
            image_url="https://images.unsplash.com/photo-1594938298603-c8148c3817b1",
            board_name="90s preppy",
            score=0.91,
        ),
        PinterestVisualHit(
            pin_url="https://pinterest.example/pin/quiet-luxury",
            image_url="https://images.unsplash.com/photo-1507680434567-5733a8ac0c46",
            board_name="Quiet luxury",
            score=0.74,
        ),
        PinterestVisualHit(
            pin_url="https://pinterest.example/pin/street-tee",
            image_url="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
            board_name="Club streetwear",
            score=0.62,
        ),
    ]

    def search_by_image(self, image_url: str, limit: int = 5) -> List[PinterestVisualHit]:
        ranked = sorted(self.CATALOG, key=lambda hit: self._overlap(image_url, hit), reverse=True)
        return ranked[: max(1, min(limit, len(ranked)))]

    def _overlap(self, image_url: str, hit: PinterestVisualHit) -> float:
        a = image_url.lower()
        b = f"{hit.image_url} {hit.board_name}".lower()
        score = hit.score
        for token in ("plaid", "blazer", "luxury", "tee", "street"):
            if token in a and token in b:
                score += 0.05
        return score
