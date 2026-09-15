export async function fetchCaElectionPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw new Error(`CA election source HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        throw new Error("CA source exceeds 1 MB");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}
