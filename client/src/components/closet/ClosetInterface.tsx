import type { ClosetGender, EquippedCloset } from '../../data/closetCatalog';
import CluelessClosetApp from './CluelessClosetApp';

export default function ClosetInterface({
  faceUrl: _faceUrl,
  bodyUrl,
  skinTone: _skinTone,
  gender: genderProp,
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
  const gender: ClosetGender = genderProp === 'fem' ? 'fem' : 'masc';
  return <CluelessClosetApp gender={gender} bodyUrl={bodyUrl} />;
}
