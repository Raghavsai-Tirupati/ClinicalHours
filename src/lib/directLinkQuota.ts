const QUOTA_KEY_DATE = "ch_direct_link_last_date";
const QUOTA_KEY_COUNT = "ch_direct_link_count";
const DAILY_FREE_LIMIT = 1;

function getTodayKey(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function readQuota(): { date: string | null; count: number } {
  try {
    const date = localStorage.getItem(QUOTA_KEY_DATE);
    const rawCount = localStorage.getItem(QUOTA_KEY_COUNT);
    const count = rawCount ? Number(rawCount) || 0 : 0;
    return { date, count };
  } catch {
    return { date: null, count: 0 };
  }
}

function writeQuota(date: string, count: number): void {
  try {
    localStorage.setItem(QUOTA_KEY_DATE, date);
    localStorage.setItem(QUOTA_KEY_COUNT, String(count));
  } catch {
    // ignore quota write errors
  }
}

/** Can this user/device use a direct application link today? */
export function canUseDirectLinkToday(isPremium: boolean): boolean {
  if (isPremium) return true;

  const today = getTodayKey();
  const { date, count } = readQuota();

  if (date !== today) {
    // New day → reset
    writeQuota(today, 0);
    return true;
  }

  return count < DAILY_FREE_LIMIT;
}

/** Record that a direct application link was used. */
export function recordDirectLinkUse(isPremium: boolean): void {
  if (isPremium) return;

  const today = getTodayKey();
  const { date, count } = readQuota();

  const newDate = date === today ? date : today;
  const newCount = date === today ? count + 1 : 1;

  writeQuota(newDate, newCount);
}

