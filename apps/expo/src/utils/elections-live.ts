/** Legacy ballot entry routes remain development-only; the Elections tab has its own preview entry. */
export function electionsAreLive(): boolean {
  return __DEV__;
}
