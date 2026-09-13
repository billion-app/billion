interface TrpcConsoleSink {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createTrpcConsole(sink: TrpcConsoleSink): TrpcConsoleSink {
  return {
    log: (...args) => sink.log(...args),
    // tRPC errors are delivered to TanStack Query for screens to handle. React
    // Native treats console.error as an uncaught app error and opens LogBox,
    // which makes an ordinary API failure look like a native crash in dev.
    error: (...args) => sink.log(...args),
  };
}
