import type { ReaderLanguage } from "../_lib/reader-language";
import { readerText } from "../_lib/reader-language";

export function ArticleDates({
  language = "en",
  introducedDate,
  createdAt,
  updatedAt,
}: {
  language?: ReaderLanguage;
  introducedDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const primaryDate = introducedDate ?? createdAt;
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
        {readerText(
          language,
          introducedDate ? "Introduced" : "Added to Billion",
        )}{" "}
        <time dateTime={primaryDate.toISOString()}>
          {primaryDate.toLocaleDateString(
            language === "zh" ? "zh-CN" : `${language}-US`,
            options,
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
