export function ArticleDates({
  introducedDate,
  createdAt,
  updatedAt,
}: {
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
        {introducedDate ? "Introduced" : "Added to Billion"}{" "}
        <time dateTime={primaryDate.toISOString()}>
          {primaryDate.toLocaleDateString("en-US", options)}
        </time>
      </span>
      <span>
        Updated on Billion{" "}
        <time dateTime={updatedAt.toISOString()}>
          {updatedAt.toLocaleDateString("en-US", options)}
        </time>
      </span>
    </div>
  );
}
