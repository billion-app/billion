import type { ReaderLanguage } from "../_lib/reader-language";
import { readerText } from "../_lib/reader-language";

export function ArticleDates({
  language = "en",
  createdAt,
  updatedAt,
}: {
  language?: ReaderLanguage;
  createdAt: Date;
  updatedAt: Date;
}) {
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
        {readerText(language, "Created")}{" "}
        <time dateTime={createdAt.toISOString()}>
          {createdAt.toLocaleDateString(
            language === "zh" ? "zh-CN" : `${language}-US`,
            options,
          )}
        </time>
      </span>
      <span>
        {readerText(language, "Last updated")}{" "}
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
