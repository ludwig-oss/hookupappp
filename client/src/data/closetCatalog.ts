/** Closet catalog for GTA / NBA 2K-style dressing room. */

export type ClosetCategory = 'hats' | 'glasses' | 'masks' | 'tops' | 'bottoms' | 'shoes' | 'outer';
export type ClosetGender = 'masc' | 'fem' | 'any';
export type CameraFocus = 'center' | 'head' | 'feet';

export interface ClosetItem {
  id: string;
  category: ClosetCategory;
  title: string;
  gender: ClosetGender;
  color: string;
  accent?: string;
  brand?: string;
  notes?: string;
  thumbUrl?: string;
}

export type EquippedCloset = Partial<Record<ClosetCategory, ClosetItem | null>>;

export const CLOSET_CATEGORIES: { id: ClosetCategory; label: string; camera: CameraFocus }[] = [
  { id: 'hats', label: 'Hats', camera: 'head' },
  { id: 'glasses', label: 'Glasses', camera: 'head' },
  { id: 'masks', label: 'Masks', camera: 'head' },
  { id: 'tops', label: 'Tops', camera: 'center' },
  { id: 'bottoms', label: 'Bottoms', camera: 'center' },
  { id: 'shoes', label: 'Shoes', camera: 'feet' },
  { id: 'outer', label: 'Outer', camera: 'center' },
];

export const CLOSET_ITEMS: ClosetItem[] = [
  // Hats
  { id: 'hat-beanie', category: 'hats', title: 'Soft beanie', gender: 'any', color: '#2d3748' },
  { id: 'hat-cap', category: 'hats', title: 'Dad cap', gender: 'any', color: '#1a202c', accent: '#e53e3e' },
  { id: 'hat-bucket', category: 'hats', title: 'Bucket hat', gender: 'any', color: '#744210' },
  { id: 'hat-beret', category: 'hats', title: 'Wool beret', gender: 'fem', color: '#742a2a' },
  // Glasses — layer with masks
  { id: 'glass-clear', category: 'glasses', title: 'Clear frames', gender: 'any', color: '#cbd5e0', accent: 'rgba(120,180,220,0.35)' },
  { id: 'glass-sun', category: 'glasses', title: 'Dark sunnies', gender: 'any', color: '#1a1a1a', accent: 'rgba(20,20,20,0.75)' },
  { id: 'glass-gold', category: 'glasses', title: 'Gold rim', gender: 'any', color: '#d69e2e', accent: 'rgba(40,40,40,0.55)' },
  // Masks — layer with glasses
  { id: 'mask-soft', category: 'masks', title: 'Soft face cover', gender: 'any', color: '#2d3748' },
  { id: 'mask-bandana', category: 'masks', title: 'Neck bandana', gender: 'any', color: '#276749' },
  // Tops
  { id: 'top-tee-white', category: 'tops', title: 'Heavy white tee', gender: 'masc', color: '#f7fafc' },
  { id: 'top-tee-black', category: 'tops', title: 'Black fitted tee', gender: 'any', color: '#171923' },
  { id: 'top-knit', category: 'tops', title: 'Fine black knit', gender: 'fem', color: '#1a1a1a', accent: '#d69e2e' },
  { id: 'top-oxford', category: 'tops', title: 'White oxford', gender: 'masc', color: '#edf2f7' },
  { id: 'top-satin', category: 'tops', title: 'Satin cami', gender: 'fem', color: '#c0c0c0' },
  // Bottoms
  { id: 'bot-denim-dark', category: 'bottoms', title: 'Dark straight denim', gender: 'any', color: '#1a365d' },
  { id: 'bot-trouser', category: 'bottoms', title: 'Charcoal trouser', gender: 'masc', color: '#2d3748' },
  { id: 'bot-wide', category: 'bottoms', title: 'Wide navy pant', gender: 'fem', color: '#1a365d' },
  { id: 'bot-skirt', category: 'bottoms', title: 'Column midi skirt', gender: 'fem', color: '#3d2914' },
  // Outer
  { id: 'out-blazer', category: 'outer', title: 'Navy blazer', gender: 'masc', color: '#1e3a5f' },
  { id: 'out-leather', category: 'outer', title: 'Black leather', gender: 'any', color: '#0a0a0a' },
  { id: 'out-denim', category: 'outer', title: 'Denim jacket', gender: 'any', color: '#2b6cb0' },
  { id: 'out-camel', category: 'outer', title: 'Camel soft blazer', gender: 'any', color: '#c19a6b' },
  // Shoes — Jordan / Nike / Adidas
  {
    id: 'shoe-aj1-chicago',
    category: 'shoes',
    title: 'Air Jordan 1 “Chicago”',
    gender: 'any',
    brand: 'Jordan',
    color: '#c53030',
    accent: '#fff',
    notes: 'Jordan',
  },
  {
    id: 'shoe-aj1-bred',
    category: 'shoes',
    title: 'Air Jordan 1 “Bred”',
    gender: 'any',
    brand: 'Jordan',
    color: '#1a202c',
    accent: '#e53e3e',
    notes: 'Jordan',
  },
  {
    id: 'shoe-jordan-4',
    category: 'shoes',
    title: 'Air Jordan 4 “Military Black”',
    gender: 'any',
    brand: 'Jordan',
    color: '#2d3748',
    accent: '#fff',
    notes: 'Jordan',
  },
  {
    id: 'shoe-nike-dunk',
    category: 'shoes',
    title: 'Nike Dunk Low “Panda”',
    gender: 'any',
    brand: 'Nike',
    color: '#1a1a1a',
    accent: '#fff',
    notes: 'Nike',
  },
  {
    id: 'shoe-nike-af1',
    category: 'shoes',
    title: 'Nike Air Force 1',
    gender: 'any',
    brand: 'Nike',
    color: '#f7fafc',
    accent: '#a0aec0',
    notes: 'Nike',
  },
  {
    id: 'shoe-nike-vomero',
    category: 'shoes',
    title: 'Nike Vomero runner',
    gender: 'any',
    brand: 'Nike',
    color: '#4a5568',
    accent: '#68d391',
    notes: 'Nike',
  },
  {
    id: 'shoe-adidas-samba',
    category: 'shoes',
    title: 'Adidas Samba',
    gender: 'any',
    brand: 'Adidas',
    color: '#1a202c',
    accent: '#fff',
    notes: 'Adidas',
  },
  {
    id: 'shoe-adidas-campus',
    category: 'shoes',
    title: 'Adidas Campus 00s',
    gender: 'any',
    brand: 'Adidas',
    color: '#553c9a',
    accent: '#fff',
    notes: 'Adidas',
  },
  {
    id: 'shoe-adidas-ultraboost',
    category: 'shoes',
    title: 'Adidas Ultraboost',
    gender: 'any',
    brand: 'Adidas',
    color: '#2b6cb0',
    accent: '#bee3f8',
    notes: 'Adidas',
  },
];

export function itemsFor(category: ClosetCategory, gender: ClosetGender): ClosetItem[] {
  return CLOSET_ITEMS.filter((item) => {
    if (item.category !== category) return false;
    if (item.gender !== 'any' && gender !== 'any' && item.gender !== gender) return false;
    return true;
  });
}
