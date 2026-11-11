import { useEffect, useRef, useState } from 'react';
import { GarmentRejected, segmentGarment, type GarmentSlot as Slot } from '../../lib/segmentGarment';

export default function GarmentSlot({
  url,
  slot,
  title,
  onReject,
}: {
  url: string;
  slot: Slot;
  title: string;
  onReject?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const rejectRef = useRef(onReject);
  rejectRef.current = onReject;

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
      .catch((err: unknown) => {
        if (cancel) return;
        setFailed(true);
        if (err instanceof GarmentRejected) rejectRef.current?.();
      });
    return () => {
      cancel = true;
    };
  }, [url, slot]);

  if (src) return <img className="fancy-garment" src={src} alt={title} />;
  if (failed) return null;
  return <div className="fancy-wait"> </div>;
}
