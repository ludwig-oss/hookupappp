import type { FashionLook } from '../data/fashionCatalog.js';
import { FASHION_CATALOG } from '../data/fashionCatalog.js';
import type { PieceSlot, WardrobeItem } from '../models/fashionWardrobe.js';

export type OccasionType = 'everyday' | 'special_event' | 'work' | 'night_out';
export type ClothingCategory = 'top' | 'bottom' | 'outerwear' | 'shoes' | 'accessory';

export interface ClutchWardrobeItem {
  id: string;
  userId: string;
  category: ClothingCategory;
  color: string;
  pattern: string;
  styleTags: string[];
  imageUrl: string;
  isOwned: boolean;
}

export interface ScheduleIntent {
  userId: string;
  date: string;
  occasion: OccasionType;
  destinationDetails?: string | null;
  budgetForShopping?: number;
}

export function occasionFromText(raw: string): OccasionType {
  const q = (raw || '').toLowerCase();
  if (/\b(wedding|gala|special|formal|ceremony)\b/.test(q)) return 'special_event';
  if (/\b(work|office|interview|meeting)\b/.test(q)) return 'work';
  if (/\b(club|night|bar|dinner|date night)\b/.test(q)) return 'night_out';
  return 'everyday';
}

function slotToCategory(slot?: PieceSlot, title = ''): ClothingCategory {
  if (slot === 'bottom') return 'bottom';
  if (slot === 'outer') return 'outerwear';
  if (slot === 'shoes') return 'shoes';
  const t = title.toLowerCase();
  if (/\b(pant|jean|skirt|short|trouser)\b/.test(t)) return 'bottom';
  if (/\b(jacket|coat|blazer|hoodie|cardigan)\b/.test(t)) return 'outerwear';
  if (/\b(shoe|sneaker|boot|heel)\b/.test(t)) return 'shoes';
  if (/\b(bag|belt|hat|jewel)\b/.test(t)) return 'accessory';
  return 'top';
}

export function fromSavedWardrobe(item: WardrobeItem): ClutchWardrobeItem {
  return {
    id: item.id,
    userId: item.userId,
    category: slotToCategory(item.pieceSlot, item.title),
    color: String(item.vibe || ''),
    pattern: `${item.title} ${item.notes || ''}`.toLowerCase(),
    styleTags: Array.isArray(item.pieces) ? item.pieces : [],
    imageUrl: item.imageUrl,
    isOwned: true,
  };
}

export function catalogAsRetail(looks: FashionLook[] = FASHION_CATALOG): ClutchWardrobeItem[] {
  return looks.map((look) => ({
    id: look.id,
    userId: 'shop',
    category: slotToCategory(undefined, look.pieces[0] || look.title),
    color: look.palette[0] || '',
    pattern: `${look.title} ${look.trendNotes}`.toLowerCase(),
    styleTags: look.pieces,
    imageUrl: look.imageUrl,
    isOwned: false,
  }));
}

export class CluelessAIStylistGuide {
  getMonthlyCheckIn(currentMonth: string) {
    return {
      message: `Ugh, as if you could go through ${currentMonth} without planning your looks! What major events or everyday vibes are we dressing for this month?`,
      requiresInput: true,
      inputType: 'calendar_sync_or_text' as const,
    };
  }

  filterUserCloset(wardrobe: ClutchWardrobeItem[]) {
    const owned = wardrobe.filter((item) => item.isOwned);
    return {
      tops: owned.filter((item) => item.category === 'top'),
      bottoms: owned.filter((item) => item.category === 'bottom'),
      outerwear: owned.filter((item) => item.category === 'outerwear'),
      shoes: owned.filter((item) => item.category === 'shoes'),
    };
  }

  generateOutfitMatch(
    intent: ScheduleIntent,
    userWardrobe: ClutchWardrobeItem[],
    retailCatalog: ClutchWardrobeItem[] = []
  ) {
    const closet = this.filterUserCloset(userWardrobe);
    let selectedTop = closet.tops[0] || null;
    let selectedBottom = closet.bottoms[0] || null;
    let selectedOuterwear = closet.outerwear[0] || null;

    let shoppingRecommendation: ClutchWardrobeItem | null = null;
    const shoppingOk =
      intent.occasion === 'special_event' ||
      intent.occasion === 'night_out' ||
      (intent.budgetForShopping || 0) > 0;

    if (shoppingOk && retailCatalog.length) {
      const bottomPat = selectedBottom?.pattern || '';
      const hit =
        retailCatalog.find((item) => bottomPat && item.pattern.includes('plaid') && bottomPat.includes('plaid')) ||
        retailCatalog.find((item) => item.category === 'outerwear') ||
        retailCatalog[0];
      if (hit) {
        shoppingRecommendation = hit;
        selectedOuterwear = hit;
      }
    }

    return {
      matchStatus: shoppingRecommendation ? 'MATCH' : 'COMPLETED_LOOK',
      context: {
        occasion: intent.occasion,
        destination: intent.destinationDetails || null,
        isShoppingAssisted: Boolean(shoppingRecommendation),
      },
      outfit: {
        top: selectedTop,
        bottom: selectedBottom,
        outerwear: selectedOuterwear,
      },
      shuffleOptions: {
        availableTopsCount: closet.tops.length,
        availableBottomsCount: closet.bottoms.length,
      },
      shoppingRecommendation,
      guideLine: shoppingRecommendation
        ? 'Special-event bump: closet pieces plus one shop item so the look actually finishes.'
        : 'Everyday rule: owned closet only. As if we were buying a whole new personality.',
    };
  }
}

export const cluelessStylist = new CluelessAIStylistGuide();
