/** Per-process admission control; no retained ballot data or background warming. */
export class CivicReadUnavailableError extends Error {
  constructor() {
    super("Ballot information is temporarily unavailable. Please try again.");
    this.name = "CivicReadUnavailableError";
  }
}

export function createCivicReadGuard({
  timeoutMs = 10_000,
  maxActive = 32,
}: { timeoutMs?: number; maxActive?: number } = {}) {
  const active = new Map<string, Promise<unknown>>();

  return function read<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = active.get(key);
    if (existing) return existing as Promise<T>;
    if (active.size >= maxActive) {
      return Promise.reject(new CivicReadUnavailableError());
    }

    let timer: ReturnType<typeof setTimeout>;
    const operation = Promise.resolve().then(work);
    const response = Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new CivicReadUnavailableError()),
          timeoutMs,
        );
      }),
    ]);
    active.set(key, response);
    // Keep admission occupied until underlying work settles. A response timeout
    // cannot cancel DB/AI calls; freeing the slot would allow unbounded work.
    void operation.then(
      () => {
        clearTimeout(timer);
        active.delete(key);
      },
      () => {
        clearTimeout(timer);
        active.delete(key);
      },
    );
    return response;
  };
}
