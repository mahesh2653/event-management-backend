import { DateTime } from 'luxon';

/**
 * Converts a local date + time + IANA timezone (as entered by the event creator)
 * into a UTC JS Date for storage. This is the ONLY place "publishAt" gets created.
 *
 * @param date  "YYYY-MM-DD"
 * @param time  "HH:mm" (24h)
 * @param zone  IANA timezone, e.g. "Asia/Kolkata"
 */
export function localToUtc(date: string, time: string, zone: string): Date {
  const dt = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm', { zone });
  if (!dt.isValid) {
    throw new Error(`Invalid date/time/timezone combination: ${dt.invalidExplanation}`);
  }
  return dt.toUTC().toJSDate();
}

/**
 * Converts a stored UTC Date back into a user's local timezone for API responses.
 * Falls back to UTC if an invalid/missing timezone is supplied.
 */
export function utcToLocal(utcDate: Date, zone?: string) {
  const targetZone = isValidTimezone(zone) ? (zone as string) : 'UTC';
  const dt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(targetZone);
  return {
    date: dt.toFormat('yyyy-MM-dd'),
    time: dt.toFormat('HH:mm'),
    iso: dt.toISO(),
    timezone: targetZone,
    utcOffset: dt.toFormat('ZZ'),
  };
}

export function isValidTimezone(zone?: string): boolean {
  if (!zone) return false;
  return DateTime.local().setZone(zone).isValid;
}

/** Server-side, timezone-independent published check. Always compare in UTC. */
export function isPublished(publishAtUtc: Date, now: Date = new Date()): boolean {
  return publishAtUtc.getTime() <= now.getTime();
}
