export function progressLabel(currentIndex: number, total: number): string {
  return `${Math.min(currentIndex + 1, total)}/${total}`;
}
