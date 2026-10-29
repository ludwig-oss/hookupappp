from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TrendSource(str, Enum):
    PINTEREST = "pinterest"
    FASHION_SHOW = "fashion_show"
    CELEBRITY = "celebrity_streetwear"


class GarmentCategory(str, Enum):
    TOP = "top"
    BOTTOM = "bottom"
    OUTERWEAR = "outerwear"
    SHOES = "shoes"
    ACCESSORY = "accessory"


def _enum_dict(obj: Any) -> Any:
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, list):
        return [_enum_dict(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _enum_dict(v) for k, v in obj.items()}
    if hasattr(obj, "__dataclass_fields__"):
        return _enum_dict(asdict(obj))
    return obj


@dataclass
class StructuredGarment:
    category: GarmentCategory
    name: str
    color: Optional[str] = None
    style_tags: List[str] = field(default_factory=list)


@dataclass
class CelebrityAttribution:
    celebrity_name: Optional[str]
    board_or_show_name: Optional[str]
    source_platform: TrendSource
    source_url: Optional[str]
    credit_line: str = ""


@dataclass
class TaggedLook:
    image_url: str
    tags: List[str] = field(default_factory=list)
    garments: List[StructuredGarment] = field(default_factory=list)
    embedding: List[float] = field(default_factory=list)


@dataclass
class IngestedTrend:
    id: str
    image_url: str
    source_platform: TrendSource
    extracted_tags: List[str]
    tops: List[StructuredGarment]
    bottoms: List[StructuredGarment]
    styles: List[str]
    accessories: List[StructuredGarment]
    image_embedding_vector: List[float]
    target_age_groups: List[str]
    attribution: CelebrityAttribution
    source_url: Optional[str] = None
    celebrity_name: Optional[str] = None
    board_or_show_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return _enum_dict(self)


@dataclass
class PinterestVisualHit:
    pin_url: str
    image_url: str
    board_name: Optional[str] = None
    score: float = 0.0
