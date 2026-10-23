export type ReaderLanguage = "en" | "es" | "zh";
export function readerLanguage(value: unknown): ReaderLanguage {
  return value === "zh" || value === "es" ? value : "en";
}
const copy: Record<string, { es: string; zh: string }> = {
  "Not found": { es: "No encontrado", zh: "未找到" },
  BILL: { es: "LEY", zh: "法案" },
  ORDER: { es: "ORDEN", zh: "行政令" },
  EXECUTIVE: { es: "EJECUTIVO", zh: "行政文件" },
  NOTICE: { es: "AVISO", zh: "通知" },
  MEMORANDUM: { es: "MEMORANDO", zh: "备忘录" },
  PROCLAMATION: { es: "PROCLAMACIÓN", zh: "公告" },
  "PRESIDENTIAL DOCUMENT": { es: "DOCUMENTO PRESIDENCIAL", zh: "总统文件" },
  "NEWS ARTICLE": { es: "NOTICIA", zh: "新闻报道" },
  "FACT SHEET": { es: "HOJA INFORMATIVA", zh: "情况说明" },
  "PRESS RELEASE": { es: "COMUNICADO DE PRENSA", zh: "新闻稿" },
  "BRIEFING STATEMENT": { es: "DECLARACIÓN INFORMATIVA", zh: "简报声明" },
  "PRESIDENTIAL ACTION": { es: "ACCIÓN PRESIDENCIAL", zh: "总统行动" },
  CASE: { es: "CASO", zh: "案件" },
  NEWS: { es: "NOTICIAS", zh: "新闻" },
  Legislation: { es: "Legislación", zh: "立法" },
  "Executive action": { es: "Acción ejecutiva", zh: "行政行动" },
  "Court case": { es: "Caso judicial", zh: "法院案件" },
  Briefing: { es: "Resumen", zh: "简报" },
  "Written by Billion AI \u00b7 Always check the source": {
    es: "Escrito por Billion AI · Comprueba siempre la fuente",
    zh: "由 Billion AI 撰写 · 请务必核对来源",
  },
  "The short version": { es: "En breve", zh: "简要说明" },
  Enacted: { es: "Promulgada", zh: "已生效" },
  Proposed: { es: "Propuesta", zh: "提案" },
  "What this means for you": {
    es: "Qué significa para ti",
    zh: "这对你意味着什么",
  },
  "What would change": { es: "Qué cambiaría", zh: "会有哪些改变" },
  Now: { es: "Ahora", zh: "目前" },
  After: { es: "Después", zh: "之后" },
  "Who it lands on": { es: "A quién afecta", zh: "影响哪些人" },
  Gains: { es: "Beneficios", zh: "受益" },
  Loses: { es: "Perjuicios", zh: "受损" },
  Mixed: { es: "Mixto", zh: "利弊并存" },
  Unclear: { es: "Incierto", zh: "尚不明确" },
  "What the text doesn't settle": {
    es: "Lo que el texto no aclara",
    zh: "文本尚未明确的问题",
  },
  "Don't take our word for it.": {
    es: "No te quedes solo con nuestra explicación.",
    zh: "别只听我们说。",
  },
  "Read the full, unedited text on the official record.": {
    es: "Lee el texto íntegro en el registro oficial.",
    zh: "阅读官方记录中的完整原文。",
  },
  "Open the source \u2192": { es: "Abrir la fuente →", zh: "打开来源 →" },
  "Billion isn't on Android yet.": {
    es: "Billion aún no está en Android.",
    zh: "Billion 暂未推出 Android 版。",
  },
  "Every bill, explained like this.": {
    es: "Cada proyecto de ley, explicado así.",
    zh: "每项法案，都这样解读。",
  },
  "We're building it. Leave your email and we'll tell you the day it's ready.":
    {
      es: "Lo estamos preparando. Deja tu correo y te avisaremos cuando esté listo.",
      zh: "我们正在开发。留下邮箱，上线时通知你。",
    },
  "Bills, executive orders and court cases in plain language, with the original text one tap away.":
    {
      es: "Leyes, órdenes ejecutivas y casos judiciales en lenguaje claro, con el original a un toque.",
      zh: "用易懂的语言解读法案、行政令和法院案件，轻点即可查看原文。",
    },
  "Notify me": { es: "Avísame", zh: "通知我" },
  "Get Billion for iPhone": {
    es: "Descargar Billion para iPhone",
    zh: "下载 iPhone 版 Billion",
  },
  Introduced: { es: "Presentado", zh: "提出日期" },
  Published: { es: "Publicado", zh: "发布日期" },
  "Posted by White House": {
    es: "Publicado por la Casa Blanca",
    zh: "白宫发布于",
  },
  "Published in Federal Register": {
    es: "Publicado en el Federal Register",
    zh: "联邦公报发布于",
  },
  "Opinion released": { es: "Opinión publicada", zh: "意见发布于" },
  "Latest docket entry": {
    es: "Última entrada del expediente",
    zh: "最新案卷记录",
  },
  "Court record dated": {
    es: "Fecha del registro judicial",
    zh: "法院记录日期",
  },
  "Added to Billion": { es: "Añadido a Billion", zh: "收录于 Billion" },
  "Updated on Billion": { es: "Actualizado en Billion", zh: "Billion 更新于" },
  "Translation is being prepared.": {
    es: "La traducción se está preparando.",
    zh: "正在准备翻译。",
  },
  "Try again": { es: "Reintentar", zh: "重试" },
  "Read in English": { es: "Leer en inglés", zh: "阅读英文" },
  "Machine translated \u00b7 Original sources retain their language.": {
    es: "Traducción automática · Las fuentes conservan su idioma original.",
    zh: "机器翻译 · 原始资料保留原文。",
  },
  "Read the whole thing on Billion": {
    es: "Lee el texto completo en Billion",
    zh: "在 Billion 阅读完整解读",
  },
  "What your government is actually doing.": {
    es: "Lo que hace tu gobierno.",
    zh: "了解政府正在做什么。",
  },
  "Get updates": { es: "Recibir novedades", zh: "获取更新" },
  "Enter your email": { es: "Introduce tu correo", zh: "输入邮箱" },
  "Email address": { es: "Correo electrónico", zh: "邮箱地址" },
  Submitting: { es: "Enviando", zh: "正在提交" },
  "Something went wrong. Please try again.": {
    es: "Algo salió mal. Inténtalo de nuevo.",
    zh: "发生错误，请重试。",
  },
  "You're already on the list \u2014 you're all set.": {
    es: "Ya estás en la lista.",
    zh: "你已在通知名单中。",
  },
  "You're on the list \u2014 we'll be in touch!": {
    es: "Ya estás en la lista. ¡Te avisaremos!",
    zh: "你已加入名单，我们会通知你！",
  },
};
export function readerText(language: ReaderLanguage, text: string) {
  return language === "en" ? text : (copy[text]?.[language] ?? text);
}
