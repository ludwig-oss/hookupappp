import { getGuide, AI_GUIDES, type AiGuideCharacter } from '../data/aiGuideCatalog.js';

export type ChatLine = { from: 'me' | 'them'; text: string };

export interface TextingCoachAdvice {
  guideId: string;
  guideName: string;
  specialty: string;
  situation: string;
  opinion: string;
  whyItWorks: string;
  replies: string[];
  nextMove: string;
  watchFor: string;
}

function normGender(g?: string | null): 'male' | 'female' | 'unknown' {
  const s = (g || '').toLowerCase();
  if (/^(m|male|man|boy|guy)/.test(s)) return 'male';
  if (/^(f|female|woman|girl|lady)/.test(s)) return 'female';
  return 'unknown';
}

function lastThem(lines: ChatLine[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].from === 'them' && lines[i].text.trim()) return lines[i].text.trim();
  }
  return '';
}

function lastMe(lines: ChatLine[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].from === 'me' && lines[i].text.trim()) return lines[i].text.trim();
  }
  return '';
}

function vibe(lines: ChatLine[]): 'dry' | 'flirty' | 'cold' | 'warm' | 'stuck' | 'new' {
  if (lines.length < 2) return 'new';
  const them = lines.filter((l) => l.from === 'them');
  const me = lines.filter((l) => l.from === 'me');
  const avgThem = them.length ? them.reduce((n, l) => n + l.text.length, 0) / them.length : 0;
  const lastT = lastThem(lines).toLowerCase();
  if (/lol|haha|😏|😉|cute|miss you|wanna/.test(lastT)) return 'flirty';
  if (/busy|later|idk|k\.|ok\.|sure/.test(lastT) && avgThem < 40) return 'cold';
  if (avgThem < 25 && them.length >= 2) return 'dry';
  if (me.length > them.length + 2) return 'stuck';
  return 'warm';
}

function genderLens(viewer: 'male' | 'female' | 'unknown', partner: 'male' | 'female' | 'unknown'): string {
  if (viewer === 'female' && (partner === 'male' || partner === 'unknown')) {
    return 'You are texting as a woman — keep warmth + standards. Reward effort, do not chase crumbs, and leave space for him to lead when you want him to.';
  }
  if (viewer === 'male' && (partner === 'female' || partner === 'unknown')) {
    return 'You are texting as a man — lead with clarity and lightness. One clear vibe, one ask, no essays. Curiosity beats over-explaining.';
  }
  if (viewer === 'female' && partner === 'female') {
    return 'Same-gender flirt — match energy, share specifics, and invite a next step without pressure.';
  }
  if (viewer === 'male' && partner === 'male') {
    return 'Same-gender flirt — be direct, playful, and specific. Soft openers then a clear invite.';
  }
  return 'Match their energy, stay specific, and always leave an easy out.';
}

function pickGuide(guideId?: string): AiGuideCharacter {
  if (guideId) {
    const g = getGuide(guideId);
    if (g) return g;
  }
  // Prefer strong texting coaches by default
  return getGuide('diego') || getGuide('sofia') || AI_GUIDES[0];
}

function repliesFor(
  guide: AiGuideCharacter,
  v: ReturnType<typeof vibe>,
  viewer: 'male' | 'female' | 'unknown',
  partnerName: string,
  lastT: string
): string[] {
  const name = partnerName.split(' ')[0] || 'you';
  const soft = [
    `Hey — that made me smile. Tell me more about that?`,
    `Okay I like this thread. What’s your week look like?`,
    `I’m down to keep this going — coffee or a walk this week?`,
  ];
  const dryFix =
    viewer === 'male'
      ? [
          `Haha fair. Random: best meal you’ve had lately?`,
          `You’re fun when you actually talk — give me one hot take.`,
          `Alright, I’m switching modes: drinks this week or are we keeping this chat forever?`,
        ]
      : [
          `Cute. I’m not doing one-word tennis though 😌 What’s actually up with you?`,
          `Okay mystery person — give me something real. What’s your week looking like?`,
          `I’d rather hang than text forever. Free later this week?`,
        ];
  const flirty =
    viewer === 'male'
      ? [
          `You’re trouble in the good way. When am I seeing that in person?`,
          `Noted. I’m claiming a coffee with you before this chat gets too good.`,
          `Say that again when we’re face to face — pick a night.`,
        ]
      : [
          `Careful, that almost worked 😌 Try again with a plan.`,
          `I like the energy. Earn a night out — when are you free?`,
          `Mmm. Text is cute. Presence is better. This week?`,
        ];
  const cold = [
    `No stress — catch me when you’ve got more than a “busy.”`,
    `I’ll leave the door open. Ping me when you actually want to talk.`,
    `Cool. I’m around if you want a real conversation later.`,
  ];
  const stuck = [
    `Quick reset: what’s one thing you’re looking forward to this week?`,
    `I’m going to make this easy — ${name}, free Thursday or Friday?`,
    `Let’s pause the spiral. Want to meet for something low-key?`,
  ];
  const base =
    v === 'dry' ? dryFix : v === 'flirty' ? flirty : v === 'cold' ? cold : v === 'stuck' ? stuck : soft;

  // Guide-flavored third option
  const signature: Record<string, string> = {
    diego: `Timer on: send one clear message, then put the phone down for 20 minutes.`,
    sofia: `Keep it light and a little bold — one spark, then stop selling.`,
    amara: `You don’t need to prove you’re easygoing. Ask for the meet like you mean it.`,
    marcus: `If they’re still vague after this, that’s your answer — don’t negotiate clarity.`,
    kenji: `Pick one option and a time window. Decision > chemistry essays.`,
    priya: `Slow is fine. Soft invite, no pressure, leave room for a yes.`,
    elena: `Compliment something specific you noticed, then pivot to meeting.`,
    mei: `Chemistry needs pace. Warm text, then suggest something in person.`,
  };
  const third = signature[guide.id] || `Keep it short and human — then wait.`;
  const tailored = lastT
    ? [`Re: “${lastT.slice(0, 60)}${lastT.length > 60 ? '…' : ''}” — ${base[0]}`, base[1], third]
    : [base[0], base[1], third];
  return tailored.slice(0, 3);
}

export function buildTextingCoachAdvice(params: {
  guideId?: string;
  viewerGender?: string | null;
  partnerGender?: string | null;
  partnerName?: string;
  messages: ChatLine[];
  question?: string;
}): TextingCoachAdvice {
  const guide = pickGuide(params.guideId);
  const viewer = normGender(params.viewerGender);
  const partner = normGender(params.partnerGender);
  const lines = (params.messages || []).slice(-24);
  const v = vibe(lines);
  const lastT = lastThem(lines);
  const lastM = lastMe(lines);
  const partnerName = (params.partnerName || 'them').trim() || 'them';
  const lens = genderLens(viewer, partner);

  const situationBits = [
    lines.length === 0
      ? `Fresh chat with ${partnerName} — you need an opener that sounds like you, not a template.`
      : `Thread with ${partnerName}: vibe feels ${v}.`,
    lastT ? `Their last line: “${lastT.slice(0, 120)}”.` : 'They have not said much yet.',
    lastM ? `Your last send: “${lastM.slice(0, 100)}”.` : '',
    params.question ? `You asked: “${params.question.slice(0, 160)}”.` : '',
  ].filter(Boolean);

  const opinionByGuide: Record<string, string> = {
    diego: `Stop drafting novels. One message with a pulse, then live your life. ${lens}`,
    sofia: `Flirting dies when you over-explain. Signal interest, leave a gap. ${lens}`,
    amara: `If you are shrinking yourself to keep them texting, that is the real problem. ${lens}`,
    marcus: `Mixed signals in text are still signals. Do not invent a better story than their effort. ${lens}`,
    kenji: `Optimize for a date, not a pen-pal streak. ${lens}`,
    priya: `Nervous is normal — choose a soft, honest next step instead of proving worth. ${lens}`,
    elena: `Specificity is attractive. Vague compliments and vague plans feel cheap. ${lens}`,
    mei: `Text can warm things up, but chemistry needs embodied pace. Do not rush intimacy in the chat. ${lens}`,
  };

  const why: Record<string, string> = {
    dry: 'Short replies mean low investment or low bandwidth — change the frame or invite IRL before the thread dies.',
    flirty: 'They left an opening. Convert spark into a plan before it cools into banter forever.',
    cold: 'Protect your energy. A clean boundary often restarts respect better than chasing.',
    stuck: 'You are carrying the conversation. Rebalance with a question or a concrete invite.',
    warm: 'Energy is mutual — deepen with something personal, then suggest meeting.',
    new: 'First impression = clarity + personality. Lead with one vivid detail and a soft ask.',
  };

  const nextMove =
    v === 'cold'
      ? 'Send one graceful close-or-invite line, then mute the thread until they invest.'
      : v === 'dry' || v === 'stuck'
        ? 'Send one playful prompt or a time-bound invite. If they stay dry, stop escalating.'
        : v === 'flirty'
          ? 'Mirror the flirt once, then lock a day/time for meeting.'
          : 'Share one specific detail about your day, ask one specific question, suggest meeting within 3–5 days.';

  return {
    guideId: guide.id,
    guideName: guide.name,
    specialty: guide.specialty,
    situation: situationBits.join(' '),
    opinion: opinionByGuide[guide.id] || `${guide.thinking} ${lens}`,
    whyItWorks: why[v],
    replies: repliesFor(guide, v, viewer, partnerName, lastT),
    nextMove,
    watchFor:
      viewer === 'female'
        ? 'If he only wants late-night texts and never plans, that is the answer.'
        : viewer === 'male'
          ? 'If she engages but never agrees to meet, do not keep performing for free.'
          : 'Effort should roughly match. If it never does, choose someone who texts like they mean it.',
  };
}
