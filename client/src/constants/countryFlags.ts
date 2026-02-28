/** Country names (lowercase) to ISO 3166-1 alpha-2 for flagcdn.com */
export const COUNTRY_TO_ISO: Record<string, string> = {
  usa: 'us', 'united states': 'us', us: 'us', america: 'us', 'united states of america': 'us',
  uk: 'gb', 'united kingdom': 'gb', britain: 'gb', england: 'gb', gb: 'gb', 'great britain': 'gb',
  canada: 'ca', ca: 'ca', australia: 'au', au: 'au', germany: 'de', deutschland: 'de', de: 'de',
  france: 'fr', fr: 'fr', spain: 'es', es: 'es', italy: 'it', it: 'it',
  japan: 'jp', jp: 'jp', china: 'cn', cn: 'cn', india: 'in', in: 'in',
  brazil: 'br', br: 'br', mexico: 'mx', mx: 'mx', netherlands: 'nl', holland: 'nl', nl: 'nl',
  belgium: 'be', be: 'be', switzerland: 'ch', ch: 'ch', austria: 'at', at: 'at',
  portugal: 'pt', pt: 'pt', greece: 'gr', gr: 'gr', poland: 'pl', pl: 'pl',
  sweden: 'se', se: 'se', norway: 'no', no: 'no', denmark: 'dk', dk: 'dk',
  finland: 'fi', fi: 'fi', ireland: 'ie', ie: 'ie', russia: 'ru', ru: 'ru',
  ukraine: 'ua', ua: 'ua', turkey: 'tr', tr: 'tr', turkiye: 'tr',
  'south korea': 'kr', korea: 'kr', kr: 'kr', 'republic of korea': 'kr',
  philippines: 'ph', ph: 'ph', indonesia: 'id', id: 'id', thailand: 'th', th: 'th',
  vietnam: 'vn', vn: 'vn', 'viet nam': 'vn',
  argentina: 'ar', ar: 'ar', chile: 'cl', cl: 'cl', colombia: 'co', co: 'co',
  peru: 'pe', pe: 'pe', 'south africa': 'za', za: 'za',
  egypt: 'eg', eg: 'eg', nigeria: 'ng', ng: 'ng', kenya: 'ke', ke: 'ke',
  'new zealand': 'nz', nz: 'nz', singapore: 'sg', sg: 'sg',
  malaysia: 'my', my: 'my', 'hong kong': 'hk', hk: 'hk', taiwan: 'tw', tw: 'tw',
  pakistan: 'pk', pk: 'pk', bangladesh: 'bd', bd: 'bd', 'sri lanka': 'lk', lk: 'lk',
  israel: 'il', il: 'il', 'saudi arabia': 'sa', sa: 'sa', uae: 'ae', 'united arab emirates': 'ae', ae: 'ae',
  romania: 'ro', ro: 'ro', hungary: 'hu', hu: 'hu', 'czech republic': 'cz', czechia: 'cz', cz: 'cz',
  slovakia: 'sk', sk: 'sk', croatia: 'hr', hr: 'hr', serbia: 'rs', rs: 'rs',
  bulgaria: 'bg', bg: 'bg', slovenia: 'si', si: 'si', 'bosnia and herzegovina': 'ba', bosnia: 'ba', ba: 'ba',
  albania: 'al', al: 'al', 'north macedonia': 'mk', macedonia: 'mk', mk: 'mk',
  estonia: 'ee', ee: 'ee', latvia: 'lv', lv: 'lv', lithuania: 'lt', lt: 'lt',
  belarus: 'by', by: 'by', moldova: 'md', md: 'md', georgia: 'ge', ge: 'ge',
  armenia: 'am', am: 'am', azerbaijan: 'az', az: 'az', kazakhstan: 'kz', kz: 'kz',
  morocco: 'ma', ma: 'ma', algeria: 'dz', dz: 'dz', tunisia: 'tn', tn: 'tn',
  ghana: 'gh', gh: 'gh', ethiopia: 'et', et: 'et', tanzania: 'tz', tz: 'tz',
  venezuela: 've', ve: 've', ecuador: 'ec', ec: 'ec', bolivia: 'bo', bo: 'bo',
  'costa rica': 'cr', cr: 'cr', panama: 'pa', pa: 'pa', guatemala: 'gt', gt: 'gt',
  'dominican republic': 'do', do: 'do', cuba: 'cu', cu: 'cu', jamaica: 'jm', jm: 'jm',
  iceland: 'is', is: 'is', luxembourg: 'lu', lu: 'lu', malta: 'mt', mt: 'mt',
  cyprus: 'cy', cy: 'cy', mongolia: 'mn', mn: 'mn', cambodia: 'kh', kh: 'kh',
  laos: 'la', la: 'la', myanmar: 'mm', mm: 'mm', brunei: 'bn', bn: 'bn',
};

export function getCountryFlagCode(countryName: string): string | null {
  if (!countryName?.trim()) return null;
  return COUNTRY_TO_ISO[countryName.trim().toLowerCase()] ?? null;
}
