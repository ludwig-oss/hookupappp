/**
 * Confession booth safety: block crime confessions and intent to harm.
 * These are forbidden and may be reported to protect the user and others.
 */

const CRIME_CONFESSION_PATTERNS: RegExp[] = [
  /\b(i\s+(killed|murdered|stabbed|shot|robbed|stole|assaulted|raped|molested|kidnapped))\b/i,
  /\b(i\s+am\s+going\s+to\s+(kill|hurt|harm|attack|stab|shoot))\b/i,
  /\b(planning\s+to\s+(kill|hurt|harm|attack|bomb))\b/i,
  /\b(want\s+to\s+(kill|hurt|harm|murder|attack))\b/i,
  /\b(confess(ed|ing)?\s+to\s+(a\s+)?(crime|murder|theft|robbery|assault|rape))\b/i,
  /\b(i\s+committed\s+(a\s+)?(crime|murder|fraud|arson|burglary))\b/i,
  /\b(selling\s+drugs|drug\s+dealer|trafficking)\b/i,
  /\b(bomb\s+threat|plant\s+a\s+bomb)\b/i,
];

export function checkConfessionContent(content: string): {
  allowed: boolean;
  reportable: boolean;
  reason?: string;
} {
  if (!content?.trim()) return { allowed: true, reportable: false };
  const trimmed = content.trim();
  for (const re of CRIME_CONFESSION_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        allowed: false,
        reportable: true,
        reason:
          'Confessing crimes or intent to harm anyone is strictly forbidden. This was blocked and may be reported for your safety and the safety of others. Please seek licensed legal or emergency help instead.',
      };
    }
  }
  return { allowed: true, reportable: false };
}

export const SEEKER_SAFETY_AGREEMENT = `Anonymous Confession — Safety Agreement

Before you speak, you must understand:

• Do NOT confess to any crime or illegal act.
• Do NOT describe plans or intent to harm yourself or anyone else.
• Such content is strictly forbidden and will be blocked and reported to protect you and others.

This booth is for emotional support, relationship struggles, and personal difficulties — not criminal admissions or violence.

Voice calls are veiled: your real voice is deepened on your device and is never sent. You will not hear the guide's real voice either.

If you are in crisis or danger, contact emergency services or a licensed professional in your area.

By signing below, you confirm you understand these rules and will not use this service for criminal confessions or threats of harm.`;

export const GUIDE_NDA_AGREEMENT = `Anonymous Confession Guide — Confidentiality NDA

You are entering a blind confession session. You will NOT know the seeker's identity and they will NOT know yours. Voice is veiled (deepened) — you will not hear their real voice.

You agree under this virtual contract:

• You will NEVER reveal, discuss, post, or share anything you hear in confession sessions — online or offline.
• You will NOT identify the seeker or describe their confessions to any third party.
• Breach may result in legal action, account termination, and liability for damages.

You provide support only within app guidelines. If someone indicates imminent harm, follow the app's safety escalation procedures without breaking anonymity unnecessarily.

By signing below, you accept this binding confidentiality obligation.`;
