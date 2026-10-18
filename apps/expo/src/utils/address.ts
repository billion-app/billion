/**
 * Voter-address formatting for the native location path.
 *
 * Kept out of `AddressAutocomplete` so the platform differences are unit
 * testable without mounting React Native: iOS fills the discrete fields
 * (Apple's CLGeocoder), while Android's system geocoder usually returns only
 * one composed address line in `formattedAddress` and leaves `city` null.
 * Building from the discrete fields alone can therefore discard a useful
 * suggestion, which is why the composed line wins when the OS provides it.
 */

/**
 * Only the fields this module reads, all optional, so tests can pass plain
 * objects. `Location.LocationGeocodedAddress` satisfies it structurally.
 */
export interface GeocodedPlacemark {
  streetNumber?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  /** Composed single-line address. Android populates it; iOS leaves it unset. */
  formattedAddress?: string | null;
}

function clean(value: string | null | undefined): string | undefined {
  // Whitespace-only input collapses to undefined too; `??` would keep the
  // spaces and reintroduce the empty segments this helper exists to drop.
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

/**
 * `"123 Oak St, Sacramento, CA 95814"` from an OS reverse-geocode placemark.
 *
 * Returns a suggested address, not a validated registered voting address.
 * Composed platform results may be incomplete, so the voter must review them.
 * Returns `null` if neither a composed line nor street/city fields are usable;
 * the caller then asks for manual entry.
 */
export function formatPlacemark(
  placemark: GeocodedPlacemark | null | undefined,
): string | null {
  if (!placemark) return null;

  // Android's geocoder frequently leaves the discrete street/city fields empty
  // and only returns this composed line, so prefer it whenever it is present.
  const composed = clean(placemark.formattedAddress);
  if (composed) return composed;

  const street = [clean(placemark.streetNumber), clean(placemark.street)]
    .filter(Boolean)
    .join(" ");
  const city =
    clean(placemark.city) ??
    clean(placemark.district) ??
    clean(placemark.subregion);

  if (!street || !city) return null;

  // Region and postal code are one segment ("CA 95814"), not two, so the
  // address reads the way a US address is written.
  const regionPostal = [clean(placemark.region), clean(placemark.postalCode)]
    .filter(Boolean)
    .join(" ");

  return [street, city, regionPostal || undefined].filter(Boolean).join(", ");
}
