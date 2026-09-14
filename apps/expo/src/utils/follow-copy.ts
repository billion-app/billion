/**
 * Save is the existing device-local saved set. Storage keys and analytics
 * names stay as they are.
 */

export function followNoun(type: string | undefined): string {
  switch (type) {
    case "bill":
      return "bill";
    case "court_case":
    case "court":
      return "case";
    case "government_content":
    case "exec":
      return "order";
    default:
      return "record";
  }
}

export function followAccessibilityLabel(
  type: string | undefined,
  saved: boolean,
  title?: string,
): string {
  const noun = followNoun(type);
  if (title) {
    return saved ? `Remove ${title} from saved` : `Save ${title} for later`;
  }
  return saved
    ? `Remove this ${noun} from saved`
    : `Save this ${noun} for later`;
}
