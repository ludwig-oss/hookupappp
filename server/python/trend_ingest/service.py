"""Ingest an image URL: tag → Pinterest visual search → runway fixtures → trend table."""

from __future__ import annotations

import hashlib
from typing import List, Optional

from .image_tagger import ImageTaggingAI
from .models import (
    CelebrityAttribution,
    GarmentCategory,
    IngestedTrend,
    StructuredGarment,
    TrendSource,
)
from .pinterest_visual_search import MockPinterestVisualSearchAPI
from .repository import TrendRepository
from .runway_scraper import FashionShowRunwayScraper


class TrendIngestService:
    def __init__(
        self,
        tagger: Optional[ImageTaggingAI] = None,
        pinterest: Optional[MockPinterestVisualSearchAPI] = None,
        runway: Optional[FashionShowRunwayScraper] = None,
        repository: Optional[TrendRepository] = None,
    ):
        self.tagger = tagger or ImageTaggingAI()
        self.pinterest = pinterest or MockPinterestVisualSearchAPI()
        self.runway = runway or FashionShowRunwayScraper()
        self.repository = repository or TrendRepository()

    def ingest_image(
        self,
        image_url: str,
        *,
        source: TrendSource = TrendSource.PINTEREST,
        celebrity_name: Optional[str] = None,
        board_or_show_name: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> IngestedTrend:
        tagged = self.tagger.tag_image(image_url)
        garments = list(tagged.garments)

        pin_hits = self.pinterest.search_by_image(image_url)
        top_pin = pin_hits[0] if pin_hits else None
        runway_look = self.runway.look_for_image(image_url) if source == TrendSource.FASHION_SHOW else None

        if runway_look:
            garments.extend(runway_look["garments"])
            board_or_show_name = board_or_show_name or runway_look.get("show_name")
            celebrity_name = celebrity_name or runway_look.get("celebrity_or_muse")
            source_url = source_url or runway_look.get("image_url")

        if top_pin and not board_or_show_name:
            board_or_show_name = top_pin.board_name
        if top_pin and not source_url:
            source_url = top_pin.pin_url

        tops = self._by_category(garments, GarmentCategory.TOP)
        bottoms = self._by_category(garments, GarmentCategory.BOTTOM)
        accessories = self._by_category(garments, GarmentCategory.ACCESSORY) + self._by_category(
            garments, GarmentCategory.OUTERWEAR
        )
        styles = self._style_list(garments, tagged.tags)

        attribution = CelebrityAttribution(
            celebrity_name=celebrity_name,
            board_or_show_name=board_or_show_name,
            source_platform=source,
            source_url=source_url or image_url,
            credit_line=self._credit(celebrity_name, board_or_show_name, source),
        )

        row = IngestedTrend(
            id=self._id_for(image_url, source),
            image_url=image_url,
            source_platform=source,
            source_url=source_url or image_url,
            celebrity_name=celebrity_name,
            board_or_show_name=board_or_show_name,
            extracted_tags=list(dict.fromkeys(tagged.tags + styles)),
            tops=tops,
            bottoms=bottoms,
            styles=styles,
            accessories=accessories,
            image_embedding_vector=tagged.embedding,
            target_age_groups=self._age_groups(styles),
            attribution=attribution,
        )
        return self.repository.save(row)

    def _by_category(self, garments: List[StructuredGarment], category: GarmentCategory) -> List[StructuredGarment]:
        seen = set()
        out: List[StructuredGarment] = []
        for g in garments:
            if g.category != category or g.name in seen:
                continue
            seen.add(g.name)
            out.append(g)
        return out

    def _style_list(self, garments: List[StructuredGarment], tags: List[str]) -> List[str]:
        styles = [t for g in garments for t in g.style_tags]
        styles.extend(tags)
        return list(dict.fromkeys(styles))

    def _age_groups(self, styles: List[str]) -> List[str]:
        blob = " ".join(styles).lower()
        if "quiet luxury" in blob or "classic" in blob or "tailored" in blob:
            return ["twenty_thirty", "forty_plus"]
        if "90s" in blob or "preppy" in blob or "clubwear" in blob:
            return ["teen", "twenty_thirty"]
        return ["twenty_thirty"]

    def _credit(self, celebrity: Optional[str], board: Optional[str], source: TrendSource) -> str:
        who = celebrity or board or "unknown"
        return f"{who} via {source.value}"

    def _id_for(self, image_url: str, source: TrendSource) -> str:
        digest = hashlib.sha1(f"{source.value}:{image_url}".encode("utf-8")).hexdigest()[:16]
        return f"trend-{digest}"
