/**
 * World countries with demonyms and aliases, plus the country groups that opportunity notices use.
 * Matching resolves free-text nationality/eligibility ("Kenyan", "UK", "Côte d'Ivoire", "ECOWAS")
 * to canonical lower-case country names.
 *
 * Region codes (UN M49 sub-regions, simplified):
 *   NAF North Africa · EAF East Africa · WAF West Africa · MAF Central Africa · SAF Southern Africa
 *   EUR Europe · ME Middle East · AS Asia · OC Oceania · NAM North America · LAM Latin America · CAR Caribbean
 */
type Region = 'NAF' | 'EAF' | 'WAF' | 'MAF' | 'SAF' | 'EUR' | 'ME' | 'AS' | 'OC' | 'NAM' | 'LAM' | 'CAR';

// [canonical name, region, aliases and demonyms]
const COUNTRIES: Array<[string, Region, string[]]> = [
  // Africa
  ['algeria', 'NAF', ['algerian']],
  ['egypt', 'NAF', ['egyptian']],
  ['libya', 'NAF', ['libyan']],
  ['morocco', 'NAF', ['moroccan']],
  ['tunisia', 'NAF', ['tunisian']],
  ['sudan', 'NAF', ['sudanese']],
  ['burundi', 'EAF', ['burundian']],
  ['comoros', 'EAF', ['comoran', 'comorian']],
  ['djibouti', 'EAF', ['djiboutian']],
  ['eritrea', 'EAF', ['eritrean']],
  ['ethiopia', 'EAF', ['ethiopian']],
  ['kenya', 'EAF', ['kenyan']],
  ['madagascar', 'EAF', ['malagasy']],
  ['malawi', 'EAF', ['malawian']],
  ['mauritius', 'EAF', ['mauritian']],
  ['mozambique', 'EAF', ['mozambican']],
  ['rwanda', 'EAF', ['rwandan']],
  ['seychelles', 'EAF', ['seychellois']],
  ['somalia', 'EAF', ['somali']],
  ['south sudan', 'EAF', ['south sudanese']],
  ['tanzania', 'EAF', ['tanzanian', 'united republic of tanzania']],
  ['uganda', 'EAF', ['ugandan', 'ug']],
  ['zambia', 'EAF', ['zambian']],
  ['zimbabwe', 'EAF', ['zimbabwean']],
  ['benin', 'WAF', ['beninese']],
  ['burkina faso', 'WAF', ['burkinabe', 'burkinabé']],
  ['cabo verde', 'WAF', ['cape verde', 'cape verdean', 'cabo verdean']],
  ["cote d'ivoire", 'WAF', ['ivory coast', 'ivorian', 'côte d’ivoire', "côte d'ivoire", 'cote d’ivoire']],
  ['gambia', 'WAF', ['the gambia', 'gambian']],
  ['ghana', 'WAF', ['ghanaian']],
  ['guinea', 'WAF', ['guinean']],
  ['guinea-bissau', 'WAF', ['guinea bissau', 'bissau-guinean']],
  ['liberia', 'WAF', ['liberian']],
  ['mali', 'WAF', ['malian']],
  ['mauritania', 'WAF', ['mauritanian']],
  ['niger', 'WAF', ['nigerien']],
  ['nigeria', 'WAF', ['nigerian']],
  ['senegal', 'WAF', ['senegalese']],
  ['sierra leone', 'WAF', ['sierra leonean']],
  ['togo', 'WAF', ['togolese']],
  ['angola', 'MAF', ['angolan']],
  ['cameroon', 'MAF', ['cameroonian']],
  ['central african republic', 'MAF', ['car', 'central african']],
  ['chad', 'MAF', ['chadian']],
  ['congo', 'MAF', ['republic of the congo', 'congo-brazzaville', 'congo brazzaville']],
  [
    'democratic republic of the congo',
    'MAF',
    ['drc', 'dr congo', 'congolese', 'congo, democratic republic of', 'congo-kinshasa'],
  ],
  ['equatorial guinea', 'MAF', ['equatoguinean']],
  ['gabon', 'MAF', ['gabonese']],
  ['sao tome and principe', 'MAF', ['são tomé and príncipe', 'santomean']],
  ['botswana', 'SAF', ['motswana', 'batswana', 'botswanan']],
  ['eswatini', 'SAF', ['swaziland', 'swazi', 'liswati']],
  ['lesotho', 'SAF', ['basotho', 'mosotho']],
  ['namibia', 'SAF', ['namibian']],
  ['south africa', 'SAF', ['south african']],
  // Europe
  ['albania', 'EUR', ['albanian']],
  ['andorra', 'EUR', ['andorran']],
  ['austria', 'EUR', ['austrian']],
  ['belarus', 'EUR', ['belarusian']],
  ['belgium', 'EUR', ['belgian']],
  ['bosnia and herzegovina', 'EUR', ['bosnian', 'bosnia']],
  ['bulgaria', 'EUR', ['bulgarian']],
  ['croatia', 'EUR', ['croatian']],
  ['cyprus', 'EUR', ['cypriot']],
  ['czechia', 'EUR', ['czech republic', 'czech']],
  ['denmark', 'EUR', ['danish', 'dane']],
  ['estonia', 'EUR', ['estonian']],
  ['finland', 'EUR', ['finnish', 'finn']],
  ['france', 'EUR', ['french']],
  ['germany', 'EUR', ['german']],
  ['greece', 'EUR', ['greek']],
  ['hungary', 'EUR', ['hungarian']],
  ['iceland', 'EUR', ['icelandic', 'icelander']],
  ['ireland', 'EUR', ['irish']],
  ['italy', 'EUR', ['italian']],
  ['kosovo', 'EUR', ['kosovar']],
  ['latvia', 'EUR', ['latvian']],
  ['liechtenstein', 'EUR', ['liechtensteiner']],
  ['lithuania', 'EUR', ['lithuanian']],
  ['luxembourg', 'EUR', ['luxembourgish', 'luxembourger']],
  ['malta', 'EUR', ['maltese']],
  ['moldova', 'EUR', ['moldovan']],
  ['monaco', 'EUR', ['monegasque']],
  ['montenegro', 'EUR', ['montenegrin']],
  ['netherlands', 'EUR', ['dutch', 'the netherlands', 'holland']],
  ['north macedonia', 'EUR', ['macedonian', 'macedonia']],
  ['norway', 'EUR', ['norwegian']],
  ['poland', 'EUR', ['polish', 'pole']],
  ['portugal', 'EUR', ['portuguese']],
  ['romania', 'EUR', ['romanian']],
  ['russia', 'EUR', ['russian', 'russian federation']],
  ['san marino', 'EUR', ['sammarinese']],
  ['serbia', 'EUR', ['serbian']],
  ['slovakia', 'EUR', ['slovak']],
  ['slovenia', 'EUR', ['slovenian', 'slovene']],
  ['spain', 'EUR', ['spanish', 'spaniard']],
  ['sweden', 'EUR', ['swedish', 'swede']],
  ['switzerland', 'EUR', ['swiss']],
  ['ukraine', 'EUR', ['ukrainian']],
  [
    'united kingdom',
    'EUR',
    ['uk', 'british', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
  ],
  // Middle East
  ['bahrain', 'ME', ['bahraini']],
  ['iran', 'ME', ['iranian']],
  ['iraq', 'ME', ['iraqi']],
  ['israel', 'ME', ['israeli']],
  ['jordan', 'ME', ['jordanian']],
  ['kuwait', 'ME', ['kuwaiti']],
  ['lebanon', 'ME', ['lebanese']],
  ['oman', 'ME', ['omani']],
  ['palestine', 'ME', ['palestinian', 'state of palestine']],
  ['qatar', 'ME', ['qatari']],
  ['saudi arabia', 'ME', ['saudi', 'saudi arabian']],
  ['syria', 'ME', ['syrian']],
  ['turkey', 'ME', ['turkish', 'turkiye', 'türkiye']],
  ['united arab emirates', 'ME', ['uae', 'emirati']],
  ['yemen', 'ME', ['yemeni']],
  // Asia
  ['afghanistan', 'AS', ['afghan']],
  ['armenia', 'AS', ['armenian']],
  ['azerbaijan', 'AS', ['azerbaijani']],
  ['bangladesh', 'AS', ['bangladeshi']],
  ['bhutan', 'AS', ['bhutanese']],
  ['brunei', 'AS', ['bruneian', 'brunei darussalam']],
  ['cambodia', 'AS', ['cambodian']],
  ['china', 'AS', ['chinese']],
  ['georgia', 'AS', ['georgian']],
  ['india', 'AS', ['indian']],
  ['indonesia', 'AS', ['indonesian']],
  ['japan', 'AS', ['japanese']],
  ['kazakhstan', 'AS', ['kazakh', 'kazakhstani']],
  ['kyrgyzstan', 'AS', ['kyrgyz']],
  ['laos', 'AS', ['lao', 'laotian']],
  ['malaysia', 'AS', ['malaysian']],
  ['maldives', 'AS', ['maldivian']],
  ['mongolia', 'AS', ['mongolian']],
  ['myanmar', 'AS', ['burmese', 'burma']],
  ['nepal', 'AS', ['nepali', 'nepalese']],
  ['north korea', 'AS', ['north korean']],
  ['pakistan', 'AS', ['pakistani']],
  ['philippines', 'AS', ['filipino', 'philippine']],
  ['singapore', 'AS', ['singaporean']],
  ['south korea', 'AS', ['korea', 'korean', 'south korean', 'republic of korea']],
  ['sri lanka', 'AS', ['sri lankan']],
  ['taiwan', 'AS', ['taiwanese']],
  ['tajikistan', 'AS', ['tajik']],
  ['thailand', 'AS', ['thai']],
  ['timor-leste', 'AS', ['east timor', 'timorese']],
  ['turkmenistan', 'AS', ['turkmen']],
  ['uzbekistan', 'AS', ['uzbek']],
  ['vietnam', 'AS', ['vietnamese', 'viet nam']],
  // Oceania
  ['australia', 'OC', ['australian']],
  ['fiji', 'OC', ['fijian']],
  ['kiribati', 'OC', ['i-kiribati']],
  ['marshall islands', 'OC', ['marshallese']],
  ['micronesia', 'OC', ['micronesian']],
  ['nauru', 'OC', ['nauruan']],
  ['new zealand', 'OC', ['new zealander', 'kiwi']],
  ['palau', 'OC', ['palauan']],
  ['papua new guinea', 'OC', ['papua new guinean', 'png']],
  ['samoa', 'OC', ['samoan']],
  ['solomon islands', 'OC', ['solomon islander']],
  ['tonga', 'OC', ['tongan']],
  ['tuvalu', 'OC', ['tuvaluan']],
  ['vanuatu', 'OC', ['ni-vanuatu']],
  // Americas
  ['canada', 'NAM', ['canadian']],
  ['united states', 'NAM', ['usa', 'us', 'u.s.', 'american', 'united states of america']],
  ['mexico', 'LAM', ['mexican']],
  ['argentina', 'LAM', ['argentine', 'argentinian']],
  ['belize', 'LAM', ['belizean']],
  ['bolivia', 'LAM', ['bolivian']],
  ['brazil', 'LAM', ['brazilian']],
  ['chile', 'LAM', ['chilean']],
  ['colombia', 'LAM', ['colombian']],
  ['costa rica', 'LAM', ['costa rican']],
  ['ecuador', 'LAM', ['ecuadorian']],
  ['el salvador', 'LAM', ['salvadoran']],
  ['guatemala', 'LAM', ['guatemalan']],
  ['guyana', 'LAM', ['guyanese']],
  ['honduras', 'LAM', ['honduran']],
  ['nicaragua', 'LAM', ['nicaraguan']],
  ['panama', 'LAM', ['panamanian']],
  ['paraguay', 'LAM', ['paraguayan']],
  ['peru', 'LAM', ['peruvian']],
  ['suriname', 'LAM', ['surinamese']],
  ['uruguay', 'LAM', ['uruguayan']],
  ['venezuela', 'LAM', ['venezuelan']],
  ['antigua and barbuda', 'CAR', ['antiguan']],
  ['bahamas', 'CAR', ['the bahamas', 'bahamian']],
  ['barbados', 'CAR', ['barbadian', 'bajan']],
  ['cuba', 'CAR', ['cuban']],
  ['dominica', 'CAR', ['dominican (dominica)']],
  ['dominican republic', 'CAR', ['dominican']],
  ['grenada', 'CAR', ['grenadian']],
  ['haiti', 'CAR', ['haitian']],
  ['jamaica', 'CAR', ['jamaican']],
  ['saint kitts and nevis', 'CAR', ['st kitts and nevis', 'kittitian']],
  ['saint lucia', 'CAR', ['st lucia', 'saint lucian']],
  ['saint vincent and the grenadines', 'CAR', ['st vincent and the grenadines', 'vincentian']],
  ['trinidad and tobago', 'CAR', ['trinidadian', 'tobagonian']],
];

const AFRICA_REGIONS: Region[] = ['NAF', 'EAF', 'WAF', 'MAF', 'SAF'];

const COMMONWEALTH = [
  'antigua and barbuda', 'australia', 'bahamas', 'bangladesh', 'barbados', 'belize', 'botswana', 'brunei',
  'cameroon', 'canada', 'cyprus', 'dominica', 'eswatini', 'fiji', 'gabon', 'gambia', 'ghana', 'grenada',
  'guyana', 'india', 'jamaica', 'kenya', 'kiribati', 'lesotho', 'malawi', 'malaysia', 'maldives', 'malta',
  'mauritius', 'mozambique', 'namibia', 'nauru', 'new zealand', 'nigeria', 'pakistan', 'papua new guinea',
  'rwanda', 'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines', 'samoa', 'seychelles',
  'sierra leone', 'singapore', 'solomon islands', 'south africa', 'sri lanka', 'tanzania', 'togo', 'tonga',
  'trinidad and tobago', 'tuvalu', 'uganda', 'united kingdom', 'vanuatu', 'zambia',
]; // prettier-ignore

const EU = [
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czechia', 'denmark', 'estonia', 'finland', 'france',
  'germany', 'greece', 'hungary', 'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta',
  'netherlands', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden',
]; // prettier-ignore

/** East African Community members, plus the wider Horn as notices often use "East Africa" loosely. */
const EAST_AFRICA = [
  'burundi', 'democratic republic of the congo', 'kenya', 'rwanda', 'somalia', 'south sudan', 'tanzania',
  'uganda', 'ethiopia', 'eritrea', 'djibouti',
]; // prettier-ignore
const EAC = EAST_AFRICA.slice(0, 8);

const ECOWAS = [
  'benin', 'burkina faso', 'cabo verde', "cote d'ivoire", 'gambia', 'ghana', 'guinea', 'guinea-bissau',
  'liberia', 'mali', 'niger', 'nigeria', 'senegal', 'sierra leone', 'togo',
]; // prettier-ignore

const SADC = [
  'angola', 'botswana', 'comoros', 'democratic republic of the congo', 'eswatini', 'lesotho', 'madagascar',
  'malawi', 'mauritius', 'mozambique', 'namibia', 'seychelles', 'south africa', 'tanzania', 'zambia', 'zimbabwe',
]; // prettier-ignore

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

const BY_KEY = new Map<string, string>();
const REGION = new Map<string, Region>();
for (const [name, region, aliases] of COUNTRIES) {
  REGION.set(name, region);
  for (const k of [name, ...aliases]) BY_KEY.set(norm(k), name);
}

/** Canonical country name for a name, demonym or alias; the normalised input if unknown. */
export function canonicalCountry(c: string | null | undefined): string {
  const n = norm(c ?? '');
  if (!n) return '';
  return BY_KEY.get(n) ?? BY_KEY.get(n.replace(/^the /, '')) ?? n;
}

export const isKnownCountry = (c: string) => REGION.has(canonicalCountry(c));

const inRegions = (country: string, regions: Region[]) => {
  const r = REGION.get(country);
  return !!r && regions.includes(r);
};

/** Country groups notices use, mapped to a membership test on a canonical country. */
const GROUPS: Array<[string[], (c: string) => boolean]> = [
  [['any', 'all', 'international', 'worldwide', 'all countries', 'global', 'any country', 'all nationalities'], () => true],
  [['africa', 'african countries', 'african nationals', 'pan-african', 'african union'], (c) => inRegions(c, AFRICA_REGIONS)],
  [['sub-saharan africa', 'sub saharan africa', 'ssa'], (c) => inRegions(c, AFRICA_REGIONS) && !['algeria', 'egypt', 'libya', 'morocco', 'tunisia'].includes(c)],
  [['north africa', 'northern africa'], (c) => inRegions(c, ['NAF'])],
  [['east africa', 'eastern africa', 'horn of africa'], (c) => EAST_AFRICA.includes(c)],
  [['eac', 'east african community'], (c) => EAC.includes(c)],
  [['west africa', 'western africa'], (c) => inRegions(c, ['WAF'])],
  [['ecowas'], (c) => ECOWAS.includes(c)],
  [['southern africa'], (c) => inRegions(c, ['SAF']) || SADC.includes(c)],
  [['sadc'], (c) => SADC.includes(c)],
  [['central africa', 'middle africa'], (c) => inRegions(c, ['MAF'])],
  [['commonwealth', 'commonwealth countries', 'commonwealth nations'], (c) => COMMONWEALTH.includes(c)],
  [['european union', 'eu', 'eu member states'], (c) => EU.includes(c)],
  [['europe'], (c) => inRegions(c, ['EUR'])],
  [['middle east', 'mena', 'middle east and north africa'], (c) => inRegions(c, ['ME']) || (inRegions(c, ['NAF']) && c !== 'sudan')],
  [['asia', 'asia-pacific', 'asia pacific'], (c) => inRegions(c, ['AS', 'OC'])],
  [['latin america', 'latin america and the caribbean', 'lac'], (c) => inRegions(c, ['LAM', 'CAR'])],
  [['caribbean'], (c) => inRegions(c, ['CAR'])],
]; // prettier-ignore

const GROUP_INDEX = new Map<string, (c: string) => boolean>();
for (const [names, test] of GROUPS) for (const n of names) GROUP_INDEX.set(norm(n), test);

export type CountryCheck = 'yes' | 'no' | 'unknown';

/**
 * Is a person/company from `country` covered by an eligibility list?
 * - 'yes'     the country is named, or belongs to a group we can resolve;
 * - 'no'      every entry is a country or a resolvable group, and none covers it;
 * - 'unknown' the country is unrecognised, or an entry is a group we cannot resolve reliably
 *             (e.g. "developing countries", "low and middle income countries"), so the person must confirm.
 */
export function countryEligibility(list: string[], country: string): CountryCheck {
  if (!list.length) return 'yes';
  const c = canonicalCountry(country);
  let unresolved = !REGION.has(c);
  for (const raw of list) {
    const entry = norm(raw);
    if (!entry) continue;
    const group = GROUP_INDEX.get(entry);
    if (group) {
      if (group('') === true) return 'yes'; // open eligibility
      if (REGION.has(c) && group(c)) return 'yes';
      continue;
    }
    const named = canonicalCountry(entry);
    if (named === c) return 'yes';
    if (!REGION.has(named)) unresolved = true;
  }
  return unresolved ? 'unknown' : 'no';
}

export function isEastAfrican(country: string): boolean {
  return EAST_AFRICA.includes(canonicalCountry(country));
}

/** Same UN sub-region (e.g. both West Africa), used for a "nearby" location score. */
export function sameRegion(a: string, b: string): boolean {
  const ra = REGION.get(canonicalCountry(a));
  return !!ra && ra === REGION.get(canonicalCountry(b));
}
