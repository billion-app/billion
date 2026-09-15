/** Ballot tools are available in development builds pending production launch. */
export function electionsAreLive(): boolean {
  return __DEV__;
}
