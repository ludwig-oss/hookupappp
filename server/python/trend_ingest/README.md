# Trend ingest (Python)

Takes an image URL, tags it, queries a **mock** Pinterest visual search, optionally merges a **fixture** runway look, and writes `ingested_trends`.

Live scraping of Pinterest or Vogue Runway is not implemented.

```python
from trend_ingest.service import TrendIngestService
from trend_ingest.models import TrendSource

svc = TrendIngestService()
row = svc.ingest_image(
    "https://images.unsplash.com/photo-1594938298603-c8148c3817b1",
    source=TrendSource.PINTEREST,
    celebrity_name="Clueless archive",
)
```

Set `DATABASE_URL` to save into Postgres (migration `002_ingested_trends.sql`). Without it, rows go to `server/data/ingested-trends.json`.
