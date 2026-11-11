import type { ClosetGender, EquippedCloset } from '../../data/closetCatalog';
import OutfitOptionCard from '../fashion/OutfitOptionCard';

export default function ClosetInterface({
  faceUrl,
  bodyUrl,
  skinTone: _skinTone,
  gender: _gender,
  outfitHint: _outfitHint,
  onEquipChange: _onEquipChange,
}: {
  faceUrl?: string | null;
  bodyUrl?: string | null;
  skinTone?: string;
  gender?: ClosetGender;
  outfitHint?: { top?: string; bottom?: string; outer?: string; shoeColor?: string };
  onEquipChange?: (eq: EquippedCloset) => void;
}) {
  return (
    <OutfitOptionCard
      label="A"
      seed={1}
      avatarUrl={faceUrl || bodyUrl}
      personUrl={bodyUrl || faceUrl}
    />
  );
}
