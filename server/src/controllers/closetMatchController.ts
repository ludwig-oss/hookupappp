import { Request, Response } from 'express';
import { listWardrobe } from '../models/fashionWardrobe.js';
import {
  catalogAsRetail,
  fromSavedWardrobe,
  occasionFromText,
  type ClutchWardrobeItem,
  type OccasionType,
} from '../services/cluelessOutfitComposer.js';
import { clutchItemToMatchPiece, rankLooks, type MatchPiece } from '../services/closetMatchEngine.js';

function toPieces(userId: string, closet: ClutchWardrobeItem[], extra: ClutchWardrobeItem[]): MatchPiece[] {
  const mapped: MatchPiece[] = [];
  for (const row of [...closet, ...extra]) {
    const piece = clutchItemToMatchPiece({
      id: row.id,
      category: row.category,
      color: row.color,
      pattern: row.pattern,
      styleTags: row.styleTags,
      imageUrl: row.imageUrl,
      isOwned: row.userId === userId ? row.isOwned : false,
      name: row.pattern,
    });
    if (piece) mapped.push(piece);
  }
  return mapped;
}

export const closetMatchScoreHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const occasion = (String(req.body?.occasion || occasionFromText(String(req.body?.prompt || ''))).trim() ||
      'everyday') as OccasionType;
    const closet = (await listWardrobe(userId)).map(fromSavedWardrobe);
    const bodyPieces = Array.isArray(req.body?.pieces) ? (req.body.pieces as MatchPiece[]) : [];
    const pieces = bodyPieces.length ? bodyPieces : toPieces(userId, closet, catalogAsRetail());

    const result = rankLooks({
      pieces,
      occasion,
      allowContradictoryPatterns: Boolean(req.body?.allowContradictoryPatterns),
      requestedPatterns: Array.isArray(req.body?.requestedPatterns) ? req.body.requestedPatterns.map(String) : [],
      limit: Number(req.body?.limit) || 8,
    });

    res.json({
      occasion,
      looks: result.looks,
      rejectedClashCount: result.rejectedClashCount,
      shoppingPool: result.shoppingPool,
      ownedPreferred: true,
    });
  } catch (error) {
    console.error('Closet match score error:', error);
    res.status(500).json({ error: 'Could not score those looks' });
  }
};
