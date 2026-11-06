import type { OpportunityCategory, VerificationState } from '../../../shared/constants';
import type { Requirements } from '../../../shared/schemas';
import type { Env } from '../../env';

export type SourceRow = {
  id: string;
  slug: string;
  name: string;
  owner: string;
  website: string;
  source_type: 'official' | 'ats' | 'aggregator' | 'partner' | 'curated';
  connector: string;
  config: string;
  categories: string;
  geography: string;
  access_method: string;
  terms_url: string | null;
  automation: 'automated' | 'partial' | 'curated';
  enabled: number;
  refresh_minutes: number;
  rate_limit_per_hour: number;
  verification_policy: string;
  notes: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_item_at: string | null;
  error_count: number;
  consecutive_failures: number;
  last_error: string | null;
};

export type NormalizedItem = {
  external_id: string;
  category: OpportunityCategory;
  title: string;
  organization: string;
  description: string;
  country: string | null;
  countries: string[];
  location: string | null;
  remote: 'onsite' | 'remote' | 'hybrid' | 'unknown';
  /** Where the record was found (listing page at the source). */
  source_url: string;
  /** Where the user applies/bids. Must be the real destination, never disguised. */
  application_url: string | null;
  /** The responsible organisation's own page, when known. */
  official_url: string | null;
  reference_no: string | null;
  published_at: string | null;
  deadline_at: string | null;
  deadline_tz: string | null;
  deadline_note: string | null;
  /** Lifecycle evidence published by the source itself (e.g. a cancellation notice). */
  status_hint: 'open' | 'cancelled' | 'closed' | null;
  verification: VerificationState;
  meta: Record<string, unknown>;
  requirements: Partial<Requirements>;
  requirements_source: 'structured' | 'heuristic' | 'admin' | 'none';
};

export type ConnectorResult = {
  items: NormalizedItem[];
  /** true only when the source returned its complete current listing (enables "missing" detection). */
  complete: boolean;
  /** Records the source returned that were deliberately skipped (e.g. contract awards). */
  skipped: number;
};

export type ConnectorContext = { env: Env; fetcher?: typeof fetch; now: Date };

export interface Connector {
  type: string;
  fetch(source: SourceRow, config: Record<string, any>, ctx: ConnectorContext): Promise<ConnectorResult>;
}
