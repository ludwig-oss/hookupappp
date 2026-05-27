import { WOMENS_DATING_TIPS } from '../data/womensDatingTips';
import PeriodicDatingTipPopup from './PeriodicDatingTipPopup';

function isFemaleGender(gender?: string | null): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return (
    g === 'female' ||
    g === 'f' ||
    g === 'woman' ||
    g === 'women' ||
    g.includes('female') ||
    g.includes('woman')
  );
}

export default function WomensDatingTipPopup() {
  return (
    <PeriodicDatingTipPopup
      audience="womens"
      tips={WOMENS_DATING_TIPS}
      matchGender={isFemaleGender}
      delayMs={14000}
      cardClassName="dating-tip-card-women"
    />
  );
}
