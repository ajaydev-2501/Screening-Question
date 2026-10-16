const TIMESTAMP = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Timestamps are rendered in UTC with the zone named, so two readers in two offices agree. */
export function formatTimestamp(value: Date | null): string {
  return value ? `${TIMESTAMP.format(value)} UTC` : "\u2014";
}
