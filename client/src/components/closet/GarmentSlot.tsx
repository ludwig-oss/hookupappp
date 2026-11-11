import { useState } from 'react';
import type { GarmentSlot as Slot } from '../../lib/segmentGarment';

export default function GarmentSlot({
  url,
  title,
  onReject,
}: {
  url: string;
  slot: Slot;
  title: string;
  onReject?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <img
      className="wardrobe-garment"
      src={url}
      alt={title}
      onError={() => {
        setFailed(true);
        onReject?.();
      }}
    />
  );
}
