export function createSingleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return (): Promise<T> => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = run().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
