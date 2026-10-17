const labels: Record<string, { zh: string; es: string }> = {
  "Proposition {number} · The debate": {
    zh: "第 {number} 号提案 · 讨论",
    es: "Propuesta {number} · El debate",
  },
  "AI-written · Check the sources": {
    zh: "AI 撰写 · 请核对来源",
    es: "Escrito por IA · Consulta las fuentes",
  },
  "What this means": { zh: "这是什么意思", es: "Qué significa" },
  "Billion's plain-language explanation.": {
    zh: "Billion 的通俗解释。",
    es: "Explicación de Billion en lenguaje sencillo.",
  },
  Details: { zh: "详情", es: "Detalles" },
  Back: { zh: "返回", es: "Volver" },
  Close: { zh: "关闭", es: "Cerrar" },
  Map: { zh: "关系图", es: "Mapa" },
  List: { zh: "列表", es: "Lista" },
  Basics: { zh: "基础信息", es: "Lo básico" },
  Disputes: { zh: "争议", es: "Disputas" },
  Unanswered: { zh: "未解答", es: "Sin respuesta" },
  Arguments: { zh: "论点", es: "Argumentos" },
  "What it does": { zh: "提案内容", es: "Qué hace" },
  "Read more": { zh: "阅读更多", es: "Leer más" },
  "New to this? How it works today": {
    zh: "初次了解？看看目前如何运作",
    es: "¿Es nuevo para ti? Cómo funciona hoy",
  },
  "From the measure text": { zh: "提案原文", es: "Del texto de la propuesta" },
  "From the Legislative Analyst": {
    zh: "立法分析师原文",
    es: "Del analista legislativo",
  },
  "What the measure says": { zh: "提案原文内容", es: "Qué dice la propuesta" },
  "What the Legislative Analyst says": {
    zh: "立法分析师的说明",
    es: "Qué dice el analista legislativo",
  },
  "The debate starts here, not ends.": {
    zh: "讨论从这里开始。",
    es: "El debate empieza aquí, no termina.",
  },
  Yes: { zh: "赞成", es: "A favor" },
  No: { zh: "反对", es: "En contra" },
  "both ways": { zh: "双方观点", es: "ambas posturas" },
  "{count} arguments": { zh: "{count} 个论点", es: "{count} argumentos" },
  "{count} items": { zh: "{count} 项", es: "{count} elementos" },
  "{count} quotes": { zh: "{count} 处引文", es: "{count} citas" },
  "What was it like before?": {
    zh: "以前是什么情况？",
    es: "¿Cómo era antes?",
  },
  "Existing rules": { zh: "现行规则", es: "Reglas actuales" },
  "Past results": { zh: "过往结果", es: "Resultados anteriores" },
  "Money in context": { zh: "资金背景", es: "El dinero en contexto" },
  "Why this question?": {
    zh: "为什么选择这个问题？",
    es: "¿Por qué esta pregunta?",
  },
  "Selected by Billion AI": {
    zh: "由 Billion AI 选出",
    es: "Seleccionado por Billion AI",
  },
  "Selected by Billion AI · an editorial judgment": {
    zh: "由 Billion AI 选出 · 编辑判断",
    es: "Seleccionado por Billion AI · un criterio editorial",
  },
  "Questions worth weighing": {
    zh: "值得权衡的问题",
    es: "Preguntas para sopesar",
  },
  "A question to explore": {
    zh: "值得探讨的问题",
    es: "Una pregunta para explorar",
  },
  "Explore {count} linked arguments": {
    zh: "查看 {count} 个相关论点",
    es: "Explorar {count} argumentos relacionados",
  },
  "Evidence {number}": { zh: "证据 {number}", es: "Evidencia {number}" },
  "Limits of this evidence": {
    zh: "这份证据的局限",
    es: "Límites de esta evidencia",
  },
  "Comparison source": { zh: "比较来源", es: "Fuente de la comparación" },
  "Source passages": { zh: "来源原文", es: "Pasajes de las fuentes" },
  "Open official source": { zh: "打开官方来源", es: "Abrir fuente oficial" },
};

export function readerLabel(
  language: "en" | "es" | "zh",
  key: string,
  values: Record<string, string | number> = {},
) {
  const text = language === "en" ? key : (labels[key]?.[language] ?? key);
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    String(values[name] ?? match),
  );
}
