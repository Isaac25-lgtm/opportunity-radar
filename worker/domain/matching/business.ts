import { TURNOVER_BANDS, type BusinessProfile } from '../../../shared/schemas';
import {
  Evidence,
  canonicalCountry,
  containsTerm,
  countryAllowed,
  deadlinePassed,
  finalize,
  isEastAfrican,
  norm,
  phraseSimilarity,
  type MatchOpportunity,
  type MatchResult,
  type Weights,
} from './common';

const fmtUgx = (n: number) => `UGX ${n.toLocaleString('en-US')}`;

function holds(list: string[], required: string): boolean {
  const n = norm(required);
  return list.some((x) => {
    const xn = norm(x);
    return xn === n || containsTerm(xn, required) || containsTerm(n, x);
  });
}

export function matchBusiness(
  p: BusinessProfile,
  o: MatchOpportunity,
  w: Weights,
  now = new Date(),
): MatchResult {
  const ev = new Evidence();
  const r = o.requirements;
  const text = norm(`${o.title} ${o.description} ${o.meta?.project_name ?? ''}`);

  if (o.status !== 'open' && o.status !== 'status_uncertain')
    ev.disqualify(`The opportunity is ${o.status}.`);
  if (deadlinePassed(o, now)) ev.disqualify('The submission deadline has passed.');
  if (r.applicant_type === 'individual' || o.category === 'consultancy') {
    ev.req('Applicants: individual consultants');
    ev.disqualify(
      'This assignment is for individual consultants, not firms. Use a career profile to pursue it.',
    );
  }

  // Registration
  if (r.registration_required) {
    ev.req('Bidder must be a registered business');
    if (p.is_registered === true) {
      ev.fact(`Registered in ${p.registration_country || 'stated country'}`);
      ev.reason('Registration', 'Your profile states the business is registered.');
    } else if (p.is_registered === false)
      ev.disqualify('Requires a registered business; your profile says the business is not registered.');
    else ev.miss('Confirm your business registration status.');
  }

  // Bidder country eligibility
  if (r.eligible_countries.length) {
    ev.req(`Eligible bidder countries: ${r.eligible_countries.join(', ')}`);
    if (!p.registration_country) ev.miss('Add your country of registration to check bidder eligibility.');
    else if (!countryAllowed(r.eligible_countries, p.registration_country))
      ev.disqualify(
        `Open to firms from ${r.eligible_countries.join(', ')}; your firm is registered in ${p.registration_country}.`,
      );
  }

  // Turnover
  if (r.min_turnover_ugx) {
    ev.req(`Minimum annual turnover: ${fmtUgx(r.min_turnover_ugx)}`);
    if (!p.turnover_band)
      ev.miss(
        `Confirm annual turnover of at least ${fmtUgx(r.min_turnover_ugx)} (not disclosed in your profile).`,
      );
    else {
      const band = TURNOVER_BANDS[p.turnover_band];
      ev.fact(`Turnover band: ${band.label}`);
      if (band.max <= r.min_turnover_ugx)
        ev.disqualify(
          `Requires turnover of ${fmtUgx(r.min_turnover_ugx)}; your stated band is ${band.label}.`,
        );
      else if (band.min < r.min_turnover_ugx)
        ev.miss(
          `Your turnover band (${band.label}) spans the ${fmtUgx(r.min_turnover_ugx)} minimum — confirm with audited accounts.`,
        );
      else ev.reason('Turnover', `Your stated band (${band.label}) is above the minimum.`);
    }
  }

  // Years in operation
  if (r.min_years_in_operation) {
    ev.req(`Minimum years in operation: ${r.min_years_in_operation}`);
    if (!p.year_established) ev.miss('Add the year your business was established.');
    else {
      const yrs = now.getUTCFullYear() - p.year_established;
      ev.fact(`In operation since ${p.year_established}`);
      if (yrs < r.min_years_in_operation)
        ev.disqualify(
          `Requires ${r.min_years_in_operation} years in operation; your business has about ${yrs}.`,
        );
    }
  }

  // Past performance
  if (r.min_past_contracts) {
    ev.req(`Similar past contracts: at least ${r.min_past_contracts}`);
    const n = p.past_contracts.length;
    if (n < r.min_past_contracts)
      ev.miss(
        `The notice asks for ${r.min_past_contracts} similar contracts; your profile records ${n}. Add evidence of past contracts.`,
      );
    else ev.reason('Past performance', `Your profile records ${n} past contracts.`);
  }

  // Certifications and licenses — never assume.
  for (const c of [...r.certifications, ...r.licenses]) {
    ev.req(`Required: ${c}`);
    if (holds([...p.certifications, ...p.licenses], c)) {
      ev.fact(`Holds: ${c}`);
      ev.reason('Compliance', `Your profile lists ${c}.`);
    } else ev.miss(`Not in your profile: ${c}. Confirm you hold it before bidding.`);
  }
  if (r.tax_clearance_required) {
    ev.req('Valid tax clearance certificate');
    if (p.tax_compliance === 'expired')
      ev.disqualify('A valid tax clearance is required; your profile marks it as expired.');
    else if (p.tax_compliance !== 'valid') ev.miss('Confirm you have a valid tax clearance certificate.');
  }

  // ---- Relevance ----
  const offer = [...p.service_lines, ...p.products_services];
  let scope: number | null = null;
  if (offer.length || p.procurement_categories.length) {
    const hits = offer.filter((s) => containsTerm(text, s));
    let v = offer.length ? Math.min(1, hits.length / Math.min(3, offer.length)) : 0;
    const sim = offer.length ? phraseSimilarity(offer, o.title).value : 0;
    v = Math.max(v, sim);
    if (r.procurement_categories.length && p.procurement_categories.length) {
      const catOk = r.procurement_categories.some((c) => p.procurement_categories.includes(c));
      ev.req(`Procurement category: ${r.procurement_categories.join(', ')}`);
      if (catOk) v = Math.max(v, 0.4) * 1;
      else v = v * 0.3;
      if (!catOk)
        ev.reason(
          'Category',
          `This is a ${r.procurement_categories.join('/')} procurement; your categories are ${p.procurement_categories.join(', ')}.`,
        );
    }
    scope = v;
    if (hits.length) {
      ev.fact(`Services: ${hits.slice(0, 6).join(', ')}`);
      ev.reason('Scope', `The notice covers ${hits.slice(0, 5).join(', ')}, which you supply.`);
    }
  } else ev.miss('Add your service lines or products so tenders can be matched.');
  ev.component('scope', w.scope, scope);

  const oc = canonicalCountry(o.country);
  const geos = [...p.operating_locations, ...p.preferred_geographies, p.registration_country].filter(Boolean);
  if (geos.length && oc) {
    const hit = geos.some(
      (g) => canonicalCountry(g) === oc || (o.location ? containsTerm(norm(o.location), g) : false),
    );
    const ea = geos.some((g) => isEastAfrican(g)) && isEastAfrican(oc);
    ev.component('geography', w.geography, hit ? 1 : ea ? 0.5 : 0.15);
    if (hit)
      ev.reason('Geography', `Performance location (${o.location || o.country}) is where you operate.`);
  } else ev.component('geography', w.geography, null);

  if (p.industries.length) {
    const hits = p.industries.filter((i) => containsTerm(text, i));
    ev.component('sector', w.sector, hits.length ? 1 : 0.3);
    if (hits.length) ev.reason('Sector', `Sector match: ${hits.join(', ')}.`);
  } else ev.component('sector', w.sector, null);

  const budget = typeof o.meta?.budget_ugx === 'number' ? (o.meta.budget_ugx as number) : null;
  if (budget && (p.preferred_contract_min_ugx || p.preferred_contract_max_ugx)) {
    const min = p.preferred_contract_min_ugx ?? 0;
    const max = p.preferred_contract_max_ugx ?? Number.MAX_SAFE_INTEGER;
    const fits = budget >= min && budget <= max;
    ev.component('capacity', w.capacity, fits ? 1 : 0.3);
    if (fits) ev.reason('Contract size', `Published value ${fmtUgx(budget)} is within your preferred range.`);
  } else ev.component('capacity', w.capacity, null);

  if (p.past_contracts.length) {
    const sim = phraseSimilarity(
      p.past_contracts.map((c) => `${c.title} ${c.description}`),
      `${o.title} ${o.meta?.project_name ?? ''}`,
    );
    ev.component('track_record', w.track_record, Math.max(0.3, sim.value));
    if (sim.value >= 0.4) ev.reason('Track record', `Similar to past contract “${sim.best.slice(0, 80)}”.`);
  } else ev.component('track_record', w.track_record, null);

  for (const d of r.required_documents.slice(0, 8)) ev.req(`Document: ${d}`);
  return finalize('business', o, ev, 0.4);
}
