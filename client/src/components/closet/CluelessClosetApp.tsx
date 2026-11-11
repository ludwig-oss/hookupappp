import type { ClosetGender, ClosetItem } from '../../data/closetCatalog';
import ChersWardrobe from './ChersWardrobe';

/** Closet tab uses the same Cher wardrobe as the outfit desk. */
export default function CluelessClosetApp({
  gender: _gender,
  onTryOn: _onTryOn,
}: {
  gender?: ClosetGender;
  onTryOn?: (top: ClosetItem, bottom: ClosetItem) => void;
}) {
  return <ChersWardrobe prompt="red carpet award show" />;
}
