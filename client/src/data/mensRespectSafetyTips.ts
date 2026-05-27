export interface MensRespectSafetyTip {
  id: string;
  title: string;
  avoid: string;
  impact: string;
  doInstead: string;
}

/** Men-only safety education: short, non-graphic reminders about public respect. */
export const MENS_RESPECT_SAFETY_TIPS: MensRespectSafetyTip[] = [
  {
    id: 'catcalling',
    title: 'Skip catcalling',
    avoid: 'No comments about her body, “smile,” whistling, or sexual jokes to a stranger.',
    impact: 'It can feel like public pressure and make her scan for escape routes.',
    doInstead: 'If you speak, keep it neutral and respectful—or say nothing and keep walking.',
  },
  {
    id: 'blocking-path',
    title: 'Never block her path',
    avoid: 'Don’t corner her, stand too close, or step into her walking line.',
    impact: 'That reads as intimidation even if you “meant well.”',
    doInstead: 'Give space. If she’s walking, let her pass. If she’s stopped, keep distance.',
  },
  {
    id: 'following',
    title: 'Don’t follow or “shadow”',
    avoid: 'Avoid trailing her after she ignores you or changes direction.',
    impact: 'It feels like stalking and can trigger fear—fast.',
    doInstead: 'Take the no and move on. Respect is leaving her alone.',
  },
  {
    id: 'touching',
    title: 'No touching without consent',
    avoid: 'No grabbing, groping, “playful” touches, or pulling someone closer.',
    impact: 'Unwanted touch is a violation and can be traumatic.',
    doInstead: 'Ask first. If it’s not an enthusiastic yes, it’s a no.',
  },
  {
    id: 'unsolicited-media',
    title: 'Don’t send explicit content',
    avoid: 'No unsolicited sexual messages or images.',
    impact: 'It’s harassment and can make her feel unsafe in every future chat.',
    doInstead: 'Keep it respectful. Let intimacy be mutual and earned over time.',
  },
  {
    id: 'doxxing',
    title: 'Never share her private info',
    avoid: 'Don’t post her address, workplace, phone, photos, or screenshots without consent.',
    impact: 'Doxxing invites harassment and can put her in real danger.',
    doInstead: 'Protect privacy like you’d protect your own family’s.',
  },
  {
    id: 'gaslighting',
    title: 'Don’t dismiss her reality',
    avoid: 'No “you’re overreacting,” “it was a joke,” or blaming her interpretation.',
    impact: 'That’s gaslighting—she learns you’re not safe to be honest with.',
    doInstead: 'Own your impact: “My bad. I’ll stop.” Then actually stop.',
  },
  {
    id: 'retaliation',
    title: 'No revenge for rejection',
    avoid: 'Don’t insult, threaten, expose, or “punish” her for saying no.',
    impact: 'Retaliation creates fear and teaches women to stay silent.',
    doInstead: 'Rejection is normal. Walk away with dignity.',
  },
  {
    id: 'pink-tax',
    title: 'Respect the “safety tax”',
    avoid: 'Don’t mock her precautions (rideshares, parking choices, checking exits).',
    impact: 'Women often spend extra time and money just to feel safe.',
    doInstead: 'Support it: offer well-lit meetups, public places, and patience.',
  },
];

