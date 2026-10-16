export function ArticleDates({
  createdAt,
  updatedAt,
}: {
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
        Created{" "}
        <time dateTime={createdAt.toISOString()}>
          {createdAt.toLocaleDateString("en-US", options)}
        </time>
      </span>
      <span>
        Last updated{" "}
        <time dateTime={updatedAt.toISOString()}>
          {updatedAt.toLocaleDateString("en-US", options)}
        </time>
      </span>
    </div>
  );
}
