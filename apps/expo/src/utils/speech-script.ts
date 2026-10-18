/**
 * An audio-first reading of the article: context, comparisons, and attribution, split into
 * chunks the device speech engine accepts. Pure so it can be tested without a
 * native module; playback lives in `~/hooks/useArticleSpeech`.
 *
 * Only prose is read. Markdown syntax, URLs, and image tags would be spoken
 * literally, so they are removed. Verbatim source quotes inside a brief are
 * skipped; "Original text" mode reads the source itself.
 */

import type { AppLanguage } from "../i18n/language";

/** Android rejects input past ~4000 characters; stay well under it. */
export const MAX_CHUNK_CHARS = 1500;

interface BillBriefLike {
  legalStatus?: "proposed" | "enacted";
  summary?: string;
  facts?: { label?: string; value?: string; note?: string }[];
  hook?: string;
  changes?: { title?: string; before?: string; after?: string }[];
  affected?: { group?: string; takeaway?: string; effect?: string }[];
  whyNotBefore?: { summary?: string; points?: { text?: string }[] };
  unknowns?: string[];
}

interface CourtPointLike {
  text?: string;
}

interface CourtBriefLike {
  takeaway?: CourtPointLike;
  action?: CourtPointLike;
  posture?: string;
  questions?: CourtPointLike[];
  reasoning?: (CourtPointLike & {
    kind?: "holding" | "court_reasoning" | "party_argument" | "allegation";
  })[];
  effects?: (CourtPointLike & {
    group?: string;
    certainty?: "court_order" | "possible_effect";
  })[];
  opinions?: (CourtPointLike & {
    kind?: "majority" | "per_curiam" | "concurrence" | "dissent" | "unknown";
    author?: string | null;
  })[];
  unknowns?: string[];
}

export interface SpeechSource {
  isAIGenerated?: boolean;
  language?: AppLanguage;
  mode?: "explainer" | "opinions" | "source";
  title: string;
  description?: string;
  brief?: BillBriefLike | null;
  courtBrief?: CourtBriefLike | null;
  /** Markdown or plain body used when there is no brief, or in source mode. */
  body?: string | null;
}

export function stripMarkdown(text: string): string {
  return (
    text
      // Code fences and inline code
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      // Images, then links (keep the link text)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Bare URLs and HTML tags
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/<[^>]+>/g, " ")
      // Line-start syntax: headings, quotes, list markers, rules
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
      .replace(/^\s*(?:[-*_]\s*){3,}$/gm, "")
      // Emphasis markers
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
  );
}

/** Ends a fragment with sentence punctuation so the engine pauses. */
function sentence(text: string | undefined): string | null {
  if (!text) return null;
  const clean = stripMarkdown(text).replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return /[.!?。！？…:]$/.test(clean) ? clean : `${clean}.`;
}

const english = {
  intro:
    "Here is the brief. This is Billion's analysis. Check the original source for exact wording.",
  original: "Original source text.",
  facts: "First, a few key details.",
  changes: "Here is what changes.",
  before: "Right now",
  enactedBefore: "Before this measure",
  after: "Under this measure",
  affected: "Here is who is affected.",
  group: "For {group}",
  context: "Here is the background.",
  unknowns: "Here is what remains uncertain.",
  action: "Here is what the court did.",
  posture: "Here is the procedural context.",
  questions: "These are the questions before the court.",
  holding: "The court's holding",
  court_reasoning: "The court's reasoning",
  party_argument: "A party's argument",
  allegation: "An allegation, not an established fact",
  effects: "Here is who may be affected.",
  court_order: "The court ordered",
  possible_effect: "A possible effect, not a court order",
  opinions: "Here are the separate court opinions.",
  majority: "Majority opinion",
  per_curiam: "Opinion of the court",
  concurrence: "Concurring opinion",
  dissent: "Dissenting opinion",
  unknown: "Opinion with an unspecified position",
  author: "by {author}",
} as const;

const narration: Record<AppLanguage, Record<keyof typeof english, string>> = {
  en: english,
  es: {
    intro:
      "Este es el resumen. Es un análisis de Billion. Consulta la fuente original para verificar las palabras exactas.",
    original: "Texto de la fuente original.",
    facts: "Primero, algunos datos clave.",
    changes: "Estos son los cambios.",
    before: "Actualmente",
    enactedBefore: "Antes de esta medida",
    after: "Según esta medida",
    affected: "Estas son las personas y los grupos afectados.",
    group: "Para {group}",
    context: "Estos son los antecedentes.",
    unknowns: "Esto es lo que sigue sin resolverse.",
    action: "Esto es lo que hizo el tribunal.",
    posture: "Este es el contexto procesal.",
    questions: "Estas son las preguntas ante el tribunal.",
    holding: "La decisión del tribunal",
    court_reasoning: "El razonamiento del tribunal",
    party_argument: "El argumento de una de las partes",
    allegation: "Una alegación, no un hecho probado",
    effects: "Estos son los posibles afectados.",
    court_order: "El tribunal ordenó",
    possible_effect: "Un posible efecto, no una orden judicial",
    opinions: "Estas son las opiniones judiciales por separado.",
    majority: "Opinión mayoritaria",
    per_curiam: "Opinión del tribunal",
    concurrence: "Opinión concurrente",
    dissent: "Opinión disidente",
    unknown: "Opinión de posición no especificada",
    author: "de {author}",
  },
  zh: {
    intro: "下面是内容摘要。这是 Billion 的分析。准确措辞请核对原始来源。",
    original: "原始来源全文。",
    facts: "先了解几个关键事实。",
    changes: "下面介绍具体变化。",
    before: "目前的情况",
    enactedBefore: "这项措施实施前",
    after: "根据这项措施",
    affected: "下面介绍哪些人会受到影响。",
    group: "对于{group}",
    context: "下面介绍相关背景。",
    unknowns: "以下问题仍不确定。",
    action: "下面介绍法院采取了什么行动。",
    posture: "下面介绍案件的程序背景。",
    questions: "这些是法院面临的问题。",
    holding: "法院的裁定",
    court_reasoning: "法院的推理",
    party_argument: "一方当事人的主张",
    allegation: "这是一项指控，并非已证实的事实",
    effects: "下面介绍可能受到影响的人群。",
    court_order: "法院命令",
    possible_effect: "可能产生的影响，并非法院命令",
    opinions: "下面介绍各份法院意见。",
    majority: "多数意见",
    per_curiam: "法院集体意见",
    concurrence: "协同意见",
    dissent: "反对意见",
    unknown: "立场未明确的意见",
    author: "作者：{author}",
  },
};

export function buildSpeechParagraphs(source: SpeechSource): string[] {
  const copy = narration[source.language ?? "en"];
  const paragraphs: string[] = [];
  const add = (...texts: (string | undefined)[]) => {
    const text = texts.map(sentence).filter(Boolean).join(" ");
    if (text) paragraphs.push(text);
  };
  const labelled = (label: string, text: string | undefined) => {
    if (text) add(`${label}: ${text}`);
  };
  const opinions = (court: CourtBriefLike) => {
    if (!court.opinions?.length) return;
    add(copy.opinions);
    for (const opinion of court.opinions) {
      const author = opinion.author
        ? copy.author.replace("{author}", opinion.author)
        : "";
      labelled(
        `${copy[opinion.kind ?? "unknown"]} ${author}`.trim(),
        opinion.text,
      );
    }
  };
  add(source.title);
  if (
    source.mode === "source" ||
    (source.isAIGenerated === false && !source.brief && !source.courtBrief)
  ) {
    add(copy.original);
    for (const paragraph of source.body?.split(/\n{2,}/) ?? []) add(paragraph);
    return paragraphs;
  }
  add(copy.intro);
  if (source.mode === "opinions") {
    if (source.courtBrief) opinions(source.courtBrief);
    return paragraphs;
  }
  if (source.brief) {
    const brief = source.brief;
    // The hook explains the summary; don't repeat the card subtitle first.
    add(brief.hook ?? brief.summary ?? source.description);
    if (brief.facts?.length) {
      add(copy.facts);
      for (const fact of brief.facts) {
        labelled(
          fact.label ?? "",
          [fact.value, fact.note].filter(Boolean).join(", "),
        );
      }
    }
    if (brief.changes?.length) add(copy.changes);
    for (const change of brief.changes ?? []) {
      add(change.title);
      labelled(
        brief.legalStatus === "enacted" ? copy.enactedBefore : copy.before,
        change.before,
      );
      labelled(copy.after, change.after);
    }
    if (brief.affected?.length) add(copy.affected);
    for (const group of brief.affected ?? []) {
      if (group.group) add(copy.group.replace("{group}", group.group));
      add(group.takeaway);
      if (group.effect !== group.takeaway) add(group.effect);
    }
    if (brief.whyNotBefore) {
      add(copy.context, brief.whyNotBefore.summary);
      for (const point of brief.whyNotBefore.points ?? []) add(point.text);
    }
    if (brief.unknowns?.length) add(copy.unknowns, ...brief.unknowns);
  } else if (source.courtBrief) {
    const court = source.courtBrief;
    add(court.takeaway?.text ?? source.description);
    if (court.action?.text) add(copy.action, court.action.text);
    if (court.posture) add(copy.posture, court.posture);
    if (court.questions?.length)
      add(copy.questions, ...court.questions.map((point) => point.text));
    for (const point of court.reasoning ?? [])
      labelled(copy[point.kind ?? "court_reasoning"], point.text);
    if (court.effects?.length) add(copy.effects);
    for (const effect of court.effects ?? []) {
      if (effect.group) add(copy.group.replace("{group}", effect.group));
      if (effect.certainty) labelled(copy[effect.certainty], effect.text);
      else add(effect.text);
    }
    if (court.unknowns?.length) add(copy.unknowns, ...court.unknowns);
    // Opinions have their own listening mode, as in the reader.
  } else {
    add(source.description);
    // Source quotations remain English in translated explainers. Leave these
    // disclosures to Original text rather than reading them in the wrong voice.
    const body = source.body?.replace(
      /^[ \t]{0,3}>[^\n]*(?:\n(?![ \t]*\n)[^\n]*)*/gm,
      "",
    );
    for (const paragraph of body?.split(/\n{2,}/) ?? []) add(paragraph);
  }
  return paragraphs;
}

/** Splits on sentence ends, including CJK full-width punctuation. */
function sentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?])\s+|(?<=[。！？])/).filter(Boolean);
}

/**
 * Packs paragraphs into chunks under `max` characters. Paragraph breaks are
 * preferred; a long paragraph splits on sentences, and a run-on sentence on
 * whitespace (or anywhere, for unspaced scripts like Chinese).
 */
export function chunkForSpeech(
  paragraphs: string[],
  max = MAX_CHUNK_CHARS,
): string[] {
  const pieces = paragraphs.flatMap((paragraph) =>
    paragraph.length <= max
      ? [paragraph]
      : sentences(paragraph).flatMap((s) => hardSplit(s, max)),
  );
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > max) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current} ${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

function hardSplit(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const space = rest.lastIndexOf(" ", max);
    const cut = space > max / 2 ? space : max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function buildSpeechChunks(source: SpeechSource): string[] {
  return chunkForSpeech(buildSpeechParagraphs(source));
}
