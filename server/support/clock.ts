// Clock diinjeksikan (AR-05): jatuh tempo, "hari ini" menurut WIB, dan jendela 7 hari dapat diuji.
export interface Clock {
  now(): Date;
  /** Tanggal bisnis hari ini (YYYY-MM-DD) menurut zona waktu aplikasi. */
  today(): string;
}

export function dateInZone(date: Date, timeZone: string): string {
  // Lokal en-CA menghasilkan YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function systemClock(timeZone = 'Asia/Jakarta'): Clock {
  return { now: () => new Date(), today: () => dateInZone(new Date(), timeZone) };
}

export function fixedClock(iso: string, timeZone = 'Asia/Jakarta'): Clock {
  const d = new Date(iso);
  return { now: () => d, today: () => dateInZone(d, timeZone) };
}
