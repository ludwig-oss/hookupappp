"""Persist ingested trends to Postgres `ingested_trends`, or a local JSON file."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from .models import IngestedTrend

JSON_FALLBACK = Path(__file__).resolve().parents[2] / "data" / "ingested-trends.json"


class TrendRepository:
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.environ.get("DATABASE_URL")

    def save(self, row: IngestedTrend) -> IngestedTrend:
        if self.database_url and self._is_postgres(self.database_url):
            self._save_postgres(row)
            return row
        self._save_json(row)
        return row

    def _is_postgres(self, url: str) -> bool:
        return urlparse(url).scheme.startswith("postgres")

    def _save_postgres(self, row: IngestedTrend) -> None:
        try:
            import psycopg2
        except ImportError as exc:
            raise RuntimeError("psycopg2 is required to write ingested_trends") from exc

        payload = row.to_dict()
        sql = """
        INSERT INTO ingested_trends (
          id, image_url, source_platform, source_url, celebrity_name, board_or_show_name,
          extracted_tags, tops, bottoms, styles, accessories, image_embedding_vector,
          target_age_groups, attribution
        ) VALUES (
          %(id)s, %(image_url)s, %(source_platform)s, %(source_url)s, %(celebrity_name)s,
          %(board_or_show_name)s, %(extracted_tags)s, %(tops)s, %(bottoms)s, %(styles)s,
          %(accessories)s, %(image_embedding_vector)s, %(target_age_groups)s, %(attribution)s
        )
        ON CONFLICT (id) DO UPDATE SET
          extracted_tags = EXCLUDED.extracted_tags,
          tops = EXCLUDED.tops,
          bottoms = EXCLUDED.bottoms,
          styles = EXCLUDED.styles,
          accessories = EXCLUDED.accessories,
          celebrity_name = EXCLUDED.celebrity_name,
          attribution = EXCLUDED.attribution
        """
        params = {
            "id": payload["id"],
            "image_url": payload["image_url"],
            "source_platform": payload["source_platform"],
            "source_url": payload.get("source_url"),
            "celebrity_name": payload.get("celebrity_name"),
            "board_or_show_name": payload.get("board_or_show_name"),
            "extracted_tags": payload["extracted_tags"],
            "tops": json.dumps(payload["tops"]),
            "bottoms": json.dumps(payload["bottoms"]),
            "styles": json.dumps(payload["styles"]),
            "accessories": json.dumps(payload["accessories"]),
            "image_embedding_vector": payload["image_embedding_vector"],
            "target_age_groups": payload["target_age_groups"],
            "attribution": json.dumps(payload["attribution"] if isinstance(payload["attribution"], dict) else payload["attribution"]),
        }
        conn = psycopg2.connect(self.database_url)
        try:
            with conn, conn.cursor() as cur:
                cur.execute("SELECT set_config('app.bypass_rls', 'true', true)")
                cur.execute(sql, params)
        finally:
            conn.close()

    def _save_json(self, row: IngestedTrend) -> None:
        JSON_FALLBACK.parent.mkdir(parents=True, exist_ok=True)
        existing = []
        if JSON_FALLBACK.exists():
            existing = json.loads(JSON_FALLBACK.read_text(encoding="utf-8") or "[]")
        body = row.to_dict()
        existing = [r for r in existing if r.get("id") != row.id]
        existing.append(body)
        JSON_FALLBACK.write_text(json.dumps(existing, indent=2), encoding="utf-8")
