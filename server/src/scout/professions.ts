import type { Profession } from './types.js';

export const PROFESSIONS: Profession[] = [
  { id: 'lawyer', label: 'Lawyer', group: 'Law' },
  { id: 'judge', label: 'Judge', group: 'Law' },
  { id: 'footballer', label: 'Footballer', group: 'Sport' },
  { id: 'football-agent', label: 'Football agent', group: 'Sport' },
  { id: 'producer', label: 'Producer', group: 'Culture' },
  { id: 'artist', label: 'Artist', group: 'Culture' },
  { id: 'model', label: 'Model', group: 'Culture' },
  { id: 'doctor', label: 'Doctor', group: 'Medicine' },
  { id: 'surgeon', label: 'Surgeon', group: 'Medicine' },
  { id: 'architect', label: 'Architect', group: 'Build' },
  { id: 'founder', label: 'Founder', group: 'Business' },
  { id: 'musician', label: 'Musician', group: 'Culture' },
  { id: 'engineer', label: 'Engineer', group: 'Build' },
  { id: 'journalist', label: 'Journalist', group: 'Culture' },
  { id: 'chef', label: 'Chef', group: 'Culture' },
];

export function searchProfessions(query: string): Profession[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return PROFESSIONS;
  return PROFESSIONS.filter((item) =>
    item.label.toLowerCase().includes(needle) || item.group.toLowerCase().includes(needle) || item.id.includes(needle)
  );
}

export function professionById(id: string): Profession | null {
  return PROFESSIONS.find((item) => item.id === id) || null;
}
