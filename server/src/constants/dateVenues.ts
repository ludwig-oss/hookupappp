/** Talk-friendly public date spots — no restaurants (sit-down meals), cinemas, or movie theaters. */

export interface DateVenueOption {
  id: string;
  name: string;
  type: 'park' | 'coffee' | 'plaza' | 'boardwalk' | 'market' | 'garden' | 'waterfront';
  description: string;
  estimatedCost: string;
  splitBillNote: string;
}

export const DATE_VENUE_POOL: DateVenueOption[] = [
  { id: 'v1', name: 'Riverside walking path', type: 'waterfront', description: 'Busy waterfront promenade — easy to talk while walking.', estimatedCost: 'Free', splitBillNote: 'Each pays for your own drinks if you grab something.' },
  { id: 'v2', name: 'Central city park — main lawn', type: 'park', description: 'Open park with foot traffic and benches.', estimatedCost: 'Free', splitBillNote: 'Bring your own snacks; split nothing.' },
  { id: 'v3', name: 'Independent coffee kiosk (to-go only)', type: 'coffee', description: 'Counter-service coffee — sit on nearby public benches.', estimatedCost: '$4–8 each', splitBillNote: 'Each orders and pays for your own drink.' },
  { id: 'v4', name: 'Saturday farmers market', type: 'market', description: 'Outdoor stalls — walk, talk, people around.', estimatedCost: '$5–15 each', splitBillNote: 'Pay separately for anything you buy.' },
  { id: 'v5', name: 'Town square / plaza', type: 'plaza', description: 'Central plaza with benches and steady foot traffic.', estimatedCost: 'Free', splitBillNote: 'No shared bill.' },
  { id: 'v6', name: 'Botanical garden (outdoor paths)', type: 'garden', description: 'Garden paths — calm and public.', estimatedCost: '$5–12 each', splitBillNote: 'Each buys your own ticket if required.' },
  { id: 'v7', name: 'Lakefront boardwalk', type: 'boardwalk', description: 'Busy boardwalk — walk and talk with others nearby.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v8', name: 'Skate park perimeter benches', type: 'park', description: 'Public seating overlooking active park — well lit.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v9', name: 'University campus green', type: 'park', description: 'Open campus lawn — public and busy on weekdays.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v10', name: 'Outdoor art walk district', type: 'plaza', description: 'Murals and sculptures — stroll and conversation.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v11', name: 'Harbor overlook pier', type: 'waterfront', description: 'Short pier with fishermen and walkers — public.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v12', name: 'Community garden public path', type: 'garden', description: 'Shared garden paths — daytime foot traffic.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v13', name: 'Ice cream window (takeaway)', type: 'coffee', description: 'Order at window, sit on public benches nearby.', estimatedCost: '$5–10 each', splitBillNote: 'Each pays for your own treat.' },
  { id: 'v14', name: 'Public library front courtyard', type: 'plaza', description: 'Courtyard seating — quiet but public.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v15', name: 'Historic district walking loop', type: 'plaza', description: 'Pedestrian streets — cafes visible but meet outside.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v16', name: 'Dog park outer path', type: 'park', description: 'Path around dog park — busy and open.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v17', name: 'Rooftop public observation deck', type: 'plaza', description: 'City view deck — stay in public area.', estimatedCost: '$0–10 each', splitBillNote: 'Each pays your own entry if any.' },
  { id: 'v18', name: 'Boulevard median park strip', type: 'park', description: 'Narrow park between busy roads — people nearby.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v19', name: 'Tea to-go shop patio (public side)', type: 'coffee', description: 'Grab tea to-go; sit at public tables outside.', estimatedCost: '$5–9 each', splitBillNote: 'Each pays for your own drink.' },
  { id: 'v20', name: 'Outdoor flea market', type: 'market', description: 'Weekend market — walk aisles and talk.', estimatedCost: 'Free entry', splitBillNote: 'Each pays for anything you buy.' },
  { id: 'v21', name: 'Canal towpath trail', type: 'waterfront', description: 'Flat trail with runners and walkers.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v22', name: 'Playground-adjacent picnic tables', type: 'park', description: 'Tables near playground — families around.', estimatedCost: 'Free', splitBillNote: 'Each brings your own food.' },
  { id: 'v23', name: 'Transit hub outdoor plaza', type: 'plaza', description: 'Busy plaza outside station — well lit.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v24', name: 'Beach boardwalk (daytime)', type: 'boardwalk', description: 'Sandy walk with crowds — stay in open areas.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v25', name: 'Nature reserve trailhead loop', type: 'park', description: 'Short loop trail — meet at trailhead kiosk.', estimatedCost: 'Free–$5 each', splitBillNote: 'Each pays parking if needed.' },
  { id: 'v26', name: 'Outdoor basketball courts seating', type: 'park', description: 'Bleachers at public courts — evening activity.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v27', name: 'Civic center fountain plaza', type: 'plaza', description: 'Fountain plaza — tourists and locals.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v28', name: 'Smoothie bar (pickup only)', type: 'coffee', description: 'Quick smoothie — talk on public seating outside.', estimatedCost: '$7–12 each', splitBillNote: 'Each pays your own order.' },
  { id: 'v29', name: 'Memorial park reflection paths', type: 'park', description: 'Wide paths with regular visitors.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v30', name: 'Bridge pedestrian walkway', type: 'waterfront', description: 'Scenic bridge walk — constant foot traffic.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v31', name: 'Outdoor book market stalls', type: 'market', description: 'Used books outdoors — browse and chat.', estimatedCost: '$0–10 each', splitBillNote: 'Each pays for your own books.' },
  { id: 'v32', name: 'City hall steps & lawn', type: 'plaza', description: 'Government lawn — public events and security.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v33', name: 'Greenway bike path benches', type: 'park', description: 'Benches along busy bike path.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v34', name: 'Outdoor climbing gym viewing area', type: 'plaza', description: 'Public viewing deck at climbing gym — no need to climb.', estimatedCost: 'Free to watch', splitBillNote: 'Each pays if you climb separately.' },
  { id: 'v35', name: 'Waterfront park splash pad benches', type: 'waterfront', description: 'Family area — stay on outer benches.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v36', name: 'Public orchard pick-your-own (day)', type: 'garden', description: 'Orchard rows — daytime, staff nearby.', estimatedCost: '$8–15 each', splitBillNote: 'Each pays for your own basket.' },
  { id: 'v37', name: 'Outdoor chess tables in the park', type: 'park', description: 'Permanent chess tables — casual games optional.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v38', name: 'Street fair / block party (when scheduled)', type: 'market', description: 'Blocked street with vendors — very public.', estimatedCost: 'Varies', splitBillNote: 'Each pays for your own food.' },
  { id: 'v39', name: 'River ferry terminal waiting area', type: 'waterfront', description: 'Outdoor queue area — busy at rush hour.', estimatedCost: 'Ferry fare each', splitBillNote: 'Each buys your own ticket.' },
  { id: 'v40', name: 'Hilltop scenic overlook parking', type: 'park', description: 'Viewpoint with other visitors — stay near parking lot.', estimatedCost: 'Free–$3 parking each', splitBillNote: 'Each pays your own parking.' },
  { id: 'v41', name: 'Outdoor mini-golf (no bar sit-down)', type: 'park', description: 'Quick round — talk between holes, public course.', estimatedCost: '$10–14 each', splitBillNote: 'Each pays your own game.' },
  { id: 'v42', name: 'Public pool deck perimeter (not in water)', type: 'plaza', description: 'Sit on deck chairs area — lifeguards present.', estimatedCost: '$5–8 each', splitBillNote: 'Each pays your own entry.' },
  { id: 'v43', name: 'Metro park & ride lawn', type: 'park', description: 'Grass near busy transit — odd but public.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v44', name: 'Outdoor food truck row (standing)', type: 'market', description: 'Trucks lined up — eat standing at picnic tables.', estimatedCost: '$10–16 each', splitBillNote: 'Each pays for your own meal.' },
  { id: 'v45', name: 'Conservatory exterior gardens only', type: 'garden', description: 'Outside gardens without restaurant seating.', estimatedCost: '$6–10 each', splitBillNote: 'Each pays your own ticket.' },
  { id: 'v46', name: 'Zoo outdoor paths (no indoor exhibits required)', type: 'park', description: 'Meet at main gate plaza before entering.', estimatedCost: '$15–25 each', splitBillNote: 'Each pays your own ticket.' },
  { id: 'v47', name: 'Outdoor roller rink plaza benches', type: 'plaza', description: 'Benches by rink — music and crowds.', estimatedCost: 'Free to sit', splitBillNote: 'Each pays if you skate.' },
  { id: 'v48', name: 'Lighthouse park grounds', type: 'waterfront', description: 'Grassy lighthouse park — tourists around.', estimatedCost: 'Free–$5 each', splitBillNote: 'Each pays your own.' },
  { id: 'v49', name: 'Outdoor yoga class lawn (observe/sit nearby)', type: 'park', description: 'Public class on lawn — meet at edge.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v50', name: 'Community mural alley (daylight)', type: 'plaza', description: 'Short alley of murals — stay at open end.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v51', name: 'Public band shell lawn concerts', type: 'park', description: 'Free outdoor concert on lawn — arrive early.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v52', name: 'Outdoor bouldering park', type: 'park', description: 'Low boulders with spotters — daytime crowds.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v53', name: 'Historic pier public end', type: 'boardwalk', description: 'Public pier section — no private dining.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v54', name: 'City rooftop park (elevated public park)', type: 'park', description: 'Elevated public park on building — fully open.', estimatedCost: 'Free', splitBillNote: 'Each pays your own.' },
  { id: 'v55', name: 'Outdoor Christmas market (seasonal)', type: 'market', description: 'Seasonal stalls — very busy and public.', estimatedCost: 'Varies', splitBillNote: 'Each pays for your own purchases.' },
];

export function pickRandomVenues(count = 50): DateVenueOption[] {
  const shuffled = [...DATE_VENUE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((v, i) => ({
    ...v,
    id: `${v.id}-${Date.now()}-${i}`,
  }));
}
