/**
 * Follow is the existing device-local saved set, spoken as a watch rather
 * than a bookmark. Storage keys and analytics names stay as they are.
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
  following: boolean,
  title?: string,
): string {
  const noun = followNoun(type);
  if (title) {
    return following ? `Stop following ${title}` : `Follow ${title}`;
  }
  return following ? `Stop following this ${noun}` : `Follow this ${noun}`;
}
