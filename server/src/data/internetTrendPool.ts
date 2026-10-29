import { FASHION_CATALOG } from './fashionCatalog.js';
import {
  hashEmbedding,
  type AgeGroup,
  type IngestedTrendOutfit,
  type TrendSource,
} from '../services/internetTrendMatcher.js';

function groupsForEvent(event: string, formality: string): AgeGroup[] {
  if (event === 'club' || event === 'casual') return ['teen', 'twenty_thirty'];
  if (event === 'interview' || event === 'wedding') return ['twenty_thirty', 'forty_plus'];
  if (event === 'walk' || event === 'brunch') return ['teen', 'twenty_thirty', 'forty_plus'];
  if (formality === 'high') return ['twenty_thirty', 'forty_plus'];
  if (formality === 'low') return ['teen', 'twenty_thirty'];
  return ['twenty_thirty'];
}

function platformFor(event: string, i: number): TrendSource {
  if (event === 'wedding' || event === 'interview') return 'fashion_show';
  if (i % 3 === 0) return 'celebrity_streetwear';
  return 'pinterest';
}

const EXTRA: IngestedTrendOutfit[] = [
  {
    id: 'trend-hailey-street',
    sourceUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'celebrity_streetwear',
    celebrityOrBoardName: 'Hailey Bieber',
    extractedTags: ['streetwear', 'crop', 'velvet', 'shimmer'],
    targetAgeGroups: ['teen', 'twenty_thirty'],
    imageEmbeddingVector: hashEmbedding(['streetwear', 'hailey bieber']),
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'trend-pinterest-autumn',
    sourceUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'pinterest',
    celebrityOrBoardName: 'Autumn Styles',
    extractedTags: ['autumn', 'layer', 'knit', 'plaid'],
    targetAgeGroups: ['teen', 'twenty_thirty', 'forty_plus'],
    imageEmbeddingVector: hashEmbedding(['autumn', 'pinterest']),
    imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'trend-cher-plaid',
    sourceUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c3817b1?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'celebrity_streetwear',
    celebrityOrBoardName: 'Clueless plaid set',
    extractedTags: ['plaid blazer', 'pleated skirt', '90s preppy', 'yellow plaid'],
    targetAgeGroups: ['teen', 'twenty_thirty'],
    imageEmbeddingVector: hashEmbedding(['plaid blazer', 'pleated skirt', '90s preppy']),
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c3817b1?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'trend-fast-haul',
    sourceUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'pinterest',
    celebrityOrBoardName: 'SHEIN haul drop',
    extractedTags: ['shein', 'ultra-fast', 'micro-trend haul', 'clubwear'],
    targetAgeGroups: ['teen', 'twenty_thirty', 'forty_plus'],
    imageEmbeddingVector: hashEmbedding(['shein', 'ultra-fast']),
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'trend-sunday-best',
    sourceUrl: 'https://images.unsplash.com/photo-1507680434567-5733a8ac0c46?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'fashion_show',
    celebrityOrBoardName: 'Sunday best twinset',
    extractedTags: ['sunday best', 'twinset', 'overly traditional', 'pearls and twinset'],
    targetAgeGroups: ['teen', 'twenty_thirty', 'forty_plus'],
    imageEmbeddingVector: hashEmbedding(['sunday best', 'twinset']),
    imageUrl: 'https://images.unsplash.com/photo-1507680434567-5733a8ac0c46?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'trend-tailored-forty',
    sourceUrl: 'https://images.unsplash.com/photo-1507680434567-5733a8ac0c46?auto=format&fit=crop&w=900&q=80',
    sourcePlatform: 'fashion_show',
    celebrityOrBoardName: 'Quiet luxury board',
    extractedTags: ['tailored blazer', 'creased trouser', 'loafers', 'camel'],
    targetAgeGroups: ['forty_plus', 'twenty_thirty'],
    imageEmbeddingVector: hashEmbedding(['tailored blazer', 'creased trouser', 'loafers']),
    imageUrl: 'https://images.unsplash.com/photo-1507680434567-5733a8ac0c46?auto=format&fit=crop&w=900&q=80',
  },
];

export function defaultTrendPool(): IngestedTrendOutfit[] {
  const fromCatalog: IngestedTrendOutfit[] = FASHION_CATALOG.map((look, i) => ({
    id: look.id,
    sourceUrl: look.imageUrl,
    imageUrl: look.imageUrl,
    sourcePlatform: platformFor(look.event, i),
    celebrityOrBoardName: look.title,
    extractedTags: [...look.pieces.map((p) => p.toLowerCase()), look.vibe, look.event.replace('-', ' ')],
    targetAgeGroups: groupsForEvent(look.event, look.formality),
    imageEmbeddingVector: hashEmbedding(look.pieces),
  }));
  return [...EXTRA, ...fromCatalog];
}
