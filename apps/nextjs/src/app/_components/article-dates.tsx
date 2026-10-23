import type { RouterOutputs } from "@acme/api";

import type { ReaderLanguage } from "../_lib/reader-language";
import { readerText } from "../_lib/reader-language";

export function ArticleDates({
  language = "en",
  sourceDate,
  introducedDate,
  createdAt,
  updatedAt,
}: {
  language?: ReaderLanguage;
  sourceDate?: RouterOutputs["content"]["getById"]["sourceDate"];
  introducedDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const primaryDate = sourceDate?.date ?? introducedDate ?? createdAt;
  const sourceLabels = {
    introduced: "Introduced",
    published: "Published",
    whiteHousePublished: "Posted by White House",
    federalRegisterPublished: "Published in Federal Register",
    opinionReleased: "Opinion released",
    latestDocketEntry: "Latest docket entry",
    courtRecordDated: "Court record dated",
  };
  const label = sourceDate
    ? sourceLabels[sourceDate.kind]
    : introducedDate
      ? "Introduced"
      : "Added to Billion";
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  return (
    <div
      className="text-muted-foreground mb-5 flex flex-wrap gap-x-5 gap-y-1 font-sans text-[12px]"
      data-testid="article-dates"
    >
      <span>
        {readerText(language, label)}{" "}
        <time dateTime={primaryDate.toISOString()}>
          {primaryDate.toLocaleDateString(
            language === "zh" ? "zh-CN" : `${language}-US`,
            { ...options, timeZone: sourceDate?.timeZone ?? "UTC" },
          )}
        </time>
      </span>
      <span>
        {readerText(language, "Updated on Billion")}{" "}
        <time dateTime={updatedAt.toISOString()}>
          {updatedAt.toLocaleDateString(
            language === "zh" ? "zh-CN" : `${language}-US`,
            options,
          )}
        </time>
      </span>
    </div>
  );
}
