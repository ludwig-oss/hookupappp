/**
 * Primary language for a country, used so interest notices follow where the user is.
 * Codes are ISO 639-1. Country codes are ISO 3166-1 alpha-2.
 */

const BY_CODE: Record<string, string> = {
  AF: 'fa', AL: 'sq', DZ: 'ar', AD: 'ca', AO: 'pt', AG: 'en', AR: 'es', AM: 'hy', AU: 'en', AT: 'de',
  AZ: 'az', BS: 'en', BH: 'ar', BD: 'bn', BB: 'en', BY: 'be', BE: 'nl', BZ: 'en', BJ: 'fr', BT: 'dz',
  BO: 'es', BA: 'bs', BW: 'en', BR: 'pt', BN: 'ms', BG: 'bg', BF: 'fr', BI: 'rn', CV: 'pt', KH: 'km',
  CM: 'fr', CA: 'en', CF: 'fr', TD: 'fr', CL: 'es', CN: 'zh', CO: 'es', KM: 'ar', CG: 'fr', CD: 'fr',
  CR: 'es', CI: 'fr', HR: 'hr', CU: 'es', CY: 'el', CZ: 'cs', DK: 'da', DJ: 'fr', DM: 'en', DO: 'es',
  EC: 'es', EG: 'ar', SV: 'es', GQ: 'es', ER: 'ti', EE: 'et', SZ: 'en', ET: 'am', FJ: 'fj', FI: 'fi',
  FR: 'fr', GA: 'fr', GM: 'en', GE: 'ka', DE: 'de', GH: 'en', GR: 'el', GD: 'en', GT: 'es', GN: 'fr',
  GW: 'pt', GY: 'en', HT: 'ht', HN: 'es', HU: 'hu', IS: 'is', IN: 'hi', ID: 'id', IR: 'fa', IQ: 'ar',
  IE: 'en', IL: 'he', IT: 'it', JM: 'en', JP: 'ja', JO: 'ar', KZ: 'kk', KE: 'sw', KI: 'en', KP: 'ko',
  KR: 'ko', KW: 'ar', KG: 'ky', LA: 'lo', LV: 'lv', LB: 'ar', LS: 'en', LR: 'en', LY: 'ar', LI: 'de',
  LT: 'lt', LU: 'lb', MG: 'mg', MW: 'ny', MY: 'ms', MV: 'dv', ML: 'fr', MT: 'mt', MH: 'en', MR: 'ar',
  MU: 'en', MX: 'es', FM: 'en', MD: 'ro', MC: 'fr', MN: 'mn', ME: 'sr', MA: 'ar', MZ: 'pt', MM: 'my',
  NA: 'en', NR: 'en', NP: 'ne', NL: 'nl', NZ: 'en', NI: 'es', NE: 'fr', NG: 'en', MK: 'mk', NO: 'no',
  OM: 'ar', PK: 'ur', PW: 'en', PS: 'ar', PA: 'es', PG: 'en', PY: 'es', PE: 'es', PH: 'tl', PL: 'pl',
  PT: 'pt', QA: 'ar', RO: 'ro', RU: 'ru', RW: 'rw', KN: 'en', LC: 'en', VC: 'en', WS: 'sm', SM: 'it',
  ST: 'pt', SA: 'ar', SN: 'fr', RS: 'sr', SC: 'en', SL: 'en', SG: 'en', SK: 'sk', SI: 'sl', SB: 'en',
  SO: 'so', ZA: 'en', SS: 'en', ES: 'es', LK: 'si', SD: 'ar', SR: 'nl', SE: 'sv', CH: 'de', SY: 'ar',
  TW: 'zh', TJ: 'tg', TZ: 'sw', TH: 'th', TL: 'pt', TG: 'fr', TO: 'to', TT: 'en', TN: 'ar', TR: 'tr',
  TM: 'tk', TV: 'en', UG: 'en', UA: 'uk', AE: 'ar', GB: 'en', US: 'en', UY: 'es', UZ: 'uz', VU: 'bi',
  VA: 'it', VE: 'es', VN: 'vi', YE: 'ar', ZM: 'en', ZW: 'en', HK: 'zh', MO: 'zh', PR: 'es', GL: 'kl',
  FO: 'fo', XK: 'sq',
};

/** English and common local names. Folded before lookup. */
const ALIASES: Record<string, string[]> = {
  US: ['united states', 'united states of america', 'usa', 'u s a', 'estados unidos', 'états-unis'],
  GB: ['united kingdom', 'uk', 'u k', 'great britain', 'britain', 'england', 'scotland', 'wales'],
  ES: ['spain', 'españa', 'espana'],
  DE: ['germany', 'deutschland', 'alemania', 'allemagne'],
  FR: ['france', 'francia'],
  IT: ['italy', 'italia'],
  PT: ['portugal'],
  BR: ['brazil', 'brasil'],
  MX: ['mexico', 'méxico'],
  AR: ['argentina'],
  CO: ['colombia'],
  CL: ['chile'],
  PE: ['peru', 'perú'],
  VE: ['venezuela'],
  NL: ['netherlands', 'the netherlands', 'holland', 'nederland', 'paises bajos', 'países bajos'],
  BE: ['belgium', 'belgique', 'belgië', 'belgie'],
  CH: ['switzerland', 'schweiz', 'suisse', 'svizzera'],
  AT: ['austria', 'österreich', 'osterreich'],
  PL: ['poland', 'polska'],
  RU: ['russia', 'russian federation', 'россия'],
  UA: ['ukraine', 'україна'],
  TR: ['turkey', 'türkiye', 'turkiye'],
  GR: ['greece', 'ellada', 'ελλάδα'],
  SE: ['sweden', 'sverige'],
  NO: ['norway', 'norge'],
  DK: ['denmark', 'danmark'],
  FI: ['finland', 'suomi'],
  CZ: ['czechia', 'czech republic', 'česko', 'cesko'],
  RO: ['romania', 'românia'],
  HU: ['hungary', 'magyarország', 'magyarorszag'],
  CN: ['china', '中国', 'zhongguo'],
  TW: ['taiwan', '台灣', '台湾'],
  HK: ['hong kong', '香港'],
  JP: ['japan', '日本', 'nippon', 'nihon'],
  KR: ['south korea', 'korea', 'republic of korea', '한국', '대한민국'],
  KP: ['north korea', 'dprk'],
  IN: ['india', 'भारत'],
  PK: ['pakistan'],
  BD: ['bangladesh'],
  ID: ['indonesia'],
  MY: ['malaysia'],
  PH: ['philippines', 'pilipinas'],
  VN: ['vietnam', 'viet nam'],
  TH: ['thailand', 'ประเทศไทย'],
  SA: ['saudi arabia', 'kingdom of saudi arabia'],
  AE: ['united arab emirates', 'uae', 'u a e'],
  EG: ['egypt', 'مصر'],
  MA: ['morocco', 'maroc', 'المغرب'],
  NG: ['nigeria'],
  ZA: ['south africa'],
  KE: ['kenya'],
  IL: ['israel', 'ישראל'],
  IR: ['iran', 'persia'],
  IQ: ['iraq'],
  CA: ['canada'],
  AU: ['australia'],
  NZ: ['new zealand'],
  IE: ['ireland', 'éire', 'eire'],
  CI: ['cote d ivoire', 'côte d ivoire', 'ivory coast'],
  CD: ['democratic republic of the congo', 'dr congo', 'drc'],
  CG: ['republic of the congo', 'congo'],
  MK: ['north macedonia', 'macedonia'],
  SZ: ['eswatini', 'swaziland'],
  CV: ['cabo verde', 'cape verde'],
  TL: ['timor-leste', 'east timor'],
  MM: ['myanmar', 'burma'],
  LA: ['laos', 'lao'],
  SY: ['syria', 'syrian arab republic'],
  PS: ['palestine', 'state of palestine'],
  BO: ['bolivia'],
  TZ: ['tanzania'],
  MD: ['moldova'],
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAME_TO_CODE = new Map<string, string>();
for (const [code, names] of Object.entries(ALIASES)) {
  const iso = code.replace(/\d+$/, '');
  if (!BY_CODE[iso]) continue;
  for (const name of names) {
    const key = fold(name);
    if (key) NAME_TO_CODE.set(key, iso);
  }
}

/** Every country code above also matches its English name when geocoders return one. */
const ENGLISH_NAMES: Record<string, string> = {
  AF: 'afghanistan', AL: 'albania', DZ: 'algeria', AD: 'andorra', AO: 'angola', AG: 'antigua and barbuda',
  AR: 'argentina', AM: 'armenia', AU: 'australia', AT: 'austria', AZ: 'azerbaijan', BS: 'bahamas', BH: 'bahrain',
  BD: 'bangladesh', BB: 'barbados', BY: 'belarus', BE: 'belgium', BZ: 'belize', BJ: 'benin', BT: 'bhutan',
  BO: 'bolivia', BA: 'bosnia and herzegovina', BW: 'botswana', BR: 'brazil', BN: 'brunei', BG: 'bulgaria',
  BF: 'burkina faso', BI: 'burundi', CV: 'cabo verde', KH: 'cambodia', CM: 'cameroon', CA: 'canada',
  CF: 'central african republic', TD: 'chad', CL: 'chile', CN: 'china', CO: 'colombia', KM: 'comoros',
  CG: 'congo', CD: 'democratic republic of the congo', CR: 'costa rica', CI: 'cote d ivoire', HR: 'croatia',
  CU: 'cuba', CY: 'cyprus', CZ: 'czechia', DK: 'denmark', DJ: 'djibouti', DM: 'dominica', DO: 'dominican republic',
  EC: 'ecuador', EG: 'egypt', SV: 'el salvador', GQ: 'equatorial guinea', ER: 'eritrea', EE: 'estonia',
  SZ: 'eswatini', ET: 'ethiopia', FJ: 'fiji', FI: 'finland', FR: 'france', GA: 'gabon', GM: 'gambia',
  GE: 'georgia', DE: 'germany', GH: 'ghana', GR: 'greece', GD: 'grenada', GT: 'guatemala', GN: 'guinea',
  GW: 'guinea-bissau', GY: 'guyana', HT: 'haiti', HN: 'honduras', HU: 'hungary', IS: 'iceland', IN: 'india',
  ID: 'indonesia', IR: 'iran', IQ: 'iraq', IE: 'ireland', IL: 'israel', IT: 'italy', JM: 'jamaica', JP: 'japan',
  JO: 'jordan', KZ: 'kazakhstan', KE: 'kenya', KI: 'kiribati', KP: 'north korea', KR: 'south korea', KW: 'kuwait',
  KG: 'kyrgyzstan', LA: 'laos', LV: 'latvia', LB: 'lebanon', LS: 'lesotho', LR: 'liberia', LY: 'libya',
  LI: 'liechtenstein', LT: 'lithuania', LU: 'luxembourg', MG: 'madagascar', MW: 'malawi', MY: 'malaysia',
  MV: 'maldives', ML: 'mali', MT: 'malta', MH: 'marshall islands', MR: 'mauritania', MU: 'mauritius',
  MX: 'mexico', FM: 'micronesia', MD: 'moldova', MC: 'monaco', MN: 'mongolia', ME: 'montenegro', MA: 'morocco',
  MZ: 'mozambique', MM: 'myanmar', NA: 'namibia', NR: 'nauru', NP: 'nepal', NL: 'netherlands', NZ: 'new zealand',
  NI: 'nicaragua', NE: 'niger', NG: 'nigeria', MK: 'north macedonia', NO: 'norway', OM: 'oman', PK: 'pakistan',
  PW: 'palau', PS: 'palestine', PA: 'panama', PG: 'papua new guinea', PY: 'paraguay', PE: 'peru', PH: 'philippines',
  PL: 'poland', PT: 'portugal', QA: 'qatar', RO: 'romania', RU: 'russia', RW: 'rwanda', KN: 'saint kitts and nevis',
  LC: 'saint lucia', VC: 'saint vincent and the grenadines', WS: 'samoa', SM: 'san marino', ST: 'sao tome and principe',
  SA: 'saudi arabia', SN: 'senegal', RS: 'serbia', SC: 'seychelles', SL: 'sierra leone', SG: 'singapore',
  SK: 'slovakia', SI: 'slovenia', SB: 'solomon islands', SO: 'somalia', ZA: 'south africa', SS: 'south sudan',
  ES: 'spain', LK: 'sri lanka', SD: 'sudan', SR: 'suriname', SE: 'sweden', CH: 'switzerland', SY: 'syria',
  TW: 'taiwan', TJ: 'tajikistan', TZ: 'tanzania', TH: 'thailand', TL: 'timor-leste', TG: 'togo', TO: 'tonga',
  TT: 'trinidad and tobago', TN: 'tunisia', TR: 'turkey', TM: 'turkmenistan', TV: 'tuvalu', UG: 'uganda',
  UA: 'ukraine', AE: 'united arab emirates', GB: 'united kingdom', US: 'united states', UY: 'uruguay',
  UZ: 'uzbekistan', VU: 'vanuatu', VA: 'vatican city', VE: 'venezuela', VN: 'vietnam', YE: 'yemen', ZM: 'zambia',
  ZW: 'zimbabwe', HK: 'hong kong', MO: 'macau', PR: 'puerto rico', GL: 'greenland', FO: 'faroe islands', XK: 'kosovo',
};

for (const [code, name] of Object.entries(ENGLISH_NAMES)) {
  const key = fold(name);
  if (key && !NAME_TO_CODE.has(key)) NAME_TO_CODE.set(key, code);
}

export function languageForCountry(country?: string | null, countryCode?: string | null): string | null {
  const iso = (countryCode || '').trim().toUpperCase();
  if (iso && BY_CODE[iso]) return BY_CODE[iso];
  const raw = (country || '').trim();
  if (!raw) return null;
  if (/^[a-z]{2}$/i.test(raw)) {
    const fromCode = BY_CODE[raw.toUpperCase()];
    if (fromCode) return fromCode;
  }
  const fromName = NAME_TO_CODE.get(fold(raw));
  if (fromName && BY_CODE[fromName]) return BY_CODE[fromName];
  return null;
}

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'dv', 'yi']);

export function isRtlLanguage(code: string | null | undefined): boolean {
  const short = (code || '').toLowerCase().split('-')[0];
  return RTL.has(short);
}
