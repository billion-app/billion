import {
  contentType,
  digest,
  DigestHair,
  DigestRadii,
  DigestSpace,
  hair,
  lensColors,
  outcomeColors,
  planes,
} from "@acme/ui/digest-tokens";

/**
 * The Digest tokens as one `:root` block of CSS custom properties.
 *
 * The web reader cannot import `~/styles` from Expo, and copying the values
 * into CSS would give the palette a second source of truth. So the reader
 * layout emits this block, and Tailwind's `@theme inline` in `globals.css`
 * points its colour names at these properties. Change a colour in
 * `@acme/ui/digest-tokens` and both clients follow it.
 */
export function digestCssVariables(): string {
  const groups: Record<string, Record<string, string | number>> = {
    planes,
    // Named hairlines share the `hair` prefix with the numbered tiers.
    hair: { ...hair, ...DigestHair },
    digest,
    radius: DigestRadii,
    space: DigestSpace,
    outcome: outcomeColors,
    lens: lensColors,
    type: Object.fromEntries(
      Object.entries(contentType).map(([key, value]) => [key, value.color]),
    ),
  };

  const declarations = Object.entries(groups).flatMap(([group, tokens]) =>
    Object.entries(tokens).map(
      ([key, value]) =>
        `--digest-${group}-${kebab(key)}:${typeof value === "number" ? `${value}px` : value};`,
    ),
  );
  return `:root{${declarations.join("")}}`;
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
