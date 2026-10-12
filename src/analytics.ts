export function track(event: string, extra: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: unknown[] };
  (w.dataLayer = w.dataLayer || []).push({ event, game: "kaisin", ...extra });
}
