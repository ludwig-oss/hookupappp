import type { ClosetGender, ClosetItem } from '../../data/closetCatalog';
import ChersWardrobe from './ChersWardrobe';

/** Outfit closet: black-and-white stage, isolated top over bottom. */
export default function CluelessClosetApp({
  gender: _gender,
  onTryOn: _onTryOn,
  bodyUrl,
}: {
  gender?: ClosetGender;
  onTryOn?: (top: ClosetItem, bottom: ClosetItem) => void;
  bodyUrl?: string | null;
}) {
  return <ChersWardrobe userImage={bodyUrl} />;
}
