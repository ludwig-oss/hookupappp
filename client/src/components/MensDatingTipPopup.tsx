import { MENS_DATING_TIPS } from '../data/mensDatingTips';
import PeriodicDatingTipPopup from './PeriodicDatingTipPopup';

function isMaleGender(gender?: string | null): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === 'male' || g === 'm' || g === 'man';
}

export default function MensDatingTipPopup() {
  return (
    <PeriodicDatingTipPopup
      audience="mens"
      tips={MENS_DATING_TIPS}
      matchGender={isMaleGender}
      delayMs={10000}
    />
  );
}
