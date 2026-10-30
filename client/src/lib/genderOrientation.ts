/** Genders orientation matching actually uses. Gay is men, lesbian is women, straight is the other. */

export const DATING_GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

export type DatingGender = (typeof DATING_GENDERS)[number]['value'];

export type DatingOrientation = 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual';

export function datingGender(value: string | null | undefined): DatingGender | '' {
  const g = String(value || '').toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g.startsWith('fem')) return 'female';
  if (g === 'male' || g === 'man' || g === 'm' || g.startsWith('masc')) return 'male';
  return '';
}

export function orientationsForGender(gender: string): { value: DatingOrientation; label: string }[] {
  const g = datingGender(gender);
  const open = [
    { value: 'bisexual' as const, label: 'Bisexual' },
    { value: 'pansexual' as const, label: 'Pansexual' },
  ];
  if (g === 'male') {
    return [
      { value: 'straight', label: 'Straight' },
      { value: 'gay', label: 'Gay' },
      ...open,
    ];
  }
  if (g === 'female') {
    return [
      { value: 'straight', label: 'Straight' },
      { value: 'lesbian', label: 'Lesbian' },
      ...open,
    ];
  }
  return [];
}

export function orientationFitsGender(orientation: string, gender: string): boolean {
  return orientationsForGender(gender).some((o) => o.value === orientation);
}
