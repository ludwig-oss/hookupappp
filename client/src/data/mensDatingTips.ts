export interface MensDatingTip {
  id: string;
  title: string;
  summary: string;
  pros: string;
  cons: string;
}

/** Short hints for male users — rephrased relationship guidance, shown ~every 3–4 months. */
export const MENS_DATING_TIPS: MensDatingTip[] = [
  {
    id: 'purpose-first',
    title: 'Put your mission first',
    summary:
      'Your long-term goals matter more than nonstop texting. When you meet, give her your full attention—not a distracted half-presence.',
    pros: 'You stay grounded and respected; she feels real quality time.',
    cons: 'Without warmth, it can feel like you are pulling away.',
  },
  {
    id: 'quality-time',
    title: 'Depth beats duration',
    summary:
      'Twenty minutes fully locked in often lands better than hours on your phone. Presence is the gift.',
    pros: 'Stronger bond, less jealousy over screen time.',
    cons: 'Needs planning; not every day allows a deep block.',
  },
  {
    id: 'growing-edge',
    title: 'Keep stretching yourself',
    summary:
      'A little daily challenge—body, mind, or skill—keeps your energy forward. Comfort zones get stale fast.',
    pros: 'You bring momentum and confidence into dating.',
    cons: 'All push, no rest leads to burnout and irritability.',
  },
  {
    id: 'face-fear',
    title: 'Acknowledge fear, then move',
    summary:
      'Notice what scares you instead of faking toughness. Honest nerves plus action read as real confidence.',
    pros: 'Trust grows when you are human, not performative.',
    cons: 'Too much vulnerability too soon can overwhelm her.',
  },
  {
    id: 'steady-anchor',
    title: 'Be calm, not controlling',
    summary:
      'Offer steady direction and warmth. Let her moods move without trying to steer every wave.',
    pros: 'She feels safe to be emotional around you.',
    cons: 'Stone-cold calm can look like you do not care.',
  },
  {
    id: 'hold-space',
    title: 'Listen—do not “fix” every storm',
    summary:
      'When she is upset, hold space with care and light playfulness. Not every feeling is a problem to solve.',
    pros: 'She feels heard instead of managed.',
    cons: 'Sometimes she wants advice—ask first.',
  },
  {
    id: 'warm-presence',
    title: 'Engage, do not just endure',
    summary:
      'If the mood shuts down, warm presence and gentle humor beat silent resentment. Participate, do not only tolerate.',
    pros: 'Tension clears faster; less long-term bitterness.',
    cons: 'Bad timing or jokes can feel dismissive—read the room.',
  },
  {
    id: 'polarity-balance',
    title: 'Direction + openness',
    summary:
      'Pair clear purpose with openness to her flow. Structure without flexibility feels rigid; flow without direction feels lost.',
    pros: 'Balanced polarity keeps attraction alive.',
    cons: 'Easy to tip too far into bossy or too passive.',
  },
];
