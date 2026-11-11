import { useEffect, useState } from 'react';
import { segmentGarment, type GarmentSlot as Slot } from '../../lib/segmentGarment';

export default function GarmentSlot({
  url,
  slot,
  title,
}: {
  url: string;
  slot: Slot;
  title: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    setSrc(null);
    setFailed(false);
    if (!url) {
      setFailed(true);
      return;
    }
    segmentGarment(url, slot)
      .then((next) => {
        if (!cancel) setSrc(next);
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [url, slot]);

  if (src) return <img className="chers-garment" src={src} alt={title} />;
  if (failed) return <div className="chers-missing">{title}</div>;
  return (
    <div className="chers-cutting" role="status">
      CUTTING CLOTH…
    </div>
  );
}
