export function delay(ms = 280) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
