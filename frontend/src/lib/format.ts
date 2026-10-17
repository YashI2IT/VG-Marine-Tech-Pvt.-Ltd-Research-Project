export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatNumber(n: number, digits = 1) {
  return n.toFixed(digits);
}
