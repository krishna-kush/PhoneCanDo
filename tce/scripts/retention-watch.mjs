// Retention watch for the limit check (check-limits.mjs). Pure, zero deps.
//
// The retention cron is switched off for now (RETENTION_ENABLED "false" in
// tce/hosts/cloudflare/wrangler.jsonc), but docs/telemetry.md and the privacy
// page still promise deletion after RETENTION_DAYS. So while it is off, warn
// LEAD_DAYS before the oldest kept row of a table reaches its promised age,
// and say CRITICAL once it has: from then on the published page is inaccurate.

/** Days of warning before the promised age is reached. */
export const LEAD_DAYS = 14;

/** Tables the privacy page promises to expire, in report order. */
export const RETAINED_TABLES = ['events', 'errors', 'reports'];

/** Where the switch lives, for the warning texts. */
const SWITCH = 'RETENTION_ENABLED in tce/hosts/cloudflare/wrangler.jsonc';

/**
 * Warnings for a health `retention` block: none while retention is on, none
 * when the block is missing (an older Worker), otherwise one per table whose
 * oldest row is within LEAD_DAYS of (warn) or past (critical) its promised age.
 * Each is { level: 'warn' | 'critical', text }.
 */
export function retentionFindings(retention) {
  if (!retention || retention.enabled !== false) return [];
  const out = [];
  for (const table of RETAINED_TABLES) {
    const age = retention.oldestDays?.[table];
    const days = retention.days?.[table];
    if (!Number.isInteger(age) || !Number.isInteger(days)) continue;
    if (age >= days) {
      out.push({
        level: 'critical',
        text:
          `CRITICAL: retention is off and the oldest ${table} row is ${age} days old, but the privacy page promises ` +
          `deletion after ${days} days, so it is now inaccurate for ${table}. Set ${SWITCH} to "true" and push ` +
          '(or change docs/telemetry.md and the privacy page).',
      });
    } else if (age >= days - LEAD_DAYS) {
      out.push({
        level: 'warn',
        text:
          `retention is off; the privacy page promises deletion of ${table} after ${days} days and the oldest ` +
          `${table} row is ${age} days old (${days - age} left). Turn on ${SWITCH} before day ${days}.`,
      });
    }
  }
  return out;
}

/** One status line for the printed report. */
export function renderRetention(retention) {
  if (!retention) return 'Retention: unknown (this Worker does not report it yet)';
  const ages = RETAINED_TABLES.map((t) => {
    const age = retention.oldestDays?.[t];
    return `${t} ${Number.isInteger(age) ? `${age} d` : 'none'} of ${retention.days?.[t] ?? '?'} d`;
  }).join(', ');
  return `Retention: ${retention.enabled ? 'ON (deleting expired rows)' : 'OFF (keeping everything)'} · oldest kept: ${ages}`;
}

/** True when any finding is critical (check-limits exits 1 on it under --strict). */
export function hasCritical(findings) {
  return findings.some((f) => f.level === 'critical');
}
