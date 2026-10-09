import type { WorkingHours } from "./settings";

/** Returns weekday (0=Sun) and minutes-since-midnight of `date` in a given IANA timezone. */
export function localClock(date: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { day: days.indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function isWorkingMinute(date: Date, timeZone: string, wh: WorkingHours): boolean {
  const { day, minutes } = localClock(date, timeZone);
  return wh.days.includes(day) && minutes >= toMinutes(wh.start) && minutes < toMinutes(wh.end);
}

/**
 * Adds `slaMinutes` of WORKING time to `from`.
 * A lead received Thursday 16:55 with a 15-minute SLA is due Sunday 09:10.
 * Walks in 1-minute steps inside working hours and 15-minute jumps outside.
 */
export function computeSlaDue(from: Date, slaMinutes: number, timeZone: string, wh: WorkingHours): Date {
  if (wh.days.length === 0) return new Date(from.getTime() + slaMinutes * 60_000);
  let remaining = slaMinutes;
  let cursor = new Date(Math.floor(from.getTime() / 60_000) * 60_000);
  let guard = 0;
  while (remaining > 0 && guard++ < 100_000) {
    if (isWorkingMinute(cursor, timeZone, wh)) {
      cursor = new Date(cursor.getTime() + 60_000);
      remaining--;
    } else {
      // jump forward but never skip past a working-hours boundary by more than 1 step
      const next = new Date(cursor.getTime() + 15 * 60_000);
      cursor = isWorkingMinute(next, timeZone, wh) ? stepUntilWorking(cursor, timeZone, wh) : next;
    }
  }
  return cursor;
}

function stepUntilWorking(from: Date, timeZone: string, wh: WorkingHours): Date {
  let c = from;
  for (let i = 0; i < 16 && !isWorkingMinute(c, timeZone, wh); i++) c = new Date(c.getTime() + 60_000);
  return c;
}
