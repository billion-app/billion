import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

/** Connect only to an address already validated, retaining host/TLS identity. */
export function requestPublicSource(
  url: string,
  addresses: LookupAddress[],
  signal: AbortSignal,
): Promise<Response> {
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, addresses);
    else {
      const address =
        addresses.find((a) => !options.family || a.family === options.family) ??
        addresses[0]!;
      callback(null, address.address, address.family);
    }
  };
  return new Promise((resolve, reject) => {
    const request = (
      new URL(url).protocol === "https:" ? httpsRequest : httpRequest
    )(
      url,
      {
        lookup: pinnedLookup,
        signal,
        headers: {
          "User-Agent": "BillionResearch/1.0",
          Accept: "text/html,application/pdf,text/plain",
        },
      },
      (incoming) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined)
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const status = incoming.statusCode ?? 500;
        const stream = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
        resolve(
          new Response([204, 205, 304].includes(status) ? null : stream, {
            status,
            headers,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}
