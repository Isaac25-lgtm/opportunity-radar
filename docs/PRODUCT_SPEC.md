# Product specification

## Promise

A person or business creates a profile once. Opportunity Radar discovers genuine opportunities, checks their
requirements and status, explains how well they match, and alerts the user when an opportunity is worth pursuing.

## Profiles (one of each per account; number of active profiles depends on plan)

| Profile  | Captures                                                                                                                                                                                                                                                                                                                                                | Matched against                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Career   | Headline, summary, nationality, location, target roles, industries, seniority, employment types, work modes, preferred/excluded locations, salary expectation, skills, languages, work history, education, certifications, projects, memberships                                                                                                        | Jobs, internships, graduate programmes, individual consultancies, fellowships, training |
| Academic | Current level, qualifications with GPA/scale and classification, field, research interests, proposed research, target levels/fields/programmes, preferred countries/institutions, nationality, residence, language tests, funding need, publications, awards                                                                                            | Scholarships, fellowships, research grants, training                                    |
| Business | Registered/trading name, registration status and country, operating locations, description, procurement categories, service lines, products, sectors, year established, past contracts, turnover band, staff, certifications, licences, tax clearance status, supplier classifications, contract-size and geography preferences, consortium willingness | Tenders, RFPs, RFQs, EOIs, supplier registration, framework agreements, business grants |

Profiles can be skipped and added later. Nationality and supplier classifications are only used to check published
criteria, and the forms say so.

## CV Builder

- Start from a blank CV, the career profile, or an imported PDF/DOCX (text extracted in the browser; the user
  reviews every field before anything is saved, and can also update the career profile and keep the original file).
- Editor modelled on resume.io's layout: form on the left, live A4 preview on a dark panel on the right, completeness
  bar with next tip, collapsible entries, reorder and hide sections, autosave.
- Templates: Executive (modern two-column), Clarity (single-column ATS), Scholar (academic, serif) with accent colours.
- Export: PDF (print-optimised page → "Save as PDF"), DOCX (Basic plan and above). Exports count against plan limits.
- Version history with restore; duplicate CVs for different roles.
- Tailoring: shows which CV skills the notice mentions and which keywords are missing; a tailored copy only reorders
  content. Cover-letter drafts use only CV facts and leave `[bracketed prompts]` for anything the user must supply.

## Opportunities

Common model with category-specific `meta` and structured `requirements`. Each listing shows source, verification
state (verified official, verified ATS, aggregator only, admin verified, unverified), freshness (stale/uncertain),
lifecycle (open, closed, expired, cancelled), deadline with timezone, the official and application URLs, and its event
history. Users can search and filter (category, country, deadline window, publication window, eligibility, minimum
relevance, verified only, remote), save, dismiss, and track. Leaving for an unverified destination shows a warning.

## Matching statuses

- **Eligible based on available profile** — no stated requirement fails on known facts.
- **Potential match — confirm these requirements** — nothing fails, but some requirements are unconfirmed.
- **Not eligible based on a stated requirement** — a hard requirement fails (shown with the reason).
- **Insufficient information** — key facts are missing (for example nationality for a restricted scholarship), or
  the profile is too thin to score honestly.

## Tracker

Separate boards for applications and business bids with statuses Interested → Preparing → Applied/submitted →
Interview/shortlisted → Awarded/won, plus Rejected/Withdrawn/Closed; dates (applied, follow-up, deadline), notes, CV
and document attachments. Follow-up dates and saved-opportunity deadlines create reminders.

## Notifications

In-app notifications always; email when a provider is configured. User controls: email on/off, frequency (instant,
daily, weekly, off — limited by plan), categories, minimum relevance and quiet hours. Each new opportunity can alert a
user once; expired listings never alert; status changes notify users who saved the opportunity.

## Plans (initial configuration, editable by admins)

| Plan  | UGX / month | Highlights                                                                         |
| ----- | ----------- | ---------------------------------------------------------------------------------- |
| Free  | 0           | 1 profile, 1 CV, 5 PDF exports/month, weekly alerts, 3 documents, 10 tracked items |
| Basic | 10,000      | 2 profiles, 3 CVs, DOCX, tailoring, daily alerts, business tender matching         |
| Pro   | 20,000      | 3 profiles, 10 CVs, unlimited exports, cover letters, instant alerts               |
| Elite | 30,000      | Everything in Pro, unlimited CVs, 100 documents                                    |

Browsing every verified opportunity is free on all plans. Plans last one month from confirmed payment and do not
renew automatically.

## What the product does not do

It does not submit applications, bids or forms; does not guarantee selection or that a listing is still open; does
not invent CV content; does not scrape sites that forbid it.
