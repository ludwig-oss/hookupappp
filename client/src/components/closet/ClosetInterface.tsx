import type { ClosetGender, EquippedCloset } from '../../data/closetCatalog';
import type { WardrobeAudience } from '../../data/wardrobeCatalog';
import OutfitOptionCard from '../fashion/OutfitOptionCard';

export default function ClosetInterface({
  faceUrl,
  bodyUrl,
  skinTone: _skinTone,
  gender,
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
  const audience: WardrobeAudience | null = gender === 'fem' ? 'women' : gender === 'masc' ? 'men' : null;
  return (
    <OutfitOptionCard
      label="A"
      seed={1}
      avatarUrl={faceUrl || bodyUrl}
      personUrl={bodyUrl || faceUrl}
      audience={audience}
    />
  );
}
