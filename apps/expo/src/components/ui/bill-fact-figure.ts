import { getBillDateValue } from "@acme/validators";

export type { MetricFigure, ScaleFigure } from "@acme/validators";
export {
  getBillFactDisplay,
  getBillFactFigure,
  getBillScaleFigure,
} from "@acme/validators";

/** Units identify time and energy facts without inventing a policy category. */
export function getBillFactSymbol(
  value: string,
  label: string,
): "calendar" | "clock" | "layers" | "zap" | null {
  const supplied = `${label} ${value}`.replaceAll("**", "");
  if (
    /\b(?:days?|months?|hours?|días?|mes(?:es)?|horas?)\b|天|个月|小时/iu.test(
      supplied,
    )
  )
    return "clock";
  if (
    getBillDateValue(value) !== null ||
    /\b(?:date|deadline|fecha|plazo)\b|日期|截止/iu.test(supplied) ||
    (/^\d{4}$/u.test(value.trim()) && /\byear\b|\baño\b|年/iu.test(label))
  )
    return "calendar";
  if (/\b(?:MW|GW|megawatts?|gigawatts?)\b|兆瓦|吉瓦/iu.test(value)) {
    return /\b(?:per.project|project size|por proyecto)\b|项目/iu.test(label)
      ? "layers"
      : "zap";
  }
  return null;
}
