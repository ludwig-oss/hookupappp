export interface DateLookingForOption {
  id: string;
  label: string;
  hint: string;
}

/** Same ids as Date Arena — saved at signup, reused when they search. */
export const DATE_LOOKING_FOR: DateLookingForOption[] = [
  { id: 'serious_relationship', label: 'Serious relationship', hint: 'Ready to build something real' },
  { id: 'casual_dating', label: 'Casual dating', hint: 'Keep it light and see who you click with' },
  { id: 'friends_first', label: 'Friends first', hint: 'Connection before labels' },
  { id: 'marriage_minded', label: 'Marriage-minded', hint: 'Looking toward a lifelong partner' },
  { id: 'long_term_slow', label: 'Long-term, take it slow', hint: 'Steady, no rush' },
  { id: 'exclusive_dating', label: 'Exclusive dating', hint: 'One person at a time' },
  { id: 'open_to_anything', label: 'Open to anything', hint: 'See where chemistry goes' },
  { id: 'activity_partner', label: 'Activity partner', hint: 'Someone to do hobbies with' },
  { id: 'travel_companion', label: 'Travel companion', hint: 'Explore a city or trip together' },
  { id: 'short_term_fun', label: 'Short-term fun', hint: 'A few great dates, no pressure' },
  { id: 'life_partner', label: 'Life partner', hint: 'Someone to build a life with' },
  { id: 'see_where_it_goes', label: 'See where it goes', hint: 'Curious, honest, no script' },
];
