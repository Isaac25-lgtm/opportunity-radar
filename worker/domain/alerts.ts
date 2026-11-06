import type { Env } from '../env';
import type { ProfileType } from '../../shared/constants';
import { CATEGORY_LABELS } from '../../shared/constants';
import { emailProvider } from '../lib/providers';
import { getConfig, getWeights, setConfig, userPlan } from '../lib/store';
import { addMinutes, log, newId, nowIso, parseJson } from '../lib/util';
import { matchProfile, profileAccepts } from './matching';
import { toMatchOpportunity, toProfileRecord } from './feed';

type Prefs = {
  email_enabled: number;
  in_app_enabled: number;
  frequency: 'instant' | 'daily' | 'weekly' | 'off';
  categories: string;
  min_score: number;
  quiet_start: number | null;
  quiet_end: number | null;
};
const DEFAULT_PREFS: Prefs = {
  email_enabled: 1,
  in_app_enabled: 1,
  frequency: 'weekly',
  categories: '["new_match","deadline","follow_up","status_change"]',
  min_score: 60,
  quiet_start: null,
  quiet_end: null,
};

/** Local hour in an IANA timezone (falls back to Africa/Kampala). */
export function localHour(d: Date, tz: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(d),
    );
  } catch {
    return (d.getUTCHours() + 3) % 24;
  }
}
export function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * New-match alerts. Processes newly-seen opportunities after a cursor, so an unchanged listing re-seen on
 * later ingestion cycles never alerts twice; the (user, dedupe_key) unique index is a second guard.
 */
export async function processMatchAlerts(env: Env, now = new Date(), maxOpps = 25) {
  const cursor = await getConfig<string>(env, 'alerts.cursor', '1970-01-01T00:00:00.000Z');
  const opps = (
    await env.DB.prepare(
      `SELECT * FROM opportunities WHERE first_seen_at > ? AND moderation = 'approved' AND is_demo = 0 ORDER BY first_seen_at LIMIT ?`,
    )
      .bind(cursor, maxOpps)
      .all<any>()
  ).results;
  if (!opps.length) return { opportunities: 0, notifications: 0 };
  const profiles = (
    await env.DB.prepare(
      `SELECT p.id, p.user_id, p.type, p.data, u.timezone,
              np.email_enabled, np.in_app_enabled, np.frequency, np.categories, np.min_score, np.quiet_start, np.quiet_end
       FROM profiles p JOIN users u ON u.id = p.user_id
       LEFT JOIN notification_prefs np ON np.user_id = p.user_id
       WHERE p.deleted_at IS NULL AND u.status = 'active' AND p.completeness >= 20
       LIMIT 2000`,
    ).all<any>()
  ).results;
  const weights = await getWeights(env);
  const planCache = new Map<string, Awaited<ReturnType<typeof userPlan>>>();
  let created = 0;
  const ts = nowIso(now);
  for (const o of opps) {
    const mo = toMatchOpportunity(o);
    const stmts: D1PreparedStatement[] = [];
    if (o.status === 'open' && !(o.deadline_at && Date.parse(o.deadline_at) < now.getTime())) {
      for (const p of profiles) {
        if (!profileAccepts(p.type as ProfileType, o.category)) continue;
        const prefs: Prefs = p.frequency ? p : DEFAULT_PREFS;
        const cats = parseJson<string[]>(prefs.categories, []);
        if (prefs.frequency === 'off' || !cats.includes('new_match')) continue;
        let plan = planCache.get(p.user_id);
        if (!plan) {
          plan = await userPlan(env, p.user_id);
          planCache.set(p.user_id, plan);
        }
        if (p.type === 'business' && !plan.entitlements.business_matching) continue;
        const m = matchProfile(toProfileRecord(p), mo, weights, now);
        if (m.eligibility !== 'eligible' && m.eligibility !== 'potential') continue;
        if ((m.score ?? 0) < prefs.min_score) continue;
        const notifId = newId('ntf');
        stmts.push(
          env.DB.prepare(
            `INSERT INTO matches (id, user_id, profile_id, opportunity_id, score, eligibility, confidence, explanation, computed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(profile_id, opportunity_id) DO UPDATE SET score = excluded.score, eligibility = excluded.eligibility,
               confidence = excluded.confidence, explanation = excluded.explanation, computed_at = excluded.computed_at`,
          ).bind(
            newId('mch'),
            p.user_id,
            p.id,
            o.id,
            m.score,
            m.eligibility,
            m.confidence,
            JSON.stringify(m),
            ts,
          ),
          env.DB.prepare(
            `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, opportunity_id, dedupe_key, created_at)
             VALUES (?, ?, 'new_match', ?, ?, ?, ?, ?, ?)`,
          ).bind(
            notifId,
            p.user_id,
            `${m.score}% match: ${o.title.slice(0, 120)}`,
            `${CATEGORY_LABELS[o.category as keyof typeof CATEGORY_LABELS] ?? 'Opportunity'} · ${o.organization}. ${m.reasons[0]?.detail ?? ''}`.slice(
              0,
              400,
            ),
            `/app/opportunities/${o.id}`,
            o.id,
            `match:${o.id}`,
            ts,
          ),
        );
        const instantAllowed = plan.entitlements.alert_frequencies.includes('instant');
        if (prefs.email_enabled && prefs.frequency === 'instant' && instantAllowed) {
          stmts.push(
            env.DB.prepare(
              `INSERT OR IGNORE INTO notification_deliveries (id, notification_id, user_id, channel, status, send_after, created_at, updated_at)
               SELECT ?, id, user_id, 'email', 'pending', ?, ?, ? FROM notifications WHERE user_id = ? AND dedupe_key = ? AND id = ?`,
            ).bind(newId('dlv'), ts, ts, ts, p.user_id, `match:${o.id}`, notifId),
          );
        }
        created++;
      }
    }
    for (let i = 0; i < stmts.length; i += 60) await env.DB.batch(stmts.slice(i, i + 60));
  }
  await setConfig(env, 'alerts.cursor', opps[opps.length - 1].first_seen_at, null);
  return { opportunities: opps.length, notifications: created };
}

/** Deadline reminders for saved opportunities and tracked applications; follow-up reminders. Runs at most daily. */
export async function processReminders(env: Env, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  if ((await getConfig(env, 'alerts.reminders_day', '')) === day) return { skipped: true };
  const ts = nowIso(now);
  const soon = addMinutes(now, 3 * 24 * 60).toISOString();
  const tomorrow = addMinutes(now, 24 * 60).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, opportunity_id, dedupe_key, created_at)
       SELECT 'ntf_' || lower(hex(randomblob(10))), uo.user_id, 'deadline', 'Deadline approaching: ' || substr(o.title, 1, 120),
              'Closes ' || substr(o.deadline_at, 1, 10) || ' — ' || o.organization, '/app/opportunities/' || o.id, o.id, 'deadline:' || o.id || ':3d', ?
       FROM user_opportunity uo JOIN opportunities o ON o.id = uo.opportunity_id
       LEFT JOIN notification_prefs np ON np.user_id = uo.user_id
       WHERE uo.state = 'saved' AND o.status = 'open' AND o.deadline_at > ? AND o.deadline_at <= ?
         AND (np.categories IS NULL OR np.categories LIKE '%deadline%')`,
    ).bind(ts, ts, soon),
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, opportunity_id, dedupe_key, created_at)
       SELECT 'ntf_' || lower(hex(randomblob(10))), a.user_id, 'follow_up', 'Follow up: ' || substr(a.title, 1, 120),
              'You planned to follow up on ' || substr(a.follow_up_at, 1, 10) || '.', '/app/tracker', a.opportunity_id,
              'followup:' || a.id || ':' || substr(a.follow_up_at, 1, 10), ?
       FROM applications a LEFT JOIN notification_prefs np ON np.user_id = a.user_id
       WHERE a.deleted_at IS NULL AND a.follow_up_at IS NOT NULL AND a.follow_up_at <= ? AND a.follow_up_at >= ?
         AND a.status NOT IN ('awarded','rejected','withdrawn','closed')
         AND (np.categories IS NULL OR np.categories LIKE '%follow_up%')`,
    ).bind(ts, tomorrow, addMinutes(now, -24 * 60).toISOString()),
    env.DB.prepare(
      `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, opportunity_id, dedupe_key, created_at)
       SELECT 'ntf_' || lower(hex(randomblob(10))), a.user_id, 'deadline', 'Deadline approaching: ' || substr(a.title, 1, 120),
              'Your tracked ' || a.kind || ' is due ' || substr(a.deadline_at, 1, 10) || '.', '/app/tracker', a.opportunity_id,
              'appdeadline:' || a.id || ':' || substr(a.deadline_at, 1, 10), ?
       FROM applications a WHERE a.deleted_at IS NULL AND a.deadline_at > ? AND a.deadline_at <= ?
         AND a.status IN ('interested','preparing')`,
    ).bind(ts, ts, soon),
  ]);
  await setConfig(env, 'alerts.reminders_day', day, null);
  return { skipped: false };
}

/** Daily (every day) and weekly (Mondays) digests of unread match alerts, at 07:00 Kampala time. */
export async function processDigests(env: Env, now = new Date()) {
  if (localHour(now, 'Africa/Kampala') < 7) return { skipped: true };
  const day = now.toISOString().slice(0, 10);
  if ((await getConfig(env, 'alerts.digest_day', '')) === day) return { skipped: true };
  const isMonday = new Date(now.getTime() + 3 * 3600_000).getUTCDay() === 1;
  const freqs = isMonday ? ['daily', 'weekly'] : ['daily'];
  const ts = nowIso(now);
  const users = (
    await env.DB.prepare(
      `SELECT np.user_id, np.frequency, COUNT(n.id) AS cnt FROM notification_prefs np
       JOIN notifications n ON n.user_id = np.user_id AND n.kind = 'new_match' AND n.read_at IS NULL
         AND n.created_at > ?
       WHERE np.email_enabled = 1 AND np.frequency IN (${freqs.map(() => '?').join(',')})
       GROUP BY np.user_id, np.frequency LIMIT 500`,
    )
      .bind(addMinutes(now, -7 * 24 * 60).toISOString(), ...freqs)
      .all<any>()
  ).results;
  for (const u of users) {
    const key = `digest:${u.frequency}:${day}`;
    const id = newId('ntf');
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, dedupe_key, created_at) VALUES (?, ?, 'digest', ?, ?, '/app/notifications', ?, ?)`,
      ).bind(
        id,
        u.user_id,
        `Your ${u.frequency} Opportunity Radar digest`,
        `${u.cnt} new match${u.cnt === 1 ? '' : 'es'} waiting for you.`,
        key,
        ts,
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO notification_deliveries (id, notification_id, user_id, channel, status, send_after, created_at, updated_at)
         SELECT ?, id, user_id, 'email', 'pending', ?, ?, ? FROM notifications WHERE id = ?`,
      ).bind(newId('dlv'), ts, ts, ts, id),
    ]);
  }
  await setConfig(env, 'alerts.digest_day', day, null);
  return { skipped: false, users: users.length };
}

/** Email delivery with quiet hours, retries and recorded provider errors. Notifications are never lost. */
export async function sendDeliveries(env: Env, now = new Date(), max = 20) {
  const provider = emailProvider(env);
  const ts = nowIso(now);
  const rows = (
    await env.DB.prepare(
      `SELECT d.id, d.attempts, n.title, n.body, n.link, n.kind, n.opportunity_id, u.email, u.timezone, np.quiet_start, np.quiet_end, np.email_enabled
       FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id JOIN users u ON u.id = d.user_id
       LEFT JOIN notification_prefs np ON np.user_id = d.user_id
       WHERE d.status = 'pending' AND d.send_after <= ? LIMIT ?`,
    )
      .bind(ts, max)
      .all<any>()
  ).results;
  let sent = 0;
  for (const r of rows) {
    if (r.email_enabled === 0) {
      await env.DB.prepare(
        "UPDATE notification_deliveries SET status = 'skipped', error = 'email disabled by user', updated_at = ? WHERE id = ?",
      )
        .bind(ts, r.id)
        .run();
      continue;
    }
    const hour = localHour(now, r.timezone || 'Africa/Kampala');
    if (inQuietHours(hour, r.quiet_start, r.quiet_end)) {
      const wait = ((r.quiet_end - hour + 24) % 24 || 1) * 60;
      await env.DB.prepare('UPDATE notification_deliveries SET send_after = ?, updated_at = ? WHERE id = ?')
        .bind(addMinutes(now, wait).toISOString(), ts, r.id)
        .run();
      continue;
    }
    let officialLine = '';
    if (r.opportunity_id) {
      const o = await env.DB.prepare(
        'SELECT application_url, official_url, source_url, verification FROM opportunities WHERE id = ?',
      )
        .bind(r.opportunity_id)
        .first<any>();
      if (o)
        officialLine = `\nOfficial link: ${o.official_url || o.application_url || o.source_url}\nVerification: ${o.verification.replace('_', ' ')}`;
    }
    const base = env.APP_URL ?? '';
    const res = await provider.send({
      to: r.email,
      subject: r.title,
      text: `${r.body}\n${officialLine}\n\nOpen in Opportunity Radar: ${base}${r.link ?? '/app'}\n\nManage alerts: ${base}/app/settings`,
    });
    if (res.status === 'sent') sent++;
    const retry = res.status === 'failed' && r.attempts < 2;
    await env.DB.prepare(
      `UPDATE notification_deliveries SET status = ?, provider = ?, provider_message_id = ?, error = ?, attempts = attempts + 1, send_after = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        retry ? 'pending' : res.status,
        res.provider,
        res.providerMessageId ?? null,
        res.error ?? null,
        addMinutes(now, 15 * (r.attempts + 1)).toISOString(),
        ts,
        r.id,
      )
      .run();
    if (res.status === 'failed') log('warn', 'email.failed', { provider: res.provider, error: res.error });
  }
  return { processed: rows.length, sent };
}
