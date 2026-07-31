import { timingSafeEqual } from "node:crypto";

import { env } from "~/env";

export function isNotificationOperatorAuthorized(request: Request): boolean {
  const configured = env.BILLION_NOTIFICATIONS_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!configured || !supplied) return false;

  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    configuredBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(configuredBuffer, suppliedBuffer)
  );
}

export function isNotificationServiceConfigured(): boolean {
  return Boolean(env.BILLION_NOTIFICATIONS_SECRET);
}
