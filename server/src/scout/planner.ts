import type { PlannedEvent, TimeWindow } from './types.js';

const DAY = 24 * 60 * 60 * 1000;

export function overlapWindows(left: TimeWindow[], right: TimeWindow[]): TimeWindow[] {
  const slots: TimeWindow[] = [];
  for (const a of left) {
    for (const b of right) {
      const start = Math.max(new Date(a.start).getTime(), new Date(b.start).getTime());
      const end = Math.min(new Date(a.end).getTime(), new Date(b.end).getTime());
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 30 * 60 * 1000) continue;
      slots.push({
        id: `${a.id}:${b.id}`,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        label: a.label || b.label || 'Open block',
      });
    }
  }
  return slots.slice(0, 8);
}

const BOARDS: Array<{ match: RegExp; title: string; city: string; why: string }> = [
  { match: /football/, title: 'Closed training week', city: 'Madrid', why: 'Two players can book a pitch and a recovery day before the next match window.' },
  { match: /agent/, title: 'Representation summit', city: 'London', why: 'Agents compare mandates two weeks before the window opens.' },
  { match: /lawyer|judge/, title: 'Chambers retreat', city: 'The Hague', why: 'A quiet docket week for joint prep, not a hearing.' },
  { match: /doctor|surgeon/, title: 'Clinical congress fringe', city: 'Vienna', why: 'Hands-on sessions land after the main congress, with room to travel together.' },
  { match: /producer|artist|musician|model/, title: 'Private viewing weekend', city: 'Paris', why: 'Galleries and premieres cluster in the third week out.' },
  { match: /architect|engineer|founder/, title: 'Site and capital salon', city: 'Milan', why: 'Projects that need both a builder and a backer.' },
  { match: /.*/, title: 'City salon', city: 'Berlin', why: 'A small room for two people who already decided to build something.' },
];

/** Events are placed 14–28 days ahead. That is the planner’s trending window. */
export function trendingEvents(professionLabel: string, now = Date.now()): PlannedEvent[] {
  const label = professionLabel || 'Partner';
  const start = now + 14 * DAY;
  return BOARDS.filter((item) => item.match.test(label.toLowerCase()))
    .slice(0, 3)
    .map((item, index) => ({
      id: `${item.city}-${index}`,
      title: item.title,
      city: item.city,
      startsAt: new Date(start + (3 + index * 4) * DAY).toISOString(),
      why: item.why,
      source: 'two-to-four-week-board' as const,
    }));
}

export function buddyTips(professionLabel: string): string[] {
  const sport = /football/i.test(professionLabel);
  if (sport) {
    return [
      'Put the training block on the shared calendar before you talk tactics.',
      'Track one measurable goal per week: minutes, assists, or a set piece.',
      'The buddy tip is boring on purpose: sleep, the same warm-up, and one film session together.',
    ];
  }
  return [
    'Name the next joint deliverable in one sentence.',
    'Put the money entry in the ledger the day it is spent, not at the end of the month.',
    'If a plan slips, write it in the mediation log before it becomes a verdict.',
  ];
}

export function mediate(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (/unrepair|it'?s over|terminate|i'?m done|cannot continue/i.test(clean)) {
    return 'This reads as unrepairable. Ending the partnership splits every tracked expense and house payment 50/50. Chat can stay open.';
  }
  const clip = clean.slice(0, 180);
  return `Logged. The other person will see this, not a verdict: “${clip}”. Repair step: restate the fact, name the cost, and pick one fix — move the slot, split the line item, or pause the goal — before either of you calls it over.`;
}

export const CONTRACT_TEXT = [
  'BUILDING PARTNERSHIP PRE-AGREEMENT',
  'We enter Building mode as professional partners.',
  '1. A Speed Date Live session comes first. The match is final only after both of us press the blue button.',
  '2. Calendar slots, travel plans, goals, and money entries are joint records.',
  '3. Misunderstandings go into the mediation log before either of us walks away.',
  '4. If the partnership is unrepairable, it ends and tracked expenses plus house payments split 50/50.',
].join('\n');
