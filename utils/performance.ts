/**
 * Creates a debounced callback.
 */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number) {
  let timeout: number | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => fn(...args), waitMs);
  };
}

/**
 * Adds an event listener with passive mode when appropriate.
 */
export function addPassiveListener(
  element: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject
) {
  element.addEventListener(event, handler, { passive: true });
}
