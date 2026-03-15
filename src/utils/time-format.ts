export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatClockTime(ms: number | null): string {
  if (ms === null) {
    return '--:--:--';
  }

  return new Date(ms).toLocaleTimeString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
}

export function formatPipClockHead(ms: number | null): string {
  if (ms === null) {
    return '--:--:--';
  }

  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatMillisecondFraction(ms: number | null, digits: number): string {
  const safeDigits = clamp(Math.trunc(digits), 1, 3);
  if (ms === null) {
    return '-'.repeat(safeDigits);
  }

  const raw = Math.abs(Math.trunc(ms)) % 1000;
  const divisor = 10 ** (3 - safeDigits);
  const value = Math.floor(raw / divisor);
  return String(value).padStart(safeDigits, '0');
}

export function formatSignedMs(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  const sign = ms >= 0 ? '+' : '-';
  return `${sign}${Math.abs(Math.trunc(ms))} 毫秒`;
}

export function formatMillis(ms: number | null, digits: number): string {
  return `${formatMillisecondFraction(ms, digits)} 毫秒`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  return `${Math.trunc(ms)} 毫秒`;
}

export function formatTimestampDetailedParts(ms: number | null, digits: number): { head: string; tail: string | null } {
  if (ms === null) {
    return { head: '--', tail: null };
  }

  const date = new Date(ms);
  return {
    head: date.toLocaleString('zh-CN', {
      hour12: false,
      timeZone: 'Asia/Shanghai'
    }),
    tail: formatMillisecondFraction(ms, digits)
  };
}

export function formatCountdown(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${sec}s`;
}
