export type WardrobeVibe = '90s-vintage' | 'modern-runway' | 'street-luxe';
export type WardrobeSlot = 'tops' | 'bottoms' | 'dresses' | 'shoes';
export type WardrobeAudience = 'men' | 'women';

const MEN_IDS = new Set([
  'rb-plaid-blazer',
  'by-bomber',
  'bru-shirt',
  'pc-sweater',
  'layo-blazer',
  'rb-stealie',
  'tc-denim',
  'ma-loafer',
  'toms-sneaker',
  'sm-keller',
]);

const WOMEN_WORD = /\b(women|woman|womens|female|ladies|skirt|dress|heel|stiletto|corset|ballet|frock|blouse)\b/i;
const MEN_WORD = /\b(mens|men's|for men|male)\b/i;

export function wardrobeAudience(gender: string | null | undefined): WardrobeAudience | null {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g.startsWith('fem')) return 'women';
  if (g === 'male' || g === 'man' || g === 'm' || g.startsWith('masc')) return 'men';
  return null;
}

export function pieceMatchesAudience(text: string, audience: WardrobeAudience | null): boolean {
  if (!audience) return true;
  if (audience === 'men') return !WOMEN_WORD.test(text);
  return !MEN_WORD.test(text);
}

export interface StoreMatch {
  store: string;
  price: string;
  buyUrl: string;
}

export interface WardrobePiece {
  id: string;
  slot: WardrobeSlot;
  title: string;
  brand: string;
  price: string;
  store: string;
  buyUrl: string;
  imageUrl: string;
  vibe: WardrobeVibe;
  similar: StoreMatch[];
}

function shops(query: string, price: string): StoreMatch[] {
  const q = encodeURIComponent(query);
  return [
    { store: 'Nordstrom', price, buyUrl: `https://www.nordstrom.com/sr?keyword=${q}` },
    { store: 'SSENSE', price, buyUrl: `https://www.ssense.com/en-us/search?q=${q}` },
  ];
}

function piece(
  id: string,
  slot: WardrobeSlot,
  title: string,
  brand: string,
  price: string,
  store: string,
  buyUrl: string,
  imageUrl: string,
  vibe: WardrobeVibe
): WardrobePiece {
  return { id, slot, title, brand, price, store, buyUrl, imageUrl, vibe, similar: shops(`${brand} ${title}`, price) };
}

export const wardrobeCatalog: Record<WardrobeSlot, WardrobePiece[]> = {
  tops: [
    piece('rb-plaid-blazer', 'tops', 'Yellow plaid cropped blazer', 'Rowing Blazers', '$495', 'rowingblazers.com', 'https://rowingblazers.com/products/mens-plain-weave-blazer-yellow-plaid', 'https://rowingblazers.com/cdn/shop/files/RB-6JUN25_BLAZER_CHECK_YELLOW-FRONT.jpg?v=1750341054', '90s-vintage'),
    piece('by-bomber', 'tops', 'Oversized leather bomber', 'Backyard Archive', '$280', 'backyardarchive.us', 'https://backyardarchive.us/products/oversized-coated-leather-bomber-jacket', 'https://backyardarchive.us/cdn/shop/products/front_3106dfcd-1597-499f-a97a-0c40ae5113fb.jpg?v=1618162161', 'street-luxe'),
    piece('bru-shirt', 'tops', 'White structured shirt', 'Brumano', '$79', 'shopbrumano.com', 'https://shopbrumano.com/products/white-structured-button-down-shirt-1', 'https://shopbrumano.com/cdn/shop/files/WhiteStructuredButtonDownShirtBrumanoPakistan_77552095-eedc-4320-b9ec-5ac9a99754d0.jpg?format=webp&v=1756905939&width=720', 'modern-runway'),
    piece('hobbs-coat', 'tops', 'Camel wool coat', 'Hobbs', '$450', 'hobbs.com', 'https://www.hobbs.com/product/cavendish-wool-coat/0224-3528-1049L00-HOBBS-CAMEL.html', 'https://www.hobbs.com/dw/image/v2/BDCH_PRD/on/demandware.static/-/Sites-hobbs-catalog/default/dw231c8c52/images/0224-3528-1049L00/0224-3528-1049L00-CAVENDISH-COAT-HOBBS-CAMEL_01.jpg?sw=800&sh=1100&strip=false', 'modern-runway'),
    piece('sh-corset', 'tops', 'Velvet corset', 'Sergio Hudson', '$395', 'sergiohudson.com', 'https://sergiohudson.com/products/velvet-corset', 'https://sergiohudson.com/cdn/shop/files/B0DFCF1MQF.MAIN.PC_420.jpg?v=1730950310&width=1200', '90s-vintage'),
    piece('ulla-denim', 'tops', 'Denim peplum jacket', 'Ulla Johnson', '$395', 'ullajohnson.com', 'https://ullajohnson.com/products/arquette-denim-jacket', 'https://ullajohnson.com/cdn/shop/files/ULLAJOHNSON_Arquette_Jacket_DANUBE_UJ9905040_a_web.jpg?v=1770042901&width=960', 'street-luxe'),
    piece('pc-sweater', 'tops', 'Black cashmere crewneck', 'Proper Cloth', '$248', 'propercloth.com', 'https://propercloth.com/products/black-cashmere-crewneck-1127.html', 'https://cdn2.propercloth.com/pic_sp/1127_051472f61569ac754d05b76c7aac63c7_sizemax.jpg', 'modern-runway'),
    piece('layo-blazer', 'tops', 'Navy double-breasted blazer', 'Layo G', '$220', 'layo-g.com', 'https://www.layo-g.com/products/mens-blazer-navy-blue', 'https://www.layo-g.com/cdn/shop/files/MensBlazerNavyFront.png?v=1692841945&width=1200', 'modern-runway'),
    piece('rb-stealie', 'tops', 'Stealie cashmere sweater', 'Rowing Blazers', '$298', 'rowingblazers.com', 'https://rowingblazers.com/products/grateful-dead-stealie-cashmere-sweater-heather-gray', 'https://cdn.shopify.com/s/files/1/1770/6343/files/MH26S18S04HGY_1.jpg?v=1793289309', '90s-vintage'),
    piece('sh-coat', 'tops', 'Striped multi-seam coat', 'Sergio Hudson', '$4795', 'sergiohudson.com', 'https://sergiohudson.com/products/multi-seam-coat', 'https://cdn.shopify.com/s/files/1/0423/2835/9066/files/SERGIO_HUDSON_23050.jpg?v=1770925184', 'modern-runway'),
    piece('sh-snake-jacket', 'tops', 'Snakeskin belted jacket', 'Sergio Hudson', '$4395', 'sergiohudson.com', 'https://sergiohudson.com/products/collarless-jacket-camel', 'https://cdn.shopify.com/s/files/1/0423/2835/9066/files/4F0C8834-5D22-4FCD-8722-71E7C284AEE9_9dc54575-537f-4449-bd94-5a45b28f1e12.png?v=1793893738', 'modern-runway'),
    piece('marimo-peplum', 'tops', 'Pinstripe peplum jacket', 'Marimo', '$2225', 'marimofashion.com', 'https://marimofashion.com/products/magnolia-chocolate-brown-pinstripe-wool-peplum-jacket-with-belt', 'https://cdn.shopify.com/s/files/1/0073/3819/7074/files/brown_pinstripe_fine_wool_peplum_jacket_with_belt_premium_workwear_front.png?v=1792248216', '90s-vintage'),
    piece('marimo-coat', 'tops', 'Pale alpaca wrap coat', 'Marimo', '$4225', 'marimofashion.com', 'https://marimofashion.com/products/wrightia-pale-beige-alpaca-wool-blend-coat-with-crystal-embroidery', 'https://cdn.shopify.com/s/files/1/0073/3819/7074/files/Premiumalpacawoolluxurywinterjacketcoatmarimo2.png?v=1792243272', 'modern-runway'),
    piece('layo-seafoam', 'tops', 'Seafoam tuxedo blazer', 'Layo G', '$149', 'layo-g.com', 'https://www.layo-g.com/products/seafoam-gray-women-s-blazer-rebellious-boss', 'https://cdn.shopify.com/s/files/1/1173/3490/files/BlazerGhost-SeafoamGrayFRONT.png?v=1778831870', 'street-luxe'),
  ],
  bottoms: [
    piece('tc-denim', 'bottoms', 'Indigo straight jeans', 'True Classic', '$78', 'trueclassictees.com', 'https://www.trueclassictees.com/products/medium-indigo-wash-straight-authentic-stretch-jeans', 'https://www.trueclassictees.com/cdn/shop/files/4713_MEDIUMINDIGOWASH_1_f6f1530a-6e48-4c00-be87-ea6f9647d6fe.jpg?v=1716311036', 'street-luxe'),
    piece('marimo-slip', 'bottoms', 'Cream silk slip skirt', 'Marimo', '$140', 'marimofashion.com', 'https://marimofashion.com/products/gladiolus-cream-silk-slip-skirt', 'https://marimofashion.com/cdn/shop/files/Gladiolus_cream_cady_slip_skirt_FRONT_1800x1800.png?v=1747393340', '90s-vintage'),
    piece('id-column', 'bottoms', 'Brown column skirt', 'Identity', '$55', 'identity.co.za', 'https://www.identity.co.za/brown-rib-column-skirt/product/prod3232816', 'https://i1.adis.ws/i/truworths/prod3232816_1.jpeg', 'modern-runway'),
    piece('sh-white-flare', 'bottoms', 'White bootcut trousers', 'Sergio Hudson', '$1195', 'sergiohudson.com', 'https://sergiohudson.com/products/high-waisted-boot-cut-pant-white', 'https://cdn.shopify.com/s/files/1/0423/2835/9066/files/White_flared_trousers_front_view-2.png?v=1793731494', 'modern-runway'),
    piece('sh-snake-skirt', 'bottoms', 'Snakeskin pencil skirt', 'Sergio Hudson', '$2595', 'sergiohudson.com', 'https://sergiohudson.com/products/leather-pencil-skirt-copy', 'https://cdn.shopify.com/s/files/1/0423/2835/9066/files/1046D98C-AC7D-486A-8296-E9B740ACD96E.png?v=1793723592', '90s-vintage'),
    piece('ulla-lisbet', 'bottoms', 'Denim button midi skirt', 'Ulla Johnson', '$550', 'ullajohnson.com', 'https://ullajohnson.com/products/the-lisbet-denim-skirt-danube-1', 'https://cdn.shopify.com/s/files/1/0221/7797/2320/files/UJ9903042_DANUBE_FL_a_r_2_8e9cb482-51a0-48c5-a45e-c41da33b821d.webp?v=1794339438', 'street-luxe'),
    piece('ulla-bianca', 'bottoms', 'Feather jacquard jeans', 'Ulla Johnson', '$590', 'ullajohnson.com', 'https://ullajohnson.com/products/the-bianca-jacquard-jean-washed-tigris-1', 'https://cdn.shopify.com/s/files/1/0221/7797/2320/files/UJ9904119_WASHEDTIGRIS_FL_a_r.webp?v=1794339580', 'street-luxe'),
    piece('marimo-alpinia', 'bottoms', 'Burgundy wide-leg trousers', 'Marimo', '$1295', 'marimofashion.com', 'https://marimofashion.com/products/alpinia-dark-burgundy-fine-wool-wide-leg-suit-pants', 'https://cdn.shopify.com/s/files/1/0073/3819/7074/files/Dark_burgundy_fine_wool_wide_leg_suit_pant.jpg?v=1792251033', 'modern-runway'),
    piece('marimo-lagetta', 'bottoms', 'Pinstripe pencil skirt', 'Marimo', '$1095', 'marimofashion.com', 'https://marimofashion.com/products/lagetta-chocolate-brown-pinstripe-wool-midi-pencil-skirt', 'https://cdn.shopify.com/s/files/1/0073/3819/7074/files/brown_gold_pinstripe_fine_wool_midi_pencil_skirt.png?v=1792250190', '90s-vintage'),
    piece('marimo-plum', 'bottoms', 'Plum wool pencil skirt', 'Marimo', '$1095', 'marimofashion.com', 'https://marimofashion.com/products/lagetta-dusty-plum-purple-wool-bamboo-midi-pencil-skirt', 'https://cdn.shopify.com/s/files/1/0073/3819/7074/files/Dusty_plum_midi_pencil_skirt_wool-bamboo_front.png?v=1792249776', '90s-vintage'),
    piece('layo-teal', 'bottoms', 'Teal stretch trousers', 'Layo G', '$90', 'layo-g.com', 'https://www.layo-g.com/products/teal-blue-petite-womens-stretch-dress-pants-crop-cut', 'https://cdn.shopify.com/s/files/1/1173/3490/files/Tealfrontleggingspants.png?v=1775268790', 'street-luxe'),
  ],
  dresses: [
    piece('hae-slip', 'dresses', 'Black slip maxi dress', 'HAE', '$128', 'hae-us.com', 'https://hae-us.com/products/low-back-slip-maxi-dress', 'https://hae-us.com/cdn/shop/files/hae500009black.webp?v=1722570896&width=1200', '90s-vintage'),
    piece('layo-fuchsia', 'dresses', 'Fuchsia belted jacket dress', 'Layo G', '$199', 'layo-g.com', 'https://www.layo-g.com/products/flared-collar-jacket-dress-fuchsia-purple-pink', 'https://cdn.shopify.com/s/files/1/1173/3490/files/FucshiaFrontFlaredCollarJacket.png?v=1775834706', 'modern-runway'),
  ],
  shoes: [
    piece('sm-thrive', 'shoes', 'Black leather stiletto', 'Steve Madden', '$129', 'stevemadden.ca', 'https://www.stevemadden.ca/products/thrive-black-leather', 'https://www.stevemadden.ca/cdn/shop/files/STEVEMADDEN_SHOES_THRIVE_BLACK-LEATHER_01.jpg?v=1717704638', 'modern-runway'),
    piece('aldo-boot', 'shoes', 'Black ankle boot', 'ALDO', '$130', 'aldoshoes.com', 'https://www.aldoshoes.com/products/calder-black', 'https://www.aldoshoes.com/cdn/shop/files/product_14290444_calder_black_001-001-043_alt2_sq_gy.jpg?v=1759153005&width=800', 'street-luxe'),
    piece('ma-loafer', 'shoes', 'Black leather loafer', 'Michael Andrews', '$450', 'michaelandrews.com', 'https://www.michaelandrews.com/product/siena-leather-loafer-in-nero-fondente-11-5/', 'https://www.michaelandrews.com/wp-content/uploads/2024/06/sbp931-pecary-nero-blake-rapid-6623-960x827.jpg', 'street-luxe'),
    piece('toms-sneaker', 'shoes', 'White leather sneaker', 'TOMS', '$85', 'toms.com', 'https://www.toms.com/products/kameron-white-leather-sneaker', 'https://www.toms.com/cdn/shop/files/10020733-s.jpg?v=1762277266&width=1200', 'street-luxe'),
    piece('fab-court', 'shoes', 'Nude pointed court', 'Gabor', '$140', 'fabucci.ie', 'https://www.fabucci.ie/products/gabor-nude-patent-pointed-court-shoe', 'https://www.fabucci.ie/cdn/shop/files/gabnornude-patent-pointed-toe-court-shoe_6.jpg?v=1698524951', 'modern-runway'),
    piece('sm-tiber', 'shoes', 'Black stretch knee boot', 'Steve Madden', '$180', 'stevemadden.ca', 'https://www.stevemadden.ca/products/tiber-black', 'https://cdn.shopify.com/s/files/1/0046/5548/0950/files/STEVEMADDEN_SHOES_TIBER_BLACK-STRETCH_01.jpg?v=1794328126', 'street-luxe'),
    piece('sm-keller', 'shoes', 'Black penny loafer', 'Steve Madden', '$130', 'stevemadden.ca', 'https://www.stevemadden.ca/products/keller-black', 'https://cdn.shopify.com/s/files/1/0046/5548/0950/files/STEVE_MADDEN_CANADA_MEN_KELLER_BLACK_SIDE2.jpg?v=1793300771', 'modern-runway'),
    piece('sm-lowery', 'shoes', 'Brown harness boot', 'Steve Madden', '$300', 'stevemadden.ca', 'https://www.stevemadden.ca/products/lowery-brown-leather', 'https://cdn.shopify.com/s/files/1/0046/5548/0950/files/STEVEMADDEN_SHOES_LOWERY_BROWN-DISTRESSED_01.webp?v=1793298503', '90s-vintage'),
    piece('toms-area', 'shoes', 'Black satin ballet flat', 'TOMS', '$145', 'toms.com', 'https://www.toms.com/products/womens-toms-x-area-alpargata-ballet-flat-dark-black-heavy-satin-rhinestone-10024145', 'https://cdn.shopify.com/s/files/1/0741/0529/1043/files/10024145-s.jpg?v=1792599323', '90s-vintage'),
  ],
};

export function catalogFor(audience: WardrobeAudience | null): Record<WardrobeSlot, WardrobePiece[]> {
  if (!audience) return wardrobeCatalog;
  const keep = (items: WardrobePiece[]) => items.filter((item) => (MEN_IDS.has(item.id) ? 'men' : 'women') === audience);
  return {
    tops: keep(wardrobeCatalog.tops),
    bottoms: keep(wardrobeCatalog.bottoms),
    dresses: audience === 'women' ? wardrobeCatalog.dresses : [],
    shoes: keep(wardrobeCatalog.shoes),
  };
}

export const wardrobePieceCount =
  wardrobeCatalog.tops.length +
  wardrobeCatalog.bottoms.length +
  wardrobeCatalog.dresses.length +
  wardrobeCatalog.shoes.length;
