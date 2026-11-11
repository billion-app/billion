/** Equal columns in physical pixels, distributing the rounding remainder so
 * columns + gutters fill the measured width exactly. */
export function readerColumns(
  width: number,
  count: 1 | 2,
  gap: number,
  pixelRatio: number,
) {
  const total = Math.max(0, Math.round(width * pixelRatio));
  const gutter =
    count === 2 ? Math.min(total, Math.round(gap * pixelRatio)) : 0;
  const available = total - gutter;
  const first = Math.floor(available / count);
  return {
    widths:
      count === 1
        ? [total / pixelRatio]
        : [first / pixelRatio, (available - first) / pixelRatio],
    gap: gutter / pixelRatio,
  };
}

/** A chart mark needs a finite value in a nonzero, explicit domain. */
export function readerScalePosition(
  value: number,
  min: number,
  max: number,
  width: number,
) {
  if (
    ![value, min, max, width].every(Number.isFinite) ||
    max <= min ||
    width <= 0 ||
    value < min ||
    value > max
  )
    return null;
  return ((value - min) / (max - min)) * width;
}
