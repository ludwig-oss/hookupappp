function clean(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

const FUTURE_RULES: Array<{ test: RegExp; line: string }> = [
  { test: /\bteach/, line: 'Training the future saviors of planet Earth' },
  { test: /\b(youtube|content creator|influencer|tiktok)\b/, line: 'Building a channel the rest of the internet will study' },
  { test: /\bnurs/, line: 'The night shift’s last calm voice' },
  { test: /\bdoctor|medic|surgeon/, line: 'Putting people back together before the credits roll' },
  { test: /\blaw|attorney|lawyer/, line: 'Arguing strangers back into a future' },
  { test: /\bengineer|developer|programmer|software/, line: 'Wiring the machine everyone else will live inside' },
  { test: /\bdesign/, line: 'Deciding what beautiful is allowed to look like' },
  { test: /\bchef|cook|baker/, line: 'Feeding the room until it tells the truth' },
  { test: /\bartist|paint|music|singer|band/, line: 'Making something people feel in their teeth' },
  { test: /\bfounder|startup|business/, line: 'Building a company that outgrows the excuse' },
  { test: /\bact(or|ress)|film|cinema/, line: 'Practicing the version of life that gets remembered' },
  { test: /\bwriter|author|journal/, line: 'Writing the sentences people steal when they are brave' },
  { test: /\bfit|trainer|coach|gym/, line: 'Forging bodies that can carry a harder life' },
  { test: /\bstudent|university|college|degree/, line: 'Collecting the skills the next decade will beg for' },
];

const QUALITY_RULES: Array<{ test: RegExp; line: string }> = [
  { test: /\bkind|gentle|sweet/, line: 'Kindness with a backbone — the rare kind' },
  { test: /\bfunny|humou?r|wit/, line: 'Funny enough to disarm a room that came ready to judge' },
  { test: /\bloyal|faithful/, line: 'Loyal past the point where most people negotiate' },
  { test: /\bambitious|driven|hustle/, line: 'Ambition you can hear before they finish the sentence' },
  { test: /\bhonest|direct|blunt/, line: 'Honest in a way that costs them — and they pay it' },
  { test: /\bconfident|bold/, line: 'Confidence that doesn’t need the room to clap first' },
  { test: /\blisten/, line: 'Listens like the detail is the whole plot' },
  { test: /\badventur|spontan/, line: 'A yes looking for a slightly unwise plan' },
];

export function polishFuture(raw: string): string {
  const text = clean(raw);
  if (!text) return 'Writing the next chapter loud enough for the cheap seats';
  const lower = text.toLowerCase();
  for (const rule of FUTURE_RULES) {
    if (rule.test.test(lower)) return rule.line;
  }
  return `Turning "${text}" into the plot twist people quote later`;
}

export function polishQuality(raw: string): string {
  const text = clean(raw);
  if (!text) return 'A presence that makes the room slow down';
  const lower = text.toLowerCase();
  for (const rule of QUALITY_RULES) {
    if (rule.test.test(lower)) return rule.line;
  }
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} — felt once, then impossible to unfeel`;
}
