/**
 * 59-step intimacy flow for Mei's bedroom desk.
 * Clinical/biomechanical language. Adults only. Consent and stop-on-pain are the frame.
 */

export type IntimacyDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type IntimacyVibe = 'close' | 'side' | 'edge' | 'standing' | 'chair' | 'prone' | 'lift' | 'slow';
export type TipKind = 'last-longer' | 'do' | 'dont';

export interface IntimacyPosition {
  id: number;
  name: string;
  description: string;
  difficulty: IntimacyDifficulty;
  durationMinutes: number;
  nextPositionId: number;
  vibe: IntimacyVibe;
}

export interface IntimacyTip {
  id: string;
  kind: TipKind;
  title: string;
  line: string;
}

function pos(
  id: number,
  name: string,
  description: string,
  difficulty: IntimacyDifficulty,
  durationMinutes: number,
  nextPositionId: number,
  vibe: IntimacyVibe
): IntimacyPosition {
  return { id, name, description, difficulty, durationMinutes, nextPositionId, vibe };
}

export const INTIMACY_POSITIONS: IntimacyPosition[] = [
  pos(1, 'The Elevated Lotus', 'One partner sits cross-legged on a firm, elevated cushion. The other straddles them, wrapping their legs around the torso. Eye contact, low-intensity rhythm.', 'Intermediate', 5, 2, 'close'),
  pos(2, 'The Closed Lotus', 'From Elevated Lotus, the straddling partner extends their legs back and leans flat against the sitting partner’s chest. Leverage and depth change without a reset.', 'Advanced', 4, 3, 'close'),
  pos(3, 'The Lateral Scissors', 'Both lie on their sides facing each other. One places their top leg over the other’s hip at about 45 degrees. Stable, low effort.', 'Beginner', 6, 4, 'side'),
  pos(4, 'The Asymmetric Bridge', 'One lies on their back with a wedge under the pelvis, one knee to the chest, the other leg extended. Partner kneels in.', 'Intermediate', 4, 5, 'edge'),
  pos(5, 'The Perpendicular Arch', 'Receiving partner lies across the bed width, hips on the mattress edge, legs on the kneeling partner’s shoulders. Vertical leverage. Go slow.', 'Advanced', 3, 6, 'edge'),
  pos(6, 'The Coiled Coaster', 'One kneels upright. The other wraps from the front, weight on a stack of yoga blocks behind them so quads do not do all the work.', 'Intermediate', 5, 7, 'close'),
  pos(7, 'The Seated Cradle', 'Penetrating partner sits on the floor, legs out. Receiving partner sits facing them, leaning back about 60 degrees on a low sofa or wall.', 'Beginner', 5, 8, 'slow'),
  pos(8, 'The T-Crescent', 'Partners form a T on their sides. Receiving partner rests the lower torso on a firm pillow, pelvis slightly up. Horizontal slide-in.', 'Beginner', 6, 9, 'side'),
  pos(9, 'The Standing Counter Balance', 'One leans on a sturdy counter, gripping the edge. The other steps in close. Core tension for balance — no heavy lift.', 'Advanced', 3, 10, 'standing'),
  pos(10, 'The Kneeling Diagonal', 'From the counter, receiving partner drops to one knee on a padded mat, opposite leg at an angle across the other’s thigh.', 'Intermediate', 4, 11, 'standing'),
  pos(11, 'The Trapeze Tilt', 'Shoulders on the bed, hips high on a rigid bolster. Partner stands at the foot of the bed, leaning forward about 45 degrees.', 'Advanced', 4, 12, 'edge'),
  pos(12, 'The Modified Mermaid', 'Stomach down, hips shifted fully sideways, legs stacked. Partner approaches from a low prone line.', 'Intermediate', 5, 13, 'prone'),
  pos(13, 'The Amazon Inversion', 'Penetrating partner on their back, knees slightly bent. Receiving partner straddles backwards, chest toward the shins. Skip if knees or backs complain.', 'Advanced', 3, 14, 'lift'),
  pos(14, 'The Sitting Pivot', 'Both sit facing on a wide sturdy chair. Receiving partner wraps legs around the waist. Small upper-body leans change the angle.', 'Beginner', 5, 15, 'chair'),
  pos(15, 'The Low Anchor', 'From the chair, receiving partner slides until feet find the floor. Seated partner stays put and tilts the pelvis up.', 'Intermediate', 4, 16, 'chair'),
  pos(16, 'The Cross-Legged Prone', 'Face down, ankles crossed, legs long. Partner overlays from behind with a low profile. Slow.', 'Beginner', 5, 17, 'prone'),
  pos(17, 'The Half-Frog Elevation', 'Prone, one knee pulled high to the side on a thick pad. Partner at about a 30-degree offset.', 'Intermediate', 5, 18, 'prone'),
  pos(18, 'The Linear Slingshot', 'On the back, hold thighs behind the knees. Partner kneels close, forearms around the waist. Do not force the stretch.', 'Intermediate', 4, 19, 'edge'),
  pos(19, 'The Standing Horizon', 'Both stand facing. One foot on a sturdy chair or step beside the other’s hip. Wide opening — hold a wall.', 'Advanced', 3, 20, 'standing'),
  pos(20, 'The Couch Pivot', 'One sits on the very edge of an armrest. The other stands facing them. Horizontal leverage, seated partner stays relaxed.', 'Beginner', 5, 21, 'chair'),
  pos(21, 'The Split-Level Sphinx', 'Elbows on the bed in a sphinx, legs draping over the side. Partner stands on the floor, in line with the mattress.', 'Intermediate', 4, 22, 'edge'),
  pos(22, 'The Elevated Scissors', 'Both on their side. Lower partner uses a wedge under the hip so the pelvic plane tilts. Friction changes without extra hustle.', 'Beginner', 6, 23, 'side'),
  pos(23, 'The Reverse Cradle', 'Penetrating partner sits against the headboard. Receiving partner sits facing away, feet on the mattress, controls pace and depth.', 'Intermediate', 5, 24, 'slow'),
  pos(24, 'The Butterfly Arch', 'On the back, soles together, knees open over a firm cushion. Partner kneels between the knees. Stay in a range that does not pinch.', 'Beginner', 5, 25, 'slow'),
  pos(25, 'The Vertical Column', 'One stands against a wall. The other lifts one leg over the hip. Wall friction, not a lift-and-carry.', 'Advanced', 3, 26, 'standing'),
  pos(26, 'The Double Bolster', 'Pillows under pelvis and upper back, torso hollowed. Partner kneels from above. Gravity does some of the depth — you still choose it.', 'Intermediate', 4, 27, 'edge'),
  pos(27, 'The Twisted Willow', 'One on their back, legs long. The other lies prone on top but rotates the upper body 90 degrees, forearms on the mattress.', 'Advanced', 3, 28, 'prone'),
  pos(28, 'The Step-Stool Straddle', 'Secure fitness step at the bed edge. One stands elevated, the other rests lower body across the mattress edge.', 'Intermediate', 4, 29, 'edge'),
  pos(29, 'The Deep Diver', 'Kneel on the bed, chest and head down, hips high. Partner stands on the floor at the edge. Short range. Check necks.', 'Advanced', 3, 30, 'prone'),
  pos(30, 'The Gilded Gate', 'From Deep Diver, slowly extend one leg straight back over the partner’s shoulder. Axis changes. Stop if the hip pinches.', 'Advanced', 3, 31, 'prone'),
  pos(31, 'The Low-Profile Prone', 'Both on their stomachs, parallel. One pelvis shifts sideways over the other’s thigh. Maximum contact, tiny movement.', 'Beginner', 6, 32, 'prone'),
  pos(32, 'The Hanging Crescent', 'On the back on a high bed, legs hanging, feet toward the floor. Partner stands between the feet.', 'Beginner', 5, 33, 'edge'),
  pos(33, 'The Supported Helix', 'One sits on a fitness ball. The other straddles. The bounce is for micro-moves, not a circus.', 'Intermediate', 5, 34, 'chair'),
  pos(34, 'The X-Cross Alignment', 'One on their back. The other lies diagonally across, bodies in an X. Lateral contact, full upper-body warmth.', 'Beginner', 5, 35, 'slow'),
  pos(35, 'The Kneeling Ascent', 'Receiving partner kneels on the bed facing away. Partner stands on the floor behind, slight upward angle.', 'Intermediate', 4, 36, 'edge'),
  pos(36, 'The Sideways Saddle', 'Penetrating partner on their back. Receiving partner sits sideways across the thighs and moves laterally, not only up-down.', 'Beginner', 5, 37, 'slow'),
  pos(37, 'The Elevated Bridge Arch', 'Feet on the mattress, glutes in a supported bridge over a bolster. Partner kneels close. Hold only as long as the back is happy.', 'Intermediate', 4, 38, 'edge'),
  pos(38, 'The Standing Wrap', 'Penetrating partner stands on a wall. Receiving partner wraps both legs — only if both have the strength. Two seconds of pride is not worth a drop.', 'Advanced', 2, 39, 'lift'),
  pos(39, 'The Reclined Throne', 'From Standing Wrap, slide down the wall to sit, partner still in the straddle. Do not drop them on the way down.', 'Intermediate', 5, 40, 'lift'),
  pos(40, 'The Offset Pivot', 'Low bench, one leg extended, one bent. Partner straddles at about 45 degrees for uneven depth you can aim.', 'Intermediate', 4, 41, 'chair'),
  pos(41, 'The Prone Horizon', 'Face down, fully flat. Partner on top but slid down so chest meets the lower back. Long and lazy.', 'Beginner', 5, 42, 'prone'),
  pos(42, 'The Winged Crescent', 'On the back, legs straight up. Partner kneels, holding ankles. Do not yank. Hamstrings set the limit.', 'Advanced', 3, 43, 'edge'),
  pos(43, 'The Low-Level Lotus', 'Both sit facing on the floor, no cushion. Lean back on hands. Slow pelvic tilts only.', 'Intermediate', 4, 44, 'close'),
  pos(44, 'The Asymmetric Sphinx', 'Elbows down, one knee out, other leg straight. Partner at a shallow diagonal from behind.', 'Intermediate', 5, 45, 'prone'),
  pos(45, 'The Standing Incline', 'Bend about 90 degrees, hands on a sturdy desk. Partner behind, knees bent to match height. No bouncing the table.', 'Beginner', 5, 46, 'standing'),
  pos(46, 'The Chair Straddle Tilt', 'Deep in a tilting office chair. Receiving partner faces them, using armrests. Lock the wheels.', 'Beginner', 5, 47, 'chair'),
  pos(47, 'The Crossed Scissors', 'On sides facing away, legs interlaced. Unusual angle. Tiny moves until it actually feels good.', 'Advanced', 3, 48, 'side'),
  pos(48, 'The Bolster Fusion', 'Receiving partner sits on a high bolster stack. Partner lies on their back between the bolsters, pushing up from below.', 'Advanced', 4, 49, 'edge'),
  pos(49, 'The Tabletop Lever', 'Sit on a dining table edge. Partner stands, receiving partner’s knees on their forearms. Table must be solid.', 'Intermediate', 4, 50, 'edge'),
  pos(50, 'The Reclined Half-Lotus', 'Cross-legged, leaning back on pillows at about 30 degrees. Partner straddles and leans forward to share weight.', 'Beginner', 5, 51, 'close'),
  pos(51, 'The Diagonal Prone', 'Face down at 45 degrees across a bed corner. Partner at the side of the bed, sliding over the edge.', 'Intermediate', 4, 52, 'prone'),
  pos(52, 'The Counter-Lever Arch', 'Lean over the back of a heavy sofa. Partner behind, hands on the frame. Precise line, not a slam.', 'Beginner', 5, 53, 'standing'),
  pos(53, 'The Stacked Slingshot', 'On the back, calves over the kneeling partner’s shoulders. Opens the angle. Breathe. Do not force the fold.', 'Intermediate', 4, 54, 'edge'),
  pos(54, 'The Reverse Helix', 'Penetrating partner on their back. Receiving partner kneels facing away, chest upright, controls the drop.', 'Intermediate', 5, 55, 'slow'),
  pos(55, 'The High Wall Column', 'On the back, glutes to the wall, legs up the wall. Partner kneels close. Easy on the hips if you stay near the wall.', 'Beginner', 5, 56, 'slow'),
  pos(56, 'The Side-Lying Anchor', 'Same-direction side-lying. Top partner’s leg over the other’s torso to open the hip. Still a rest position if you keep it slow.', 'Intermediate', 5, 57, 'side'),
  pos(57, 'The Suspended Platform', 'Arch over a padded bench, hips high. Partner at the bench edge. Only with a bench that will not walk, and a neck that likes it.', 'Advanced', 3, 58, 'edge'),
  pos(58, 'The Deep Seated Pivot', 'Sit facing, legs around waists, forearms locked. Movement is only micro-tilts. Good for lasting.', 'Intermediate', 5, 59, 'close'),
  pos(59, 'The Circular Loop', 'From Deep Seated Pivot, both roll onto their sides together without breaking contact. Land in a rest. Loop back to Lotus if you want another pass.', 'Beginner', 6, 1, 'slow'),
];

/** Shown a few at a time — briefing first, then one fresh line per position. */
export const INTIMACY_TIPS: IntimacyTip[] = [
  { id: 't1', kind: 'last-longer', title: 'Start at 70%', line: 'First minutes are not a race. Stay at a pace you could hold while talking. Speed is how people finish early.' },
  { id: 't2', kind: 'last-longer', title: 'Exhale on the peak', line: 'When it spikes, breathe out long and drop the hips 10%. Do not hold your breath and push through.' },
  { id: 't3', kind: 'last-longer', title: 'Swap the job', line: 'Hands, mouth, grinding on the outside. Penetration is one tool. Switching is how you last, not a failure.' },
  { id: 't4', kind: 'last-longer', title: 'The 20-second pause', line: 'When you are close, freeze, kiss, laugh. Twenty seconds. Then start slower than you left.' },
  { id: 't5', kind: 'last-longer', title: 'Let them move', line: 'If you always drive, you finish first. Let the other person set the count for a full song.' },
  { id: 't6', kind: 'last-longer', title: 'Pelvic floor, not panic', line: 'A slow squeeze-and-release of the pelvic floor on the pause beats tensing your whole body.' },
  { id: 't7', kind: 'last-longer', title: 'Two-round plan', line: 'If you finish fast, stay in contact. Round two is usually longer. Shame kills that more than biology.' },
  { id: 't8', kind: 'do', title: 'Lube is a skill', line: 'More than you think, earlier than you think. Dry friction makes people rush and wince.' },
  { id: 't9', kind: 'do', title: 'Say the check-in', line: '“Still good?” is sexy. Silence while someone endures is not chemistry.' },
  { id: 't10', kind: 'do', title: 'Pillows are equipment', line: 'A wedge under hips changes the whole map. Use them before you force a stretch.' },
  { id: 't11', kind: 'do', title: 'Warm first', line: 'Ten minutes of kissing and hands before any of these shapes. Cold muscles cramp. Cold minds rush.' },
  { id: 't12', kind: 'do', title: 'Match height', line: 'Bend knees, use the bed edge, stand on a step. Matching pelvis height beats lifting people.' },
  { id: 't13', kind: 'dont', title: 'Do not chase the porn angle', line: 'If a shape needs a stunt spine, skip it. The interesting version is the one you can hold.' },
  { id: 't14', kind: 'dont', title: 'Do not slam advanced', line: 'Advanced here means leverage, not harder. Short range. If it pinches, you already went too far.' },
  { id: 't15', kind: 'dont', title: 'Do not hide that you are close', line: 'Say “I’m close.” They can slow, switch, or enjoy it. Surprise-finishing is how resentment starts.' },
  { id: 't16', kind: 'dont', title: 'Do not skip the stop word', line: 'Pain, numb, or “wait” ends the position. Pride is not a third partner.' },
  { id: 't17', kind: 'dont', title: 'Do not stand-wrap on a first try', line: 'Lifts are for people who already trust each other’s strength. Wall or bed instead.' },
  { id: 't18', kind: 'do', title: 'Eye contact on the slow ones', line: 'Lotus, cradle, seated pivot — look. That is the point of those shapes, not depth.' },
  { id: 't19', kind: 'last-longer', title: 'Change the angle, not the speed', line: 'A 10-degree tilt is a new nerve. Faster is the same nerve, sooner.' },
  { id: 't20', kind: 'do', title: 'Water and a laugh', line: 'Between positions, drink, stretch the hip that just worked, say one true thing. That is aftercare in the middle.' },
];

const BRIEFING_IDS = ['t11', 't1', 't8', 't9', 't4'] as const;

const VIBE_TIP: Record<IntimacyVibe, string[]> = {
  close: ['t18', 't5', 't2'],
  side: ['t19', 't3', 't1'],
  edge: ['t10', 't14', 't12'],
  standing: ['t12', 't17', 't16'],
  chair: ['t12', 't5', 't8'],
  prone: ['t8', 't14', 't19'],
  lift: ['t17', 't16', 't6'],
  slow: ['t1', 't4', 't18'],
};

function tipById(id: string): IntimacyTip {
  return INTIMACY_TIPS.find((t) => t.id === id) || INTIMACY_TIPS[0];
}

export function briefingTips(): IntimacyTip[] {
  return BRIEFING_IDS.slice(0, 3).map(tipById);
}

export function tipsForPosition(pos: IntimacyPosition, stepIndex: number): { now: IntimacyTip; extra: IntimacyTip } {
  const pool = VIBE_TIP[pos.vibe];
  const now = tipById(pool[stepIndex % pool.length]);
  const extraKind: TipKind = pos.difficulty === 'Advanced' ? 'dont' : stepIndex % 2 === 0 ? 'last-longer' : 'do';
  const extra =
    INTIMACY_TIPS.filter((t) => t.kind === extraKind && t.id !== now.id)[stepIndex % 5] || INTIMACY_TIPS[13];
  return { now, extra };
}

export function positionById(id: number): IntimacyPosition | undefined {
  return INTIMACY_POSITIONS.find((p) => p.id === id);
}

export function nextPosition(pos: IntimacyPosition): IntimacyPosition {
  return positionById(pos.nextPositionId) || INTIMACY_POSITIONS[0];
}
