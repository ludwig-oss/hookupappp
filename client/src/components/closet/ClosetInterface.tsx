import type { ClosetGender, EquippedCloset } from '../../data/closetCatalog';
import OutfitStage from './OutfitStage';

export default function ClosetInterface({
  faceUrl: _faceUrl,
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
  return <OutfitStage userImage={bodyUrl} />;
}
