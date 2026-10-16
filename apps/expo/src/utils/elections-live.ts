/** All production entry points require the server's reviewed launch state.
 * Development access exists only for controlled verification.
 */
export function electionsAreLive(availability?: {
  lookupEnabled: boolean;
}): boolean {
  return __DEV__ || availability?.lookupEnabled === true;
}
