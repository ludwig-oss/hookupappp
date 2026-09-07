export type TermActSide = 'him-to-her' | 'her-to-him';
export type TermActCategory =
  | 'Psychological'
  | 'Sensory'
  | 'Advanced Oral'
  | 'Core Tension'
  | 'Edging'
  | 'Transitions';

export interface TermActTactic {
  id: number;
  category: TermActCategory;
  name: string;
  description: string;
  duration_minutes: number;
  next_id: number;
}

function wrap(id: number): number {
  return id === 80 ? 1 : id + 1;
}

function mins(id: number): number {
  return 2 + (id % 5);
}

function t(id: number, category: TermActCategory, name: string, description: string): TermActTactic {
  return { id, category, name, description, duration_minutes: mins(id), next_id: wrap(id) };
}

/** Male-presenting partner applying tactics with a female-presenting partner. Adults, mutual opt-in. */
export const him_to_her_db: TermActTactic[] = [
  t(1, 'Psychological', 'The Permission Pause', 'Rest both palms on the iliac crests. Hold still 8–10 seconds. Ask a yes/no check. Proceed only after an affirmative. Keep the pelvis unloaded so the nervous system registers consent before amplitude.'),
  t(2, 'Sensory', 'Temperature Gradient Sweep', 'Warm one palmar surface against your own thorax, cool the other with room air. Alternate long strokes from the anterior thigh to the lower abdomen. Keep pressure even. Do not cross into pain or tickle-threshold jerking.'),
  t(3, 'Advanced Oral', 'Still-Point Hover', 'Align the mouth over the glans clitoris without contact for two full breaths. Then apply a small, stationary mucosal seal. No licking yet. Increase contact area only after the pelvis settles, not after it lifts.'),
  t(4, 'Core Tension', 'Iliac Clock Press', 'Place thenar eminences on the anterior superior iliac spines. Apply slow clockwise load for one breath, counterclockwise for the next. Keep the lumbar spine supported. Cue a posterior pelvic tilt if the lumbar hyperextends.'),
  t(5, 'Edging', 'Three-Breath Hold', 'When pelvic floor flutter or breath shortening appears, freeze all distal contact. Count three shared exhales. Resume at 40% of the prior amplitude. Stop immediately on numbness, pain, or a verbal wait.'),
  t(6, 'Transitions', 'Kneel-to-Close Shift', 'From a kneeling stance between the femurs, slide both hands under the ischial tuberosities and guide a slow hip flexion as you close the distance. Keep cervical spines neutral. Pause for a joint-comfort check at the new angle.'),
  t(7, 'Psychological', 'Name-the-Want Loop', 'State one specific next contact in plain anatomy (“palm on lower abdomen”). Wait for a yes. Execute only that. Do not stack a second action until the first is acknowledged. Silence is not consent.'),
  t(8, 'Sensory', 'Dual-Texture Pass', 'Use a smooth dorsal hand on the inner thigh and a slightly firmer palmar hand on the outer hip. Travel proximal in 4-second strokes. Keep the two textures out of phase so the cortex tracks contrast, not speed.'),
  t(9, 'Advanced Oral', 'Lateral Mapping Pass', 'With a flat tongue, map left then right of the glans clitoris in slow parallel lines. Avoid a single-point attack on the apex. Re-center only when the thighs stop adducting against you.'),
  t(10, 'Core Tension', 'Pubic-Bone Anchor', 'Rest the heel of one hand on the mons pubis with no distal motion. The other hand supports the sacrum. Hold isometric contact while both people match inhale length. Release if the pubic bone feels bruised.'),
  t(11, 'Edging', 'Near-Peak Recoil', 'At the first sign of a plateau (breath hold, hip chase), reduce contact area by half and withdraw 2 cm. Hold the reduced map for two breaths. Rebuild only if the pelvic floor drops, not if it clamps.'),
  t(12, 'Transitions', 'Side-Lying Handoff', 'Guide both bodies onto the same side. Upper femur flexes ~90°. Your anterior torso stays along the back. Transfer load from your arms to the mattress before any distal motion. Check the down-side shoulder.'),
  t(13, 'Psychological', 'Eye-Contact Timeout', 'Stop all motion. Hold eye contact for five seconds. Ask “still good?” Resume only after a clear yes. If they look away, reduce intensity rather than chasing the gaze.'),
  t(14, 'Sensory', 'Breath-Matched Stroke', 'Time each proximal stroke to their exhale. On inhale, hold still. If their breath shortens, shorten the stroke, never speed it up. Palpate the lower ribs to feel the cycle.'),
  t(15, 'Advanced Oral', 'Soft-Then-Firm Alternation', 'Four seconds of broad, low-pressure mucosal contact around the vestibule, then two seconds of slightly firmer midline contact. Return to broad. Never jump from zero to peak pressure on the glans clitoris.'),
  t(16, 'Core Tension', 'Pelvic Tilt Hold', 'Cue a posterior pelvic tilt with a hand under the sacrum. Hold the new orientation 20 seconds with no thrusting. If the lumbar over-arches, add a pillow under the knees, not more force.'),
  t(17, 'Edging', 'Counted Retreat', 'When close, count backward from five out loud. On each number, reduce amplitude 15%. At zero, full pause. Restart at the count-three intensity, not the original.'),
  t(18, 'Transitions', 'Seated Wrap Transfer', 'Sit on the mattress edge. Guide them astride with both feet grounded if possible. Support the lumbar with your forearm. Do not let the full bodyweight hang from the hip flexors.'),
  t(19, 'Psychological', 'Anticipation Gap', 'Announce the next contact, then wait four seconds before touching. Keep hands visible. The gap is the tactic; filling it early collapses the effect.'),
  t(20, 'Sensory', 'Pressure-Wave Palm', 'Apply a slow palmar wave from the lower ribs to the anterior iliac crest. Peak pressure at the wave’s center, taper at the edges. One wave per four seconds. Skip the breasts if they are tender.'),
  t(21, 'Advanced Oral', 'Circumferential Trace', 'Trace a slow oval around the glans clitoris without crossing the apex for six cycles. On the seventh, a single light apex pass, then return to the oval. Watch for adductor flinch as a stop cue.'),
  t(22, 'Core Tension', 'Inner-Thigh Clamp Cue', 'Place palms on the medial thighs and ask for a 30% isometric adduction against your hands, then a full release. Repeat three times. Distal contact stays off until the third release.'),
  t(23, 'Edging', 'Plateau Step-Down', 'If they are on a plateau, drop to 25% contact for 30 seconds. Speak only logistics (“slowing”). Rebuild in 10% steps. Do not treat a plateau as a request to go harder.'),
  t(24, 'Transitions', 'Prone-to-Supine Roll', 'From prone, roll as a unit toward you using the scapula and pelvis, not the neck. Pause supine with knees bent. Recheck breathing before any genital contact resumes.'),
  t(25, 'Psychological', 'Whispered Next-Move', 'State the next mechanical step in a low voice at the ear, then wait for a nod. Execute exactly that step. Novelty here is precision, not surprise contact they did not agree to.'),
  t(26, 'Sensory', 'Cool-Then-Warm Contrast', 'A single cool exhale over the lower abdomen, then a warm palmar cover. Repeat along the inner thigh. Avoid blowing on mucosa if it dries or stings. Stop if they shiver from cold, not arousal.'),
  t(27, 'Advanced Oral', 'Focused Apex Pause', 'After mapping, rest a still, wet seal on the glans clitoris. No suction spikes. Hold 10–15 seconds. If the hips lift off the surface, reduce seal rather than matching the lift.'),
  t(28, 'Core Tension', 'Sacral Counter-Pressure', 'One hand on the sacrum, one on the lower abdomen, gentle opposition so the pelvis feels “held.” Distal work stays small. Release if the sacroiliac joint complains.'),
  t(29, 'Edging', 'Edge-and-Reset Ladder', 'Approach a peak, drop to a 2-second full stop, rebuild to 70% of the last peak, drop again. Three rungs maximum, then a longer rest. More rungs usually means a rushed finish.'),
  t(30, 'Transitions', 'Standing-to-Kneel Drop', 'From standing close contact, you kneel first, hands on their hips for balance. They stay standing only if knees are stable. Offer a wall for their scapulae. No distal contact during the drop.'),
  t(31, 'Psychological', 'Consent Recheck Beat', 'Mid-sequence, stop. Ask “more, same, or less?” Change only according to the answer. “Same” means hold parameters, not escalate.'),
  t(32, 'Sensory', 'Hairline-to-Nape Draw', 'Fingertips from the frontal hairline to C7 at 3 cm/s. Other hand stays on the iliac crest as an anchor. Skip if hair or scalp is sensitive. This is a down-regulation pass.'),
  t(33, 'Advanced Oral', 'Broad-Then-Narrow Path', 'Start with the flat of the tongue over a wide vestibular area. Every 20 seconds, narrow the contact band by ~1 cm. Stop narrowing when the thighs start to chase; widen again.'),
  t(34, 'Core Tension', 'Hip-Lock Stillness', 'Hold their pelvis still with both hands at the iliac crests. Your torso may breathe; the pelvis does not translate. Thirty seconds. Motion without translation is the drill.'),
  t(35, 'Edging', 'Two-Peak Delay', 'Allow a first high plateau, then fully stop for 45 seconds of non-genital contact (back, arms). Second approach stays 20% slower. Do not stack peaks without the rest.'),
  t(36, 'Transitions', 'Missionary Angle Change', 'From a face-to-face supine setup, shift your knees 10–15 cm caudal or cephalad to change hip flexion. Recheck pubic bone comfort. Small geometry beats large thrusting.'),
  t(37, 'Psychological', 'Gratitude Naming', 'Name one thing they did that worked (“the slower breath helped”). Then pause. Competence feedback lowers threat. Do not use it to bargain for more intensity.'),
  t(38, 'Sensory', 'Fingertip Rain', 'Very light, irregular dorsal fingertip contact over the lower abdomen and anterior thighs. No pattern they can predict. Keep nails short. Stop if it becomes ticklish rather than settling.'),
  t(39, 'Advanced Oral', 'Perineal Support Hold', 'While the mouth stays broad and slow at the vulva, the non-dominant hand supports the perineum with flat, low pressure. No probing. Support reduces guarding in the pelvic floor.'),
  t(40, 'Core Tension', 'Deep-Flexion Brace', 'Guide hip flexion with knees toward the thorax only as far as the hips allow. Brace their feet against your torso or a wall. Hold. Pain at the hip crease is a stop, not a stretch goal.'),
  t(41, 'Edging', 'Stop-Start Cadence', 'Eight seconds of distal contact, four seconds of full still. Repeat for the interval. If they chase during the still, extend the still, do not shorten it.'),
  t(42, 'Transitions', 'Spooning Handoff', 'Move to lateral spooning. Your anterior hip stays behind theirs. Upper hand on the lower abdomen, lower arm under the neck only if the shoulder is happy; otherwise under the pillow.'),
  t(43, 'Psychological', 'Slow Permission Ask', 'Ask for one anatomical yes (“hand on inner thigh?”). Wait. Place the hand. Count to four before any stroke. Asking is the arousal mechanism, not a formality to rush.'),
  t(44, 'Sensory', 'Oil-Then-Dry Contrast', 'If skin is intact and they agree, a small amount of lubricant on one thigh, dry palmar pass on the other. Keep lubricant off the urethral meatus if it stings. Wipe excess; more slip is not always better.'),
  t(45, 'Advanced Oral', 'Mapping Grid', 'Imagine a 3×3 grid over the vulva. Visit each cell for two breaths with even, light pressure. Skip a cell if they flinch. Do not camp on the center cell first.'),
  t(46, 'Core Tension', 'Knee-Spread Anchor', 'Support the lateral knees so abduction is comfortable, not forced. Your forearms take the load. Distal contact only after the adductors unclench. Forced abduction is a fail.'),
  t(47, 'Edging', 'Reverse-Count Edge', 'From a high intensity, count 8-7-6… each count a 10% drop. At 1, full pause. They should still be able to speak a sentence at 4. If not, you dropped too late.'),
  t(48, 'Transitions', 'Chair-to-Bed Transfer', 'If using a chair, stand them with both feet planted, then sit them onto the mattress with your hands at the scapulae and sacrum. Transfer is complete before any genital contact resumes.'),
  t(49, 'Psychological', 'Future-Scene Brief', 'In one sentence, describe the next two minutes of mechanics (“slow oral, then still hips”). Get a yes. Do not add a surprise third act. Predictability here is safety, not boredom.'),
  t(50, 'Sensory', 'Pulse-Matched Pressure', 'Find a radial or carotid-adjacent pulse if they are comfortable with neck proximity; otherwise match your own. Time palmar pressure waves to that cadence. If you cannot feel it, use breath instead.'),
  t(51, 'Advanced Oral', 'Indirect Approach Arc', 'Approach the glans clitoris from 7 o’clock, arc to 5 o’clock, never a straight 12-to-6 attack. Two arcs, then a rest. Direct midline too early often causes guarding.'),
  t(52, 'Core Tension', 'Pelvic Floor Cue', 'Ask them to gently lift the pelvic floor 20%, then drop it fully. Your contact stays still during both. Distal motion only after a successful drop. Clenching is not “more ready.”'),
  t(53, 'Edging', 'Micro-Pause Stack', 'Insert a 1-second freeze every 5 seconds of contact. After two minutes, make freezes 2 seconds. The stack trains the system not to sprint. Skip if it becomes irritating.'),
  t(54, 'Transitions', 'Lotus Seat Shift', 'Move toward a seated face-to-face fold only as far as both hip external rotations allow. Pads under knees. If a hip pinches, abandon lotus; side-sit instead.'),
  t(55, 'Psychological', 'Competence Display Pause', 'Stop to adjust a pillow, water, or temperature out loud. Visible care regulates threat. Then resume at the prior intensity, not higher “because you were good.”'),
  t(56, 'Sensory', 'Scalp-to-Spine Line', 'One continuous slow line from the occiput down the thoracic spine to L5. Second hand stays on the hip. Avoid pressing spinous processes hard. This is a downshift before more distal work.'),
  t(57, 'Advanced Oral', 'Dual-Hand Asymmetry', 'Mouth stays slow and broad. One hand on the lower abdomen (calming), one supporting a thigh. Do not let both hands become busy at the vulva. Asymmetry keeps the map readable.'),
  t(58, 'Core Tension', 'Hip-Flexor Lengthen', 'In a lunge-like kneeling setup, ease their hip into a gentle extension only if there is no pinch. Hold 20 seconds. Distal contact paused. Tight flexors make thrusting feel like a fight.'),
  t(59, 'Edging', 'Denied Peak, Held Gaze', 'At the first involuntary peak-chase, freeze contact and hold calm eye contact. No grinning, no dare. Resume at half amplitude after they exhale fully twice.'),
  t(60, 'Transitions', 'Wall-to-Floor Descent', 'If they were standing at a wall, you guide a controlled sit-to-floor or sit-to-bed using the wall for their back. Knees never slam. Recheck wrists and neck after the descent.'),
  t(61, 'Psychological', 'Mirror Permission', 'If a mirror is used, ask first. They control whether they watch. You describe only alignment (“knees wider, shoulders down”), not commentary on bodies. Opt-out means the mirror goes.'),
  t(62, 'Sensory', 'Breath-on-Skin Track', 'Warm exhale along the sternum to the navel, then palmar cover. Keep the stream off the face if it is annoying. Two tracks, then return to hands-only.'),
  t(63, 'Advanced Oral', 'Circumferential Slowing', 'If they are speeding their hips, you slow the oral path to half and widen it. Matching their speed usually ends the sequence early. Lead with deceleration.'),
  t(64, 'Core Tension', 'Ischial Support', 'Cup the ischial tuberosities and take a fraction of their seated or supine load. Pelvis feels supported, not perched. Then small distal motion. Unstable sitting creates clamping.'),
  t(65, 'Edging', 'Five-Second Recoil', 'On “close,” remove distal contact for five full seconds. Non-genital hand stays. Return at 50%. If five seconds feels impossible, you were already past the useful edge.'),
  t(66, 'Transitions', 'Straddle Dismount', 'From astride, they dismount to the side with your hands at the waist. You do not pull them off. Feet find the floor or mattress before you change the plan.'),
  t(67, 'Psychological', 'Status-Drop Compliment', 'A short, specific non-appearance line (“your pacing is clear”). Then silence. Do not follow with a request. The drop in performance pressure is the point.'),
  t(68, 'Sensory', 'Weighted Blanket Press', 'Forearm or torso provides broad, even load across the upper back or pelvis (agreed zone). Ten seconds. This is deep pressure, not pin-down. They must be able to shift you off easily.'),
  t(69, 'Sensory', 'Lateral-to-Medial Sweep', 'Long strokes from the lateral hip toward the midline, stopping before the vestibule. Ten passes. Medial arrival is later, not now. Skipping the sweep jumps the map.'),
  t(70, 'Core Tension', 'Core Brace Cue', 'Ask for a light abdominal brace (as if coughing softly), then a full release. Your distal contact waits for the release. A braced core plus hard thrusting fights the pelvic floor.'),
  t(71, 'Edging', 'Plateau Walk', 'Stay at a medium intensity that they can talk through for a full minute. If speech fails, you are too high. Walking a plateau lasts longer than spike-and-crash.'),
  t(72, 'Transitions', 'Side-Entry Pivot', 'From supine, pivot both toward a side-lying entry angle. Adjust the upper femur with a hand under the knee. Pubic bones should not crash. Pillows between knees if adductors cramp.'),
  t(73, 'Psychological', 'Aftercare Preview', 'Before a last high plateau, state the aftercare you will do (water, covering, still hold). Knowing the landing reduces panic at intensity. Then keep the promise.'),
  t(74, 'Sensory', 'Joint-Warmth Transfer', 'Cover their hands with yours until both are warm, then move those hands to their own lower abdomen. Shared temperature before more distal maps. Cold hands on mucosa is a fail.'),
  t(75, 'Advanced Oral', 'Apex Isolation', 'After a wide map, isolate the glans clitoris with a small, still seal for 8 seconds, then return to wide. Isolation is a visit, not a home. Watch for overstimulation flinch.'),
  t(76, 'Core Tension', 'Posterior Tilt Cue', 'Hand under the sacrum, ask for a small posterior tilt and hold. Thrusting into an anterior tilt often jams the pubic bone. Geometry first, amplitude second.'),
  t(77, 'Edging', 'Nested Edges', 'Two short edges (approach, 70% drop) inside one longer two-minute window, then a full minute of non-genital contact. Nested, not continuous climbing.'),
  t(78, 'Transitions', 'Seated Lift-Off', 'From sitting astride, you lean back on locked arms, they stay upright. Change hip angle without standing up. Wrists stacked under shoulders. Stop if wrists hurt.'),
  t(79, 'Psychological', 'Safety Word Rehearsal', 'Say the stop word together once, then a yellow-pace word if you have one. Resume only after both can repeat them. Rehearsal is not a mood-killer; it is load-bearing.'),
  t(80, 'Transitions', 'Full-Body Still Reset', 'All distal contact off. Full-length or side hold, matching breath, 60–90 seconds. This is the wrap from 80 back toward 1. Do not skip the reset to “keep the mood.”'),
];

/** Female-presenting partner applying tactics with a male-presenting partner. Adults, mutual opt-in. */
export const her_to_him_db: TermActTactic[] = [
  t(1, 'Psychological', 'Pace Authority', 'You set the cadence out loud (“slow for two minutes”). Your hands lead; his hips follow. If he speeds, you pause entirely until he matches. Authority here is tempo, not force.'),
  t(2, 'Sensory', 'Temperature Collar Sweep', 'Warm palms at the upper trapezius, then a cooler pass down the sternum. Avoid anterior neck pressure. End with both hands on the lower ribs so breath is easy to feel.'),
  t(3, 'Advanced Oral', 'Still-Point Crown Hover', 'Align over the glans penis without contact for two breaths, then a still, wet seal at the corona—not a deep take. No suction spikes. Hold until his hip chase stops.'),
  t(4, 'Core Tension', 'Hip-Guide Palms', 'Palms on his anterior iliac crests. You permit or deny translation. Small posterior tilt if he is bracing the lumbar. Your hands are the metronome, not his pace.'),
  t(5, 'Edging', 'Three-Breath Gate', 'When the dartos or pelvic floor tightens and breath shortens, freeze distal contact. Three shared exhales. Resume at 40% stroke length. Pain, numbness, or “wait” ends the gate.'),
  t(6, 'Transitions', 'Straddle-to-Kneel Shift', 'From astride, you step a knee to the mattress and kneel beside, keeping one hand on his hip so he is not dropped. Recheck his cervical comfort before oral or manual maps resume.'),
  t(7, 'Psychological', 'Want-Named First', 'You name the next contact in anatomy (“hand at the base, still”). He answers yes or no. You do not interpret a moan as a yes for a new act. One want at a time.'),
  t(8, 'Sensory', 'Dual-Texture Shaft Map', 'Lubricated palmar surface on the shaft, dry dorsal fingertips on the lower abdomen. Out of phase. Keep the frenulum out of the first minute if he is already close.'),
  t(9, 'Advanced Oral', 'Circumferential Unhurried Pass', 'Lips travel a slow ring just distal to the corona, then a rest. Depth stays shallow. If he pushes for depth, you hold the head still with a hand on the hip, not the neck.'),
  t(10, 'Core Tension', 'Perineal Support Base', 'Flat, low pressure on the perineum with the thenar eminence—no probing toward the anus unless separately agreed. Combined with a still hand at the base of the penis. Support, not milking.'),
  t(11, 'Edging', 'Near-Peak Recoil', 'At the first pre-ejaculatory signs (breath hold, increased glans flush, hip chase), reduce stroke amplitude by half and shorten the map. Two breaths. Rebuild only if the pelvic floor drops.'),
  t(12, 'Transitions', 'Side-Lying Takeover', 'Guide him onto his side, you behind or facing. Upper femur flexed. You control the distal hand; his top arm rests. Unloads the lumbar versus prolonged supine bracing.'),
  t(13, 'Psychological', 'Eye-Hold Command', 'Stop motion. Hold his gaze five seconds. “Still good?” Resume only on a clear yes. If he shuts his eyes to hide closeness, ask for a number 1–10 instead of guessing.'),
  t(14, 'Sensory', 'Breath-Synced Stroke', 'Manual or oral stroke only on his exhale. Hold on inhale. If he cannot keep a long exhale, you have been too fast. Place a hand on the lower ribs to feel the cycle.'),
  t(15, 'Advanced Oral', 'Soft-Firm Alternation', 'Four seconds of broad, low suction-free contact along the shaft, two seconds of slightly firmer focus at the corona, then broad again. No teeth. No sudden vacuum.'),
  t(16, 'Core Tension', 'Pelvic-Cue Stillness', 'Hand on the lower abdomen, ask him to drop the belly and unclench the glutes. Distal contact paused until you feel the drop. Clenched glutes plus fast stroke is how sequences end early.'),
  t(17, 'Edging', 'Counted Retreat', 'When close, count backward from five. Each number shortens the stroke 15%. At zero, full pause with a palm on the abdomen. Restart at count-three intensity.'),
  t(18, 'Transitions', 'Seated Wrap Transfer', 'You sit against the headboard; he sits between your legs, back to your thorax. Your arms wrap the lower ribs. Distal contact from here stays slow; you can feel his breath against you.'),
  t(19, 'Psychological', 'Anticipation Gap', 'Announce the next contact, wait four seconds, then touch. Hands stay where he can see them until the touch. Filling the gap early trains him to rush you.'),
  t(20, 'Sensory', 'Thenar Pressure Wave', 'Thenar wave from the lower ribs to the inguinal crease, not onto the penis yet. One wave per four seconds. This loads the trunk before the map goes distal.'),
  t(21, 'Advanced Oral', 'Frenulum Isolation Pause', 'After a wide shaft map, a still, wet pause at the frenulum for 6–8 seconds, then away. Isolation is brief. Overstaying here often ends the interval.'),
  t(22, 'Core Tension', 'Inner-Thigh Clamp Cue', 'Palms on his medial thighs: 30% isometric adduction against you, then full release, three times. Distal contact off until the third release so the adductors stop guarding.'),
  t(23, 'Edging', 'Plateau Step-Down', 'If he is on a high plateau, drop to 25% for 30 seconds of non-genital contact (chest, arms). Rebuild in 10% steps. Harder is not the fix for “almost.”'),
  t(24, 'Transitions', 'Prone-to-Supine Roll', 'From prone (if you were working the back), roll him toward you as a unit. Protect the neck. Supine, knees bent, before any genital map resumes.'),
  t(25, 'Psychological', 'Next-Move Whisper', 'At the ear, one mechanical sentence. Wait for a nod. Execute only that. You are not performing novelty; you are running a protocol he can track.'),
  t(26, 'Sensory', 'Cool-Then-Warm Contrast', 'Cool exhale over the lower abdomen, then warm palmar cover. Avoid a dry stream on the glans. Two cycles, then hands-only so mucosa does not chill.'),
  t(27, 'Advanced Oral', 'Broad-Then-Apex Path', 'Flat-tongue or broad-lip contact along the shaft first. Apex/corona later, and only after the hips settle. Early apex-only maps spike him off the interval.'),
  t(28, 'Core Tension', 'Sacral Counter-Pressure', 'One hand sacrum, one lower abdomen, gentle opposition. His pelvis feels held. Distal stroke stays small. SI-joint pain means you release, not press harder.'),
  t(29, 'Edging', 'Edge Ladder', 'Approach, drop to a 2-second stop, rebuild to 70%, drop again. Three rungs, then a longer rest with your head on his chest so you can hear breath, not guess it.'),
  t(30, 'Transitions', 'Standing-to-Kneel Drop', 'If standing, you kneel first with a hand on his hip. He may stay standing only with a wall or stable knees. No deep oral during the drop; alignment first.'),
  t(31, 'Psychological', 'Consent Recheck Beat', 'Midway: “more, same, or less?” Change only to the answer. “More” still has a cap you choose. You are allowed to stay at same.'),
  t(32, 'Sensory', 'Scalp-to-Nape Draw', 'Fingertips hairline to C7 at 3 cm/s while the other hand stays at the hip. Down-regulation before another distal climb. Skip if he has a headache or scalp pain.'),
  t(33, 'Advanced Oral', 'Two-Hand Asymmetry', 'Mouth slow and shallow. One hand at the base (stabilizing), one on the abdomen (calming). Do not let both hands race the shaft. Readable map, not busywork.'),
  t(34, 'Core Tension', 'Hip-Lock Guide', 'Both hands lock his pelvis. He may breathe; the pelvis does not thrust. Thirty seconds. If he cannot stay still, you were already too high before the lock.'),
  t(35, 'Edging', 'Two-Peak Delay', 'First high plateau, then 45 seconds of back or chest contact only. Second approach 20% slower with more lubrication if friction rose. No stacked peaks without the rest.'),
  t(36, 'Transitions', 'Angle-Change Seat', 'From astride, shift your knees 10 cm to change hip flexion and the angle of any penetration that is already agreed. Pubic bone comfort check. Small geometry, not harder.'),
  t(37, 'Psychological', 'Competence Naming', 'Name one thing he did that helped (“you slowed when I asked”). Pause. Do not cash it in for a faster request. Feedback lowers performance threat.'),
  t(38, 'Sensory', 'Fingertip Rain', 'Irregular light dorsal contact over the abdomen and anterior thighs, skipping the glans. Unpredictable but gentle. Stop if it tickles into withdrawal rather than settling.'),
  t(39, 'Advanced Oral', 'Base Support Hold', 'Mouth at a shallow, still seal; non-dominant hand supports the base and scrotum as a unit with heat, not squeeze. Watch for testicular pain—immediate release.'),
  t(40, 'Core Tension', 'Deep-Flexion Brace', 'If hips allow, guide his knees toward the thorax with support, not force. Hold. Hip pinch is a stop. This changes pelvic floor tone before any faster distal work.'),
  t(41, 'Edging', 'Stop-Start Cadence', 'Eight seconds distal, four seconds full still. If he thrusts in the still, lengthen the still. You are training the reflex, not winning a race.'),
  t(42, 'Transitions', 'Spooning Handoff', 'Lateral spoon: you behind, hand on his lower abdomen, other arm free for a slow shaft map if agreed. His down-side shoulder stacked, not crushed.'),
  t(43, 'Psychological', 'Slow Permission Ask', '“Hand on inner thigh?” Wait. Place. Count four before any stroke toward the groin. The ask is the tactic. Skipping it teaches him to grab the pace back.'),
  t(44, 'Sensory', 'Oil-Then-Dry Contrast', 'Agreed lubricant on the shaft, dry palmar pass on the hip. Keep lubricant off the urethral opening if it burns. Re-apply; dry friction is a common early-finish cause.'),
  t(45, 'Advanced Oral', 'Mapping Grid', 'Treat the penis as zones: base, midshaft, corona, glans dorsum, frenulum. Two breaths per zone, even pressure. Do not start on frenulum plus glans together.'),
  t(46, 'Core Tension', 'Knee-Spread Anchor', 'Support his knees in a comfortable abduction. Forced frog-leg is a fail. Distal contact after the adductors unclench. You hold the load, not his hip capsules.'),
  t(47, 'Edging', 'Reverse-Count Edge', 'From high intensity, 8 down to 1, each a 10% drop. At 4 he should still form a sentence. If not, drop faster next time. At 1, full pause.'),
  t(48, 'Transitions', 'Chair-to-Bed Transfer', 'From a chair, both feet plant, then you sit him onto the mattress with hands at scapulae and sacrum. Genital contact off until he is fully on the bed.'),
  t(49, 'Psychological', 'Future-Scene Brief', 'One sentence for the next two minutes of mechanics. Get a yes. No surprise third act. He tracks better when the plan is short and kept.'),
  t(50, 'Sensory', 'Pulse-Matched Pressure', 'Match palmar waves on the abdomen to a breath or radial pulse you can actually feel. If you cannot, use his exhale. Rhythm is the input, not grip strength.'),
  t(51, 'Advanced Oral', 'Indirect Approach Arc', 'Approach the glans from an off-midline angle, arc around the corona, rest. Straight-on vacuum on the glans too early is a common overstimulation pattern.'),
  t(52, 'Core Tension', 'Pelvic Floor Drop Cue', 'Ask him to lift the pelvic floor 20%, then drop it fully. Your distal hand stays still. Motion only after the drop. A clamped floor plus fast stroke ends the set.'),
  t(53, 'Edging', 'Micro-Pause Stack', 'One-second freeze every five seconds of stroking. After two minutes, two-second freezes. Skip if it irritates. The stack is to break a sprint reflex.'),
  t(54, 'Transitions', 'Lotus Seat Shift', 'Face-to-face seated fold only if both hips allow. Pads under knees. Hip pinch means side-sit instead. Do not force lotus for the aesthetic.'),
  t(55, 'Psychological', 'Status-Drop Line', 'A short non-appearance line (“your breath just slowed—that helps”). Then silence. No request attached. Dropping the performance script is the trigger.'),
  t(56, 'Sensory', 'Hairline-to-Spine Line', 'Occiput down to L5 in one slow line. Second hand on the hip. Avoid stabbing spinous processes. Downshift before another distal climb.'),
  t(57, 'Advanced Oral', 'Twist-Free Path', 'Oral or manual path stays along the shaft axis. No corkscrew torque on the glans. A stabilizing hand at the base prevents accidental twist if he moves.'),
  t(58, 'Core Tension', 'Hip-Flexor Lengthen', 'Gentle hip extension in a kneeling lunge setup if there is no pinch. Twenty seconds, distal contact paused. Tight flexors make him thrust from the lumbar.'),
  t(59, 'Edging', 'Denied Peak, Held Gaze', 'At the chase, freeze and hold calm eye contact. No dare face. Resume at half after two full exhales. Mocking a close call spikes him or shuts him down.'),
  t(60, 'Transitions', 'Wall-to-Floor Descent', 'From wall standing, controlled sit to bed or floor. You guide his scapulae. Knees do not drop. Recheck wrists if he was braced on the wall.'),
  t(61, 'Psychological', 'Mirror Permission', 'Ask before any mirror. He can look or not. You comment on alignment only. If he says no, the mirror is covered. Watching is not required for the tactic to work.'),
  t(62, 'Sensory', 'Breath-on-Skin Track', 'Warm exhale sternum to navel, then palmar cover. Keep air off a wet glans (cooling). Two tracks, then hands.'),
  t(63, 'Advanced Oral', 'Circumferential Slowing', 'If his hips speed, you slow and widen the oral/manual path. Matching his sprint usually ends it. You decelerate the system on purpose.'),
  t(64, 'Core Tension', 'Ischial Support', 'If he is sitting, take a little load at the ischial tuberosities so he is not perched. Then slow distal motion. Unstable sitting equals clamping and early finish.'),
  t(65, 'Edging', 'Five-Second Recoil', 'On “close,” distal contact off for five seconds, abdomen hand stays. Return at 50%. If five seconds is impossible, the edge was already missed.'),
  t(66, 'Transitions', 'Straddle Dismount', 'You dismount to the side; he does not lift you off. Feet or knees find the mattress. Then a still hold before the next map.'),
  t(67, 'Psychological', 'Gratitude Naming', 'Thank one specific mechanical choice he made (“you asked before speeding”). Pause. Gratitude without a demand lowers threat more than praise of appearance.'),
  t(68, 'Sensory', 'Weighted Blanket Press', 'Broad forearm load on his upper back or pelvis if agreed. Ten seconds. He must be able to shift you off. This is pressure, not restraint.'),
  t(69, 'Sensory', 'Lateral-to-Medial Sweep', 'Strokes from the lateral hip to the inguinal crease, stopping short of the penis for ten passes. Distal map comes after the trunk is online.'),
  t(70, 'Core Tension', 'Core Brace Cue', 'Light abdominal brace, then full release. Distal contact waits for the release. Braced core plus fast stroke fights the pelvic floor.'),
  t(71, 'Edging', 'Plateau Walk', 'Medium intensity he can talk through for a full minute. If speech fails, drop. A walkable plateau lasts longer than spike-and-crash.'),
  t(72, 'Transitions', 'Side-Entry Pivot', 'From supine to side-lying, you adjust the upper femur. If any agreed penetration is in play, pubic bones do not crash. Pillow between knees if adductors cramp.'),
  t(73, 'Psychological', 'Aftercare Preview', 'Before a last high plateau, say the landing (water, covering, still hold). Then do it. Knowing the landing reduces panic that makes him finish to “get it over with.”'),
  t(74, 'Sensory', 'Joint-Warmth Transfer', 'Warm your hands on his, then move to the lower abdomen, then distal. Cold hands on the glans is a fail. Recheck lubricant temperature too.'),
  t(75, 'Advanced Oral', 'Glans Isolation Visit', 'After a wide shaft map, a brief still seal on the glans, then back to wide. A visit, not a home. Flinch or too-sharp inhale means you widen immediately.'),
  t(76, 'Core Tension', 'Posterior Tilt Cue', 'Hand under the sacrum, small posterior tilt, hold. If you are in an agreed penetrative angle, this often reduces pubic-bone jamming. Geometry before amplitude.'),
  t(77, 'Edging', 'Nested Edges', 'Two short edges inside a two-minute window, then a full minute of chest-to-chest still. Nested climbs, not one long acceleration.'),
  t(78, 'Transitions', 'Seated Lift-Off', 'From astride, you lean back on locked arms to change hip angle without standing. Stop if wrists hurt. He keeps his feet or shins planted.'),
  t(79, 'Psychological', 'Safety Word Rehearsal', 'Say stop and yellow-pace words together once. Resume after both can repeat them. If he laughs it off, you still require the words before distal work continues.'),
  t(80, 'Transitions', 'Full-Body Still Reset', 'All distal contact off. Full hold, matched breath, 60–90 seconds. Wrap from 80 toward 1. Skipping the reset to stay “in it” is how the next loop starts already too high.'),
];

export function termActList(side: TermActSide): TermActTactic[] {
  return side === 'her-to-him' ? her_to_him_db : him_to_her_db;
}

export function termActById(side: TermActSide, id: number): TermActTactic {
  const list = termActList(side);
  return list.find((x) => x.id === id) || list[0];
}

export function parseTermActSide(raw: unknown): TermActSide {
  const s = String(raw || '').toLowerCase();
  if (s === 'her-to-him' || s === 'girl-to-boy' || s === 'female' || s === 'woman' || s === 'f') return 'her-to-him';
  return 'him-to-her';
}

export function defaultSideForGender(gender?: string | null): TermActSide {
  const g = String(gender || '').toLowerCase();
  if (/\b(woman|female|girl|f|she)\b/.test(g) || g === 'female' || g === 'woman') return 'her-to-him';
  return 'him-to-her';
}
