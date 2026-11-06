# Opportunity sources

Policy: official portals and documented public APIs/feeds first, then permitted aggregators (labelled as such), then
administrator-curated listings with a recorded official URL. No scraping of sites that forbid it, no login walls, no
CAPTCHA bypass, no scraping of Google results.

## Live connectors (tested against the real endpoints on 6 Nov 2026)

| Source | Connector | Access | Verification label | Notes |
| --- | --- | --- | --- | --- |
| World Bank procurement notices — Uganda, Kenya, Tanzania, Rwanda, Burundi, South Sudan | `worldbank` | Public JSON API `search.worldbank.org/api/v2/procnotices` (filter `notice_type_exact`) | Verified official | Invitations for Bids, Requests for Expression of Interest, Prequalification and RFPs. Contract awards and general notices are skipped. Individual-consultant selection is categorised as an individual consultancy, never as a firm tender. Deadlines are converted from the country's local time. |
| Grants.gov (keywords "Uganda", "East Africa") | `grantsgov` | Public JSON API `api.grants.gov/v1/api/search2`, no key | Verified official | Applicant eligibility is not published in the search API, so requirements are recorded as unknown and matching never assumes eligibility. |
| Remotive (remote jobs open worldwide/Africa) | `remotive` | Public JSON API `remotive.com/api/remote-jobs` | Aggregator only | Terms require attribution and a link back to the Remotive listing; both are shown. Fetched at most 4 times a day. |

A first local run ingested 335 listings (300 World Bank, 26 Grants.gov, 9 Remotive). Listings whose deadline had
already passed are not stored.

## Implemented, not active

| Source | Connector | Why inactive | To activate |
| --- | --- | --- | --- |
| ReliefWeb jobs (Uganda) | `reliefweb` | The API v2 requires a pre-approved `appname` (returns 403 otherwise). | Request an appname from ReliefWeb, set the `RELIEFWEB_APPNAME` secret, enable the source in the admin console. |
| Employer job boards on Lever | `lever` | Needs a specific employer slug. | Add a source with `{"company": "<slug>", "employer_name": "<name>"}`. Listings are labelled Verified ATS. |
| Employer job boards on Greenhouse | `greenhouse` | Needs a board token. | Add a source with `{"board": "<token>"}`. |
| Any official RSS/Atom feed | `rss` | Feed URL to be chosen by an admin. | Add a source with `{"url": "https://…", "category": "<category>"}`. Feeds that declare XML entities are refused. |
| Any documented JSON API | `json` | Mapping to be configured by an admin. | Add a source with `url`, `items_path` and `mapping` (id, title, url, …). |

## Administrator-curated (enabled)

| Source | Why curated |
| --- | --- |
| Uganda public procurement (PPDA Government Procurement Portal, gpp.ppda.go.ug) | A documented public API/feed was not confirmed; automated access is not enabled until one is. |
| Scholarships and fellowships | Most programmes publish no API. Admins record each from the official funder or university page. |
| Employer and NGO jobs | For employers without a public ATS feed. |

Curated listings carry `admin_verified` with the verifier and time, and become "stale" if not re-checked within 45 days.

## Adding a source

1. Confirm the source is official or reputable and that its terms and robots rules permit automated access.
2. In `/admin/sources`, add the source with owner, website, access method, terms URL, categories, geography, refresh
   interval, rate limit and verification policy. Keep it disabled.
3. Use **Run** on that source and check the run details and a few listings.
4. Enable it. It joins the next scheduled run.

For a new kind of API, add a connector in `worker/domain/ingestion/connectors/` implementing `Connector`, register it
in `connectors/index.ts`, and add a fixture-based unit test like those in `tests/unit/ingestion.test.ts`.

## Candidates still to investigate

UNGM (UN Global Marketplace), UNDP procurement notices, African Development Bank procurement, Kenya PPIP, Tanzania
NeST, Rwanda Umucyo, university scholarship pages (Makerere, Mastercard Foundation partners), DAAD, Commonwealth
Scholarships. Each needs the access/terms check above before a connector is written.
