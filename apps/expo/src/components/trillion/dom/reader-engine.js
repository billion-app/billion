/* eslint-disable */
// @ts-nocheck
/**
 * The Trillion reader (#455): the phone reading view, Cytoscape map, previews
 * and drawers. One implementation serves the Expo DOM component
 * (TrillionReader.tsx) and the HTML mockup (prototypes/trillion/mobile.html),
 * so the two cannot drift apart. Ported from the mockup's inline script; it
 * works on the DOM directly and keeps the mockup's structure.
 */
import cytoscape from "cytoscape";
import {
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

const d3 = { forceLink, forceManyBody, forceSimulation, forceX, forceY };

const MONTH_SLUG = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Mount the reader into `root`.
 * options.onExit: called by the back button on the main case.
 * options.onOpenUrl: called instead of following an external link.
 */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";

export function mountTrillionReader(root, graph, options = {}) {
  // One reader per root: a new graph replaces the old reader entirely, so no
  // stale listener or animation can act on cards that no longer exist.
  root.__trillion?.destroy();
  const lifetime = new AbortController();
  const listen = (target) => ({
    addEventListener: (type, handler, opts) =>
      target.addEventListener(type, handler, {
        ...(typeof opts === "object" ? opts : { capture: !!opts }),
        signal: lifetime.signal,
      }),
  });
  // Billion's typefaces; the app's native fonts are not visible inside a web view.
  if (
    ![...document.querySelectorAll("link[rel=stylesheet]")].some((l) =>
      l.href.startsWith("https://fonts.googleapis.com/css2?family=Albert+Sans"),
    )
  ) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS;
    document.head.appendChild(link);
  }
  const [year, month, day] = graph.electionDate.split("-").map(Number);
  const eyebrow = `California · ${MONTHS[month - 1]} ${day}, ${year}`;
  const recordTitle = `Proposition ${graph.measure.number} · The debate`;
  root.classList.add("trillion-root");
  root.innerHTML = `
      <div class="app">
        <section class="canvas" aria-label="Argument map">
          <div class="canvas-head">
            <div class="eyebrow">Map</div>
            <p>
              Drag cards to pull the web around. Pinch, scroll, or use the
              buttons to zoom.
            </p>
          </div>
          <div id="canvas-slot"></div>
        </section>

        <main class="reader" id="reader">
          <header class="top">
            <button class="back" id="back" aria-label="Back" type="button">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <div class="eyebrow">${eyebrow}</div>
              <div class="rec-title">${recordTitle}</div>
            </div>
          </header>
          <button
            class="notice"
            id="notice"
            type="button"
            aria-expanded="false"
            aria-label="Show details about Billion AI authorship"
          >
            <span class="notice-icon"
              ><svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5zm6.5 11.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z"
                /></svg
            ></span>
            <span class="notice-body">
              <span class="notice-head"
                ><span class="notice-title">AI-written · Check the sources</span
                ><span class="notice-action">Details</span
                ><svg
                  class="chev"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" /></svg
              ></span>
              <span class="notice-text" hidden
                >Built from the official voter guide. Quotes are checked word
                for word against it; the disputed questions, leans, and link
                explanations are AI analysis no person has checked yet. Tap any
                quote to open its source.</span
              >
            </span>
          </button>
          <nav class="crumbs" id="crumbs" aria-label="Your path"></nav>
          <div id="page"></div>
        </main>
      </div>

      <div id="map-home">
        <div
          class="map"
          id="map"
          role="group"
          aria-label="Argument map. The list has the same connections."
        >
          <div class="map-full-head">
            <h2>Map</h2>
            <button class="close" type="button" id="map-close">Close</button>
          </div>
          <div id="cy"></div>
          <button type="button" class="map-more" id="map-more" hidden></button>

          <button type="button" class="map-main" id="map-main" hidden>
            ← Go back to main case
          </button>
          <div class="legend" aria-hidden="true">
            <span style="--c: var(--rel-for)"><i></i>supports · favors yes</span>
            <span style="--c: var(--rel-against)"
              ><i></i>challenges · favors no</span
            >
            <span style="--c: var(--rel-mixed)"
              ><i></i>qualifies · both ways</span
            >
            <span style="--c: var(--rel-question)"><i></i>asks</span>
          </div>
          <div class="map-tools">
            <button type="button" class="map-ring" id="map-ring">
              <svg viewBox="-8 -8 16 16" aria-hidden="true">
                <circle r="2.6" fill="#D4AF37" />
                <circle
                  r="5"
                  fill="none"
                  stroke="#B8A1FF"
                  stroke-width="2.2"
                  stroke-dasharray="5 1.5"
                />
                <circle
                  r="7.3"
                  fill="none"
                  stroke="#55D6BE"
                  stroke-width="1.4"
                  stroke-dasharray="3 1.5"
                />
              </svg>
              Whole debate
            </button>
            <button type="button" id="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
            <button type="button" id="zoom-fit" aria-label="Fit map">⤢</button>
            <button type="button" class="expand" id="map-expand">Expand</button>
          </div>
        </div>
      </div>

      <div id="layer"></div>
  `;
  // The adapter keeps its own scope, as it did in the mockup's separate script.
  let FIXTURE;
  {
    // Adapt the schema graph (docs/evidence/455/prop40-graph.json) to the prototype's shape.
    const G = graph;
    const src = Object.fromEntries(G.sources.map((s) => [s.id, s]));
    const KIND = { provision: "text", shared: "global" };
    const BILLION = new Set([
      "generated",
      "crux",
      "question",
      "shared",
      "fact",
    ]);
    const nodes = {};
    for (const n of G.nodes) {
      const q = n.quotes[0];
      const s = q && src[q.sourceId];
      let source;
      if (n.kind === "argument")
        source = {
          label: n.attribution.name,
          signers: n.attribution.signers,
          locator: q.locator,
          url: s.url,
        };
      else if (s)
        source = {
          label:
            s.role === "legal-text"
              ? s.number === G.measure.number
                ? "Measure text"
                : `Prop ${s.number} text`
              : s.role === "official-analysis"
                ? "Legislative Analyst"
                : s.role === "precedent"
                  ? `Past record · ${s.title.split(":")[0]}`
                  : "Official arguments",
          locator: q.locator,
          url: s.url,
        };
      else if (BILLION.has(n.kind))
        source = {
          generated: true,
          label: "Generated by Billion",
          locator: "Written by Billion",
        };
      nodes[n.id] = {
        kind: KIND[n.kind] ?? n.kind,
        label: n.label,
        title: n.title,
        body: n.body,
        note: n.note,
        dispute: n.dispute,
        record: n.record,
        quote: n.quotes.length
          ? n.quotes.map((x) => x.text).join(" … ")
          : undefined,
        source,
      };
    }
    FIXTURE = {
      record: { rootId: G.rootId },
      nodes,
      edges: G.edges.map((e) => ({
        ...e,
        by: e.why ? "generated" : undefined,
      })),
      edgeResponses: [],
    };
  }
  const F = FIXTURE;
  const N = F.nodes;
  const E = Object.fromEntries(F.edges.map((e) => [e.id, e]));
  const ROOT = F.record.rootId;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PREVIEW = 4; // rows per tab before "Show more"

  const KIND = {
    root: "Main case",
    branch: "Start here",
    text: "Measure text",
    finding: "Measure findings",
    analysis: "Legislative Analyst",
    argument: "Ballot argument",
    generated: "Generated by Billion",
    question: "Open question",
    reader: "Reader contribution",
    global: "Shared claim",
    record: "Other record",
    fact: "Fact",
    crux: "Where people disagree",
    precedent: "Past record",
  };
  const IN = {
    supports: "Supports this",
    challenges: "Challenges this",
    qualifies: "Qualifies this",
    appliesTo: "Applies here",
    asks: "Asks about this",
    answers: "Answers this",
    conflicts: "Conflicts with this",
    crux: "Disputed question",
  };
  const OUT = {
    supports: "Supports",
    challenges: "Challenges",
    qualifies: "Qualifies",
    appliesTo: "Applies to",
    asks: "Asks about",
    answers: "Answers",
    conflicts: "Conflicts with",
    detail: "Part of",
    part: "Part of",
    crux: "Disputed under",
  };
  const SHORT = {
    supports: "supports",
    challenges: "challenges",
    qualifies: "qualifies",
    appliesTo: "applies to",
    asks: "asks",
    answers: "answers",
    conflicts: "conflicts",
    detail: "",
    part: "",
    crux: "",
  };
  const TONE = {
    supports: "for",
    challenges: "against",
    qualifies: "mixed",
    conflicts: "mixed",
    asks: "question",
    answers: "question",
    appliesTo: "applies",
    detail: "neutral",
    part: "neutral",
    crux: "neutral",
  };
  // An argument under a disputed question carries its lean toward the vote as a color and a word.
  // The label names the vote, because under a yes/no question "Leans no" reads as an answer to it.
  const LEAN = {
    for: `Favors Yes on ${graph.measure.number}`,
    against: `Favors No on ${graph.measure.number}`,
    mixed: "Cuts both ways",
  };
  const tone = (e) => (e.type === "weighs" ? e.stance : TONE[e.type]);
  const inLabel = (e) => (e.type === "weighs" ? LEAN[e.stance] : IN[e.type]);
  const outLabel = (e) => (e.type === "weighs" ? LEAN[e.stance] : OUT[e.type]);
  const short = (e) => (e.type === "weighs" ? LEAN[e.stance] : SHORT[e.type]);
  const DISPUTE = {
    facts: "Disputed facts",
    values: "Mostly values",
    reading: "Disputed reading of the text",
    legal: "Depends on courts and other measures",
  };
  const TONE_HEX = {
    for: "#55D6BE",
    against: "#FF9575",
    mixed: "#B8A1FF",
    question: "#F4C95D",
    applies: "#A5B9FF",
    neutral: "#4A5068",
  };
  const RESTS = new Set(["supports", "appliesTo"]);
  const RESP = new Set([
    "challenges",
    "qualifies",
    "asks",
    "answers",
    "conflicts",
  ]);
  const KIDS = new Set(["part", "detail", "crux"]);

  const incoming = (id) => F.edges.filter((e) => e.to === id);
  const outgoing = (id) => F.edges.filter((e) => e.from === id);
  const visible = (id) => N[id] && !N[id].hidden;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  // Titles mark one or two key phrases with **, as bill briefs do; plain text drops the marks.
  const titleOf = (id) => (N[id].title || "(untitled)").replaceAll("**", "");
  // Defined terms show in blue, as in Billion's bill briefs; tapping one explains it.
  const TERMS = new Map(
    (graph.terms || []).map((t) => [t.term.toLowerCase(), t]),
  );
  const termPattern = TERMS.size
    ? new RegExp(
        `(?<![\\p{L}\\p{N}_])(${[...TERMS.values()]
          .map((t) => esc(t.term))
          .sort((a, b) => b.length - a.length)
          .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})(?![\\p{L}\\p{N}_])`,
        "giu",
      )
    : null;
  // Mentions of other propositions link to them; the current one never links to itself.
  const PROP_MENTION = /\b(Prop(?:osition)?s?\.?\s+)(\d{1,3}[A-Z]?)\b/g;
  const linkMeasures = (html) =>
    html.replace(PROP_MENTION, (m, lead, n) =>
      n === graph.measure.number ||
      (options.ballot && !options.ballot.includes(n))
        ? m
        : `<span class="prop-link" role="link" tabindex="0" data-prop="${n}">${lead}${n}</span>`,
    );
  function openMeasure(n) {
    if (options.onOpenMeasure) return options.onOpenMeasure(n);
    const url = `https://voterguide.sos.ca.gov/propositions/${n}/`;
    if (options.onOpenUrl) options.onOpenUrl(url);
    else window.open(url, "_blank", "noopener");
  }
  const emphasize = (text) => {
    let html = linkMeasures(esc(text));
    if (termPattern)
      html = html.replace(
        termPattern,
        (m) =>
          `<span class="term" role="button" tabindex="0" data-term="${esc(m.toLowerCase())}">${m}</span>`,
      );
    return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  };
  function openTerm(key) {
    const t = TERMS.get(key);
    if (!t) return;
    openSheet(
      `<p class="meta" style="margin:0 0 4px">What this means</p>
      <h2 id="sheet-title">${esc(t.term)}</h2>
      <p class="body">${esc(t.plain).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>
      <p class="counts">Billion's plain-language explanation.</p>
      <div class="actions"><button class="btn ghost" type="button" data-close>Close</button></div>`,
      true,
    );
  }
  const titleHtml = (id) => emphasize(N[id].title || "(untitled)");

  // Debate-structure ordering: unanswered first, then evidence-backed, then contested, then the rest.
  function rank(id) {
    const inc = incoming(id);
    const kind = N[id].kind;
    if (
      (kind === "question" || kind === "reader" || kind === "argument") &&
      !inc.some((e) => RESP.has(e.type) || e.type === "supports")
    )
      return 0;
    if (inc.some((e) => e.type === "supports")) return 1;
    if (inc.some((e) => e.type === "challenges")) return 2;
    return 3;
  }
  const ranked = (edges, dir) =>
    [...edges]
      .sort(
        (a, b) =>
          rank(dir === "in" ? a.from : a.to) -
          rank(dir === "in" ? b.from : b.to),
      )
      .map((e) => ({ e, dir }));

  // A disputed question's state says where the debate stands without saying who is winning.
  function cruxState(id) {
    const args = incoming(id).filter((e) => e.type === "weighs");
    const open = args.filter((e) => rank(e.from) === 0).length;
    const sides = new Set(args.map((e) => e.stance));
    const state = open
      ? `${open} unanswered`
      : sides.has("for") && sides.has("against")
        ? "Contested"
        : "Few arguments yet";
    return { open, text: `${DISPUTE[N[id].dispute]} · ${state}` };
  }
  // Everything in the record that nobody has responded to yet.
  function unanswered() {
    return Object.keys(N)
      .filter((id) => visible(id) && id !== ROOT && rank(id) === 0)
      .map((id) => ({
        e: outgoing(id).find((x) => visible(x.to)),
        dir: "in",
      }))
      .filter((x) => x.e);
  }

  // Every focus splits its connections into a few tabs so no view shows everything at once.
  function categories(id) {
    const inc = incoming(id).filter((e) => visible(e.from));
    const out = outgoing(id).filter((e) => visible(e.to));
    if (id === ROOT)
      return [
        {
          key: "basics",
          label: "Basics",
          tone: "neutral",
          items: inc
            .filter((e) => e.type === "part")
            .map((e) => ({ e, dir: "in" })),
        },
        {
          key: "disagree",
          label: "Disputes",
          tone: "neutral",
          items: inc
            .filter((e) => e.type === "crux")
            .sort((a, b) => cruxState(b.from).open - cruxState(a.from).open)
            .map((e) => ({ e, dir: "in" })),
        },
        {
          key: "open",
          label: "Unanswered",
          tone: "question",
          items: unanswered(),
          empty: "Everything here has at least one response.",
        },
      ];
    if (N[id].kind === "crux")
      return [
        {
          key: "args",
          label: "Arguments",
          tone: "neutral",
          items: ranked(
            inc.filter((e) => e.type === "weighs"),
            "in",
          ),
        },
        {
          key: "resp",
          label: "Questions about this",
          tone: "question",
          items: ranked(
            inc.filter((e) => RESP.has(e.type)),
            "in",
          ),
          empty: "No one has questioned how this dispute is framed.",
        },
      ];
    const cats = [];
    const kids = inc.filter((e) => e.type === "part" || e.type === "detail");
    if (kids.length)
      cats.push({
        key: "inside",
        label: "Inside",
        tone: "neutral",
        // The measure's own text first, then its findings, then the Analyst, keeping the
        // drafted order (most important first) within each.
        items: kids
          .map((e, i) => ({ e, i, p: INSIDE_ORDER[N[e.from]?.kind] ?? 9 }))
          .sort((a, b) => a.p - b.p || a.i - b.i)
          .map(({ e }) => ({ e, dir: "in" })),
      });
    if (N[id].kind !== "branch") {
      cats.push({
        key: "resp",
        label: "Responses",
        tone: "against",
        items: ranked(
          inc.filter((e) => RESP.has(e.type)),
          "in",
        ),
        empty: "No one has challenged, qualified, or questioned this yet.",
      });
      cats.push({
        key: "rests",
        label: "Rests on",
        tone: "for",
        items: ranked(
          inc.filter((e) => RESTS.has(e.type)),
          "in",
        ),
        empty: ["text", "finding"].includes(N[id].kind)
          ? "This is the measure's own wording. Inspect the source to read it in context."
          : "No supporting evidence or reasons have been linked yet.",
      });
    }
    if (out.length)
      cats.push({
        key: "used",
        label: "Used in",
        tone: "applies",
        items: out.map((e) => ({ e, dir: "out" })),
      });
    return cats;
  }
  function defaultTab(id) {
    const cats = categories(id);
    return (
      cats.find((c) => c.key === "inside") ||
      cats.find((c) => c.key === "basics") ||
      cats.find((c) => c.key === "args") ||
      cats.find((c) => c.items.length) ||
      cats[0]
    )?.key;
  }

  // ── State ───────────────────────────────────────────────────────────
  let path = [{ t: "node", id: ROOT }];
  let tab = defaultTab(ROOT);
  const shown = new Set(); // tabs expanded past the preview, keyed focus:tab
  let direction = "in";
  let view = options.view === "map" ? "map" : "list"; // the reader's choice persists while navigating
  const viewsHtml = () =>
    `<div class="views" role="group" aria-label="Show as"><button type="button" data-view="list" aria-pressed="${view === "list"}">List</button><button type="button" data-view="map" aria-pressed="${view === "map"}">Map</button></div>`;
  const cur = () => path[path.length - 1];
  const focusId = () => (cur().t === "edge" ? E[cur().id].to : cur().id);
  const activeCat = () =>
    categories(focusId()).find((c) => c.key === tab) ||
    categories(focusId())[0];

  function go(target) {
    const i = path.findIndex((p) => p.t === target.t && p.id === target.id);
    direction = i >= 0 ? "back" : "in";
    if (i >= 0) path = path.slice(0, i + 1);
    else path.push(target);
    tab = defaultTab(focusId());
    render(true);
  }
  function back() {
    if (path.length <= 1) {
      options.onExit?.();
      return;
    }
    {
      path.pop();
      direction = "back";
      tab = defaultTab(focusId());
      render(true);
    }
  }
  function goMain() {
    path = [path[0]];
    direction = "back";
    tab = defaultTab(ROOT);
    render(true);
  }

  // ── Reading column ──────────────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const page = $("#page");

  function srcLabel(n) {
    const s = n.source || {};
    if (s.handle) return `${s.handle} · prototype example`;
    if (n.kind === "argument") return s.label;
    if (n.kind === "global")
      return `Shared claim · used in ${n.usedIn} other records (example count)`;
    return s.label || KIND[n.kind];
  }

  const INSIDE_ORDER = { text: 0, finding: 1, analysis: 2, record: 3 };
  // A card about another ballot measure says so, whatever tab it appears in.
  function measureLink(id) {
    if (N[id].kind === "record") return "";
    const conflicts = new Set();
    const affects = new Set();
    for (const x of F.edges) {
      if (x.from !== id && x.to !== id) continue;
      const other = N[x.from === id ? x.to : x.from];
      if (other?.kind !== "record" || !other.record) continue;
      (x.type === "conflicts" ? conflicts : affects).add(other.record.number);
    }
    const props = (set) => {
      const n = [...set].sort();
      return `Prop${n.length > 1 ? "s" : ""} ${n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : n[0]}`;
    };
    for (const n of conflicts) affects.delete(n);
    return [
      conflicts.size ? `Conflicts with ${props(conflicts)}` : "",
      affects.size ? `Affects ${props(affects)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function row({ e, dir }) {
    const otherId = dir === "in" ? e.from : e.to;
    const o = N[otherId];
    const rel = dir === "in" ? inLabel(e) : outLabel(e);
    const open =
      dir === "in" && rank(otherId) === 0
        ? `<span class="badge-open">Unanswered</span>`
        : "";
    const about = measureLink(otherId);
    const chip = KIDS.has(e.type)
      ? dir === "out"
        ? `<span class="relchip static">${esc(rel)}</span>`
        : about
          ? `<span class="relchip static r-mixed">${esc(about)}</span>`
          : ""
      : `<button class="relchip" type="button" data-edge="${e.id}" aria-label="${esc(rel)}. Open this link">${esc(rel)} ›</button>`;
    return `<div class="row r-${tone(e)}${o.kind === "global" ? " is-global" : ""}">
      <div class="rowhead">${chip}<span class="src">${esc(srcLabel(o))}</span></div>
      <button class="go" type="button" data-node="${otherId}">
        <span class="t">${titleHtml(otherId)}${open}</span>
      </button>
    </div>`;
  }

  function tabsHtml(cats) {
    return `<div class="tabs" role="tablist" aria-label="Connections">${cats
      .map(
        (c) =>
          `<button class="tab r-${c.tone}" role="tab" type="button" data-tab="${c.key}" aria-selected="${c.key === tab}" aria-controls="tabpanel">${c.tone !== "neutral" ? '<span class="dot"></span>' : ""}${esc(c.label)} <span class="n">${c.items.length}</span></button>`,
      )
      .join("")}</div>`;
  }

  function panelHtml(id, cat) {
    if (!cat) return "";
    const key = `${id}:${cat.key}`;
    let body;
    if (cat.key === "basics") {
      body = `<div class="tiles">${cat.items
        .map(({ e }) => {
          const k = incoming(e.from).filter((x) => KIDS.has(x.type)).length;
          return `<button class="tile" type="button" data-node="${e.from}"><span class="t">${esc(N[e.from].title)}</span><span class="n">${isActBranch(e.from) && graph.jurisdiction === "CA" ? (k ? `Voting basics · ${k} more` : "Voting basics") : `${k} item${k === 1 ? "" : "s"}`}</span></button>`;
        })
        .join("")}</div>`;
    } else if (cat.key === "disagree") {
      body = `<div class="rows">${cat.items
        .map(({ e }) => {
          const st = cruxState(e.from);
          return `<div class="row r-question"><span class="relchip static">${esc(st.text)}</span>
          <button class="go" type="button" data-node="${e.from}"><span class="t">${titleHtml(e.from)}</span>
          <span class="src">${incoming(e.from).filter((x) => x.type === "weighs").length} arguments so far</span></button></div>`;
        })
        .join("")}</div>`;
    } else if (cat.key === "open") {
      body = cat.items.length
        ? `<div class="rows">${cat.items
            .map(
              ({
                e,
              }) => `<div class="row r-question"><span class="relchip static">Unanswered</span>
          <button class="go" type="button" data-node="${e.from}"><span class="t">${titleHtml(e.from)}</span>
          <span class="src">${esc(srcLabel(N[e.from]))} · on “${esc(titleOf(e.to))}”</span></button></div>`,
            )
            .join("")}</div>`
        : `<p class="empty">${esc(cat.empty)}</p>`;
    } else if (!cat.items.length) {
      body = `<p class="empty">${esc(cat.empty || "Nothing here yet.")}</p>`;
    } else {
      const rows = shown.has(key) ? cat.items : cat.items.slice(0, PREVIEW);
      const rest = cat.items.length - rows.length;
      body = `<div class="rows">${rows.map(row).join("")}</div>${rest > 0 ? `<button class="more" type="button" data-more="${key}">Show ${rest} more</button>` : ""}`;
    }
    return `<section class="section" id="tabpanel" role="tabpanel">${body}</section>`;
  }

  function focusCard(id) {
    const n = N[id];
    const src = n.source || {};
    if (id === ROOT)
      return `<article class="focus is-root"><h1 tabindex="-1">${esc(n.title)}</h1>${summaryHtml()}</article>`;
    const meta = [
      `<span class="kind">${esc(n.kind === "argument" ? src.label : n.kind === "crux" ? cruxState(id).text : KIND[n.kind])}</span>`,
    ];
    if (src.handle)
      meta.push(
        `<span>${esc(src.handle)}</span><span class="example">Prototype example</span>`,
      );

    if (n.kind === "global")
      meta.push(
        `<span>Used in ${n.usedIn} other records (example count)</span>`,
      );

    return `<article class="focus">
      <div class="meta">${meta.join("")}</div>
      <h1 tabindex="-1" class="${n.title.includes("**") ? "stmt" : ""}">${titleHtml(id)}</h1>
      ${n.body ? `<p class="body">${esc(n.body)}</p>` : ""}
      ${n.quote ? `<blockquote class="quote">“${esc(n.quote)}”<footer><span>${esc(src.locator)}</span><button class="linkish" type="button" data-source="${id}">Inspect source</button></footer></blockquote>` : ""}
      ${n.note ? `<p class="note">${esc(n.note)}</p>` : ""}
      ${src.signers && n.quote ? `<p class="note">Signed by ${esc(src.signers)}</p>` : ""}
      ${n.kind === "record" ? `<p class="note">A separate record with its own graph.</p>` : ""}
      ${n.duplicateOf ? `<div class="dup"><strong>Possible duplicate</strong><span>This looks like <button class="linkish" type="button" data-node="${n.duplicateOf}">${esc(titleOf(n.duplicateOf))}</button>. Duplicates may be merged later, keeping each wording and its context.</span></div>` : ""}
    </article>`;
  }

  function renderEdge(eid) {
    const e = E[eid];
    const resps = F.edgeResponses.filter((r) => r.edge === eid);
    const by = !e.by
      ? ""
      : e.by === "generated"
        ? `<span>Written by Billion AI</span>`
        : `<span>${esc(e.by)}</span><span class="example">Prototype example</span>`;
    const card = (id) =>
      `<div class="row r-neutral"><button class="go" type="button" data-node="${id}"><span class="t">${titleHtml(id)}</span><span class="src">${esc(srcLabel(N[id]))}</span></button></div>`;
    const heading =
      e.type === "weighs"
        ? `Why does this ${esc(short(e))}?`
        : `Why does this ${esc(short(e))} that?`;
    return `<article class="focus r-${tone(e)}">
        <div class="meta"><span class="kind">Link</span>${by}</div>
        <h1 tabindex="-1">${heading}</h1>
        <div class="edge-pair">${card(e.from)}<div class="arrow">↓ ${esc(short(e))}</div>${card(e.to)}</div>
        <p class="body">${esc(e.why || "The connection has not been explained.")}</p>
      </article>
      ${viewsHtml()}${view === "map" ? '<div id="phone-slot"></div>' : ""}
      <section class="section foot"${view === "map" ? " hidden" : ""}>
      ${
        resps.length
          ? `<div class="rows">${resps
              .map(
                (
                  r,
                ) => `<div class="row r-against"><span class="relchip static">Challenges this step</span>
          <button class="go" type="button" data-node="${r.from}"><span class="t">${titleHtml(r.from)}</span><span class="src">${esc(srcLabel(N[r.from]))}</span></button>
          <div class="why">${esc(N[r.from].body)}</div></div>`,
              )
              .join("")}</div>`
          : `<p class="empty">No one has challenged this step yet. You can accept both claims and still dispute the link between them.</p>`
      }</section>`;
  }

  function renderCrumbs() {
    $("#crumbs").hidden = path.length === 1;
    $("#crumbs").innerHTML = path
      .map((p, i) => {
        const label =
          p.t === "edge"
            ? `Link: ${short(E[p.id])}`
            : i === 0
              ? "← Main case"
              : titleOf(p.id);
        return `<button class="crumb" type="button" data-crumb="${i}"${i === path.length - 1 ? ' aria-current="page"' : ""}>${esc(label)}</button>`;
      })
      .join("");
    $("#crumbs").lastElementChild?.scrollIntoView({
      block: "nearest",
      inline: "end",
    });
  }

  // The main case never ends in a conclusion; it ends in a way further in.
  function doorHtml() {
    const cats = categories(ROOT);
    const n = (k) => cats.find((c) => c.key === k).items.length;
    return `<section class="door">
      <p class="door-t">The debate starts here, not ends.</p>
      <div class="door-actions">
        ${tab !== "disagree" ? `<button class="btn ghost" type="button" data-tab="disagree">Disputes (${n("disagree")})</button>` : ""}
        ${tab !== "open" ? `<button class="btn ghost" type="button" data-tab="open">Unanswered (${n("open")})</button>` : ""}
      </div>
    </section>`;
  }

  // ── Whole-debate overview: a sunburst, Kialo-style ──────────────────
  // Only the debate, not the basics: disputed questions, then the arguments weighing on them
  // (colored by lean), then responses. Slice width is the amount of debate underneath, so thin
  // spots show at a glance; dashed slots mark questions with almost nothing under them yet.
  function debateTree() {
    const kids = new Map();
    const seen = new Set([ROOT]);
    const depth = new Map([[ROOT, 0]]);
    const queue = [ROOT];
    while (queue.length) {
      const id = queue.shift();
      if (depth.get(id) >= 3) continue;
      const list = incoming(id)
        .filter(
          (e) =>
            visible(e.from) &&
            !seen.has(e.from) &&
            (id !== ROOT || e.type === "crux"),
        )
        .sort(
          (a, b) => (a.type === "part" ? -1 : 0) - (b.type === "part" ? -1 : 0),
        );
      kids.set(id, list);
      for (const e of list) {
        seen.add(e.from);
        depth.set(e.from, depth.get(id) + 1);
        queue.push(e.from);
      }
    }
    return kids;
  }
  const TREE = debateTree();
  const weight = (id) =>
    Math.max(
      1,
      (TREE.get(id) || []).reduce((n, e) => n + weight(e.from), 0),
    );
  const RINGS = [
    [21, 37],
    [39, 51],
    [53, 61],
  ];
  function arc(r0, r1, a0, a1) {
    a1 = Math.min(a1, a0 + Math.PI * 2 - 0.001);
    const p = (r, a) =>
      `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${p(r1, a0)}A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
  }
  function openRing() {
    const onPath = new Set(path.filter((p) => p.t === "node").map((p) => p.id));
    onPath.add(focusId());
    const slices = [];
    const walk = (id, ring, a0, a1) => {
      const list = TREE.get(id) || [];
      if (ring === 1 && N[id].kind === "crux" && list.length < 2)
        slices.push(
          `<path class="gap" d="${arc(...RINGS[1], a0 + 0.02, a1 - 0.02)}"/>`,
        );
      const total = list.reduce((n, e) => n + weight(e.from), 0);
      let a = a0;
      for (const e of list) {
        const b = a + ((a1 - a0) * weight(e.from)) / total;
        const child = e.from;
        const color = ring === 0 ? "#7A7F96" : TONE_HEX[tone(e)];
        const lit = onPath.has(child) || id === focusId();
        slices.push(
          `<path d="${arc(...RINGS[ring], a + 0.012, b - 0.012)}" fill="${color}" class="${lit ? "" : "dim"}" data-peek="${child}"${child === focusId() ? ' stroke="#f7f4ee" stroke-width="1.5"' : ""}><title>${esc(titleOf(child))}</title></path>`,
        );
        if (ring < RINGS.length - 1) walk(child, ring + 1, a, b);
        a = b;
      }
    };
    walk(ROOT, 0, 0, Math.PI * 2);
    const cruxes = (TREE.get(ROOT) || [])
      .filter((e) => N[e.from].kind === "crux")
      .map((e) => e.from);
    const args = cruxes.reduce(
      (n, id) => n + incoming(id).filter((e) => e.type === "weighs").length,
      0,
    );
    const size = (id) =>
      (TREE.get(id) || []).reduce((n, e) => n + 1 + size(e.from), 0);
    const thin = cruxes
      .map((id) => ({ id, n: size(id) }))
      .sort((a, b) => a.n - b.n)
      .slice(0, 1)
      .filter((t) => t.id !== focusId());
    openSheet(
      `<div class="ring-sheet">
          <div class="sheet-head"><h2 id="sheet-title">The whole debate</h2><button class="close" type="button" data-close>Close</button></div>
          <svg viewBox="-64 -64 128 128" role="img" aria-label="Ring map of the disputed questions, the arguments under them, and the responses.">
            ${slices.join("")}
            <circle r="18" fill="#D4AF37" data-peek="${ROOT}"${focusId() === ROOT ? ' stroke="#f7f4ee" stroke-width="1.5"' : ""}><title>Main case</title></circle>
          </svg>
          <p class="ov-hover is-empty" id="ov-hover" aria-live="polite">Tap a slice to see what it is</p>
          <p class="ring-key">${cruxes.length} disputes · ${args} arguments · ${unanswered().length} unanswered. Wider slices have more debate.</p>
          ${thin.map((t) => `<button type="button" class="thin" data-peek="${t.id}">Least explored: ${esc(N[t.id].label || titleOf(t.id))} ›</button>`).join("")}
          </div>`,
      true,
    );
  }

  // ── What it does: a short summary, each point quoting the measure's own text ──
  function summaryHtml() {
    const sm = graph.summary;
    if (!sm) return "";
    return `<section class="summary" aria-label="What it does">
      <p class="summary-k">What it does</p>
      <p class="summary-t">${emphasize(sm.text)}</p>
      ${sm.more ? `<details class="summary-more"><summary>Read more</summary><p>${emphasize(sm.more)}</p></details>` : ""}
      <button class="linkish" type="button" data-summary-sources>From the measure text · ${sm.quotes.length} ${sm.quotes.length === 1 ? "quote" : "quotes"}</button>
    </section>`;
  }
  function openSummarySources() {
    const sources = Object.fromEntries(graph.sources.map((s) => [s.id, s]));
    const url = sources[graph.summary.quotes[0].sourceId]?.url;
    openSheet(`<div class="sheet-head"><h2 id="sheet-title">What the measure says</h2><button class="close" type="button" data-close>Close</button></div>
      ${graph.summary.quotes
        .map(
          (q) =>
            `<blockquote class="quote">“${esc(q.text)}”<footer><span>${esc(q.locator)}</span></footer></blockquote>`,
        )
        .join("")}
      <p class="empty" style="margin-top:12px">Billion wrote the summary; these are the passages of the measure it rests on, matched word for word.</p>
      ${url ? `<div class="actions"><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">Open the measure text</a></div>` : ""}`);
  }

  // ── How can I act: voting basics, always present, never generated ────────
  // These come from state election law and official sites, not from the graph,
  // so every measure shows them however its graph was drafted.
  const isActBranch = (id) =>
    N[id]?.kind === "branch" && /^how can i act/i.test(titleOf(id));
  function votingHtml() {
    if (graph.jurisdiction !== "CA") return "";
    const [y, m, d] = graph.electionDate.split("-").map(Number);
    const day = (offset) =>
      new Date(Date.UTC(y, m - 1, d + offset)).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    // Each fact links to the Secretary of State page that states it (checked October 2026).
    const KEY_DATES = `https://www.sos.ca.gov/elections/upcoming-elections/general-election-${MONTH_SLUG[m - 1]}-${d}-${y}/key-dates-deadlines`;
    const REGISTER = "https://www.sos.ca.gov/elections/voter-registration";
    const MAIL =
      "https://www.sos.ca.gov/elections/voter-registration/vote-mail";
    const src = (href) =>
      ` <a class="fact-src" href="${href}" target="_blank" rel="noopener">Source</a>`;
    const links = [
      ["Check your registration", "https://voterstatus.sos.ca.gov/"],
      ["Register to vote", "https://registertovote.ca.gov/"],
      [
        "Find a drop box or voting location",
        "https://caearlyvoting.sos.ca.gov/",
      ],
      ["Track your mail ballot", "https://california.ballottrax.net/voter/"],
    ];
    return `<section class="voting" aria-label="Voting in California">
      <p class="summary-k">Voting in California</p>
      <ul class="voting-facts">
        <li><strong>Election day:</strong> ${day(0)}. Polls are open 7 a.m. to 8 p.m.${src(KEY_DATES)}</li>
        <li><strong>Register by ${day(-15)}.</strong> After that, you can still register "conditionally" and vote a provisional ballot at your county elections office.${src(REGISTER)}</li>
        <li><strong>Voting by mail:</strong> every active registered voter is mailed a ballot. Mail it postmarked by election day (it must arrive within 7 days), or drop it off by 8 p.m. on election day.${src(MAIL)}</li>
      </ul>
      <div class="voting-links">${links.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener">${label} ›</a>`).join("")}</div>
      <p class="voting-src">From the California Secretary of State. Not part of the debate.</p>
    </section>`;
  }

  function render(moveFocus) {
    const c = cur();
    if (page.contains(mapEl)) $("#map-home").appendChild(mapEl); // keep the map alive across re-renders
    if (c.t === "edge") page.innerHTML = renderEdge(c.id);
    else {
      const cats = categories(c.id);
      page.innerHTML = `${focusCard(c.id)}${isActBranch(c.id) ? votingHtml() : ""}${cats.length > 1 ? tabsHtml(cats) : ""}${viewsHtml()}${view === "map" ? '<div id="phone-slot"></div>' : panelHtml(c.id, activeCat())}
        ${c.id === ROOT && view === "list" ? doorHtml() : ""}`;
    }
    page.className = moveFocus
      ? direction === "back"
        ? "page-back"
        : "page-in"
      : "";
    $("#back").disabled = path.length <= 1 && !options.onExit;
    const atMain = c.t === "node" && c.id === ROOT;
    $("#map-main").hidden = atMain;
    renderCrumbs();
    placeMap();
    syncMap(moveFocus);
    if (moveFocus) {
      $("#reader").scrollTo({ top: 0 });
      page.querySelector("h1")?.focus({ preventScroll: true });
    }
  }

  // ── Map: Cytoscape draws, a d3 force simulation moves ───────────────
  // The whole record stays on the map as a gray constellation. Navigation only changes which
  // cards are lit (main case, focus, previous step, and the selected tab), so cards keep their
  // places and the camera glides between neighborhoods.
  function wrapLabel(text, max = 22, lines = 3) {
    const out = [];
    let line = "";
    for (const w of text.split(/\s+/)) {
      if ((line + " " + w).trim().length > max && line) {
        out.push(line.trim());
        line = w;
      } else line += " " + w;
    }
    if (line.trim()) out.push(line.trim());
    if (out.length > lines) {
      out.length = lines;
      out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, "") + "…";
    }
    return out;
  }

  // Size cards from the rendered font, so bold serif labels never clip.
  const measure = document.createElement("canvas").getContext("2d");
  function textWidth(text, isRoot) {
    measure.font = isRoot
      ? '700 15px "IBM Plex Serif", Georgia, serif'
      : '400 12px "Albert Sans", sans-serif';
    return Math.ceil(measure.measureText(text).width);
  }

  const ALL_IDS = Object.keys(N).filter(visible);
  function cardData(id) {
    const isRoot = id === ROOT;
    const lines = wrapLabel(N[id].label || N[id].title, isRoot ? 20 : 22);
    const longest = Math.max(...lines.map((l) => textWidth(l, isRoot)));
    const w = longest + (isRoot ? 36 : 26),
      h = lines.length * (isRoot ? 19 : 16) + 20;
    return { id, label: lines.join("\n"), fw: w, fh: h, w, h };
  }

  // Which cards and links are lit for the current view.
  // The map shows at most this many cards from the open tab; the list has the rest.
  const MAP_MAX = 8;
  const mapItems = () => (activeCat()?.items || []).slice(0, MAP_MAX);
  function litSet() {
    const c = cur();
    const focus = focusId();
    const nodes = new Set([focus, ROOT]);
    const edges = new Set();
    if (c.t === "edge") {
      nodes.add(E[c.id].from);
      edges.add(c.id);
    } else
      mapItems().forEach(({ e, dir }) => {
        nodes.add(dir === "in" ? e.from : e.to);
        if ((dir === "in" ? e.to : e.from) === focus) edges.add(e.id); // lists like "Still unanswered" have no link to the focus
      });
    const prev = path.length > 1 ? path[path.length - 2] : null;
    if (prev && prev.t === "node") nodes.add(prev.id);
    // One grayed-out grandchild under each card in the open tab: a hint of what is one level
    // deeper, chosen the same way that card's own page would open (its default tab, first item).
    const hints = new Map();
    if (c.t === "node")
      for (const { e, dir } of mapItems()) {
        const child = dir === "in" ? e.from : e.to;
        const cat = categories(child).find((k) => k.key === defaultTab(child));
        const first = (cat?.items || [])
          .map((it) => ({
            id: it.dir === "in" ? it.e.from : it.e.to,
            edge: it.e.id,
          }))
          .find((g) => visible(g.id) && !nodes.has(g.id) && !hints.has(g.id));
        if (first) hints.set(first.id, { parent: child, edge: first.edge });
      }
    return {
      focus,
      prev: prev?.t === "node" ? prev.id : null,
      nodes,
      edges,
      hints,
    };
  }

  let cy = null,
    sim = null;
  const simById = new Map();
  let follow = 0; // frames left for the camera to glide toward the lit cards quickly
  let manual = false; // the reader panned or zoomed; stop framing until they navigate
  let firstView = true;
  const IDLE = 0.012;

  // ── Card layer: HTML cards that follow Cytoscape's geometry ─────────
  const cardEls = new Map();
  function cardRel(id) {
    const f = focusId();
    if (id === f) return null;
    const e = F.edges.find(
      (x) => (x.from === id && x.to === f) || (x.from === f && x.to === id),
    );
    if (!e || KIDS.has(e.type)) return null;
    return {
      text: e.from === id ? inLabel(e) : outLabel(e),
      tone: TONE_HEX[tone(e)],
    };
  }
  function cardMeta(id) {
    const n = N[id];
    if (id === ROOT) return "Main case";
    if (n.kind === "crux") return cruxState(id).text;
    return srcLabel(n);
  }
  function cardHtml(id) {
    const rel = cardRel(id);
    return `${rel ? `<div class="mrel">${esc(rel.text)}</div>` : ""}<div class="mtitle">${esc(N[id].label || titleOf(id))}</div><div class="mmeta">${esc(cardMeta(id))}</div>`;
  }
  function buildCards() {
    const layer = document.createElement("div");
    layer.id = "cards";
    layer.setAttribute("aria-hidden", "true");
    $("#cy").after(layer);
    for (const id of ALL_IDS) {
      const el = document.createElement("div");
      el.className = `mcard ${N[id].kind}`;
      layer.appendChild(el);
      cardEls.set(id, el);
    }
  }
  function placeCards() {
    const z = cy.zoom();
    cy.nodes().forEach((n) => {
      const el = cardEls.get(n.id());
      if (!el) return;
      const p = n.renderedPosition();
      const d = n.data();
      el.style.transform = `translate(${p.x - (d.fw * z) / 2}px, ${p.y - (d.fh * z) / 2}px) scale(${z})`;
    });
  }
  // Rectangles, not circles: cards pack closely without overlapping.
  function rectCollide() {
    if (!sim) return;
    const lit = sim.nodes().filter((n) => n.lit);
    const pad = 14;
    for (let i = 0; i < lit.length; i++)
      for (let j = i + 1; j < lit.length; j++) {
        const a = lit[i],
          b = lit[j];
        const dx = b.x - a.x || 0.01,
          dy = b.y - a.y || 0.01;
        const ox = (a.w + b.w) / 2 + pad - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + pad - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const wa = a.fx != null ? 0 : b.fx != null ? 1 : 0.5;
        const wb = 1 - wa;
        if (ox < oy) {
          const m = ox * Math.sign(dx);
          a.x -= m * wa;
          b.x += m * wb;
        } else {
          const m = oy * Math.sign(dy);
          a.y -= m * wa;
          b.y += m * wb;
        }
      }
  }

  function initMap() {
    if (!cytoscape) {
      $("#cy").innerHTML =
        `<p class="empty" style="padding:16px">The map couldn't load. The list has the same connections.</p>`;
      return;
    }
    const ease = {
      "transition-duration": REDUCED ? "0ms" : "380ms",
      "transition-timing-function": "ease-in-out-cubic",
    };
    cy = cytoscape({
      container: $("#cy"),
      minZoom: 0.15,
      maxZoom: 2.5,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: false,
      elements: [
        ...ALL_IDS.map((id) => ({
          group: "nodes",
          data: cardData(id),
          classes: N[id].kind,
        })),
        ...F.edges
          .filter((e) => visible(e.from) && visible(e.to))
          .map((e) => ({
            group: "edges",
            data: {
              id: e.id,
              source: e.from,
              target: e.to,
              label: short(e),
              color: TONE_HEX[tone(e)],
            },
          })),
      ],
      style: [
        {
          selector: "node",
          style: {
            shape: "round-rectangle",
            width: "data(w)",
            height: "data(h)",
            "background-color": "#272D3C",
            "border-width": 1,
            "border-color": "rgba(247,244,238,0.18)",
            label: "data(label)",
            "text-wrap": "wrap",
            "text-valign": "center",
            "text-halign": "center",
            color: "#F7F4EE",
            "font-family": "Albert Sans, sans-serif",
            "font-size": 12,
            "line-height": 1.3,
            "underlay-color": "#A5B9FF",
            "underlay-opacity": 0,
            "underlay-padding": 6,
            "underlay-shape": "round-rectangle",
            "transition-property":
              "width, height, background-color, border-color, border-width, opacity, text-opacity, underlay-opacity",
            ...ease,
          },
        },
        // Ghost cards: small, gray, label only when zoomed in.
        // Cards outside the current view fade out and stop taking taps.
        {
          selector: "node.ghost",
          style: {
            opacity: 0,
            "text-opacity": 0,
            events: "no",
            "z-index": 1,
          },
        },
        { selector: "node.lit", style: { "z-index": 10 } },
        {
          selector: "node.branch",
          style: {
            "background-color": "#1B2244",
            "border-color": "rgba(212,175,55,0.55)",
          },
        },
        {
          selector: "node.crux",
          style: {
            "background-color": "#2A2A3E",
            "border-color": "rgba(244,201,93,0.75)",
            "border-width": 1.5,
          },
        },
        {
          selector: "node.global",
          style: {
            "border-style": "dashed",
            "border-color": "rgba(247,244,238,0.55)",
          },
        },
        {
          selector: "node.record",
          style: {
            "border-style": "double",
            "border-width": 4,
            "border-color": "#4A7CFF",
          },
        },
        { selector: "node.trail", style: { opacity: 0.6 } },
        {
          selector: "node.focused",
          style: {
            "background-color": "#323848",
            "border-color": "#D4AF37",
            "border-width": 2.5,
            "font-weight": 600,
            "underlay-color": "#D4AF37",
            "underlay-opacity": 0.12,
          },
        },
        {
          selector: "node.root",
          style: {
            opacity: 1,
            "text-opacity": 1,
            "font-family": "IBM Plex Serif, serif",
            "font-weight": 700,
            "font-size": 15,
            "border-width": 3,
            "border-color": "#D4AF37",
            "background-color": "#232B52",
            "underlay-color": "#D4AF37",
            "underlay-opacity": 0.14,
            "underlay-padding": 8,
            "min-zoomed-font-size": 0,
          },
        },
        { selector: "node:grabbed", style: { "underlay-opacity": 0.22 } },
        {
          selector: "edge",
          style: {
            width: 1,
            "curve-style": "straight",
            "line-color": "#3A4160",
            opacity: 0,
            events: "no",
            "target-arrow-shape": "none",
            label: "",
            "transition-property": "opacity, width, line-color",
            ...ease,
          },
        },
        {
          selector: "edge.lit",
          style: {
            width: 1.7,
            opacity: 1,
            events: "yes",
            "line-color": "data(color)",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "data(color)",
            "arrow-scale": 0.85,
            label: "data(label)",
            "font-size": 10.5,
            "font-weight": 700,
            "font-family": "Albert Sans, sans-serif",
            color: "data(color)",
            "text-background-color": "#0E1530",
            "text-background-opacity": 1,
            "text-background-padding": 3,
            "text-background-shape": "roundrectangle",
          },
        },
        { selector: "edge.current", style: { width: 3.5 } },
        {
          selector: "edge.lit.hint",
          style: {
            opacity: 0.35,
            "line-color": "#4A5068",
            "target-arrow-color": "#4A5068",
            "line-style": "dashed",
          },
        },
        {
          selector: "node.peeked",
          style: { "border-color": "#F7F4EE", "border-width": 2.5 },
        },
        { selector: "edge.peeked", style: { width: 4 } },
        { selector: "node:selected", style: { "overlay-opacity": 0 } },
        // Cytoscape keeps the geometry, taps and drags; the HTML card layer draws the cards.
        {
          selector: "node",
          style: {
            "background-opacity": 0,
            "border-opacity": 0,
            "text-opacity": 0,
            "underlay-opacity": 0,
            label: "",
          },
        },
        { selector: "edge", style: { label: "" } },
      ],
    });
    buildCards();
    cy.on("render", placeCards);
    // Cytoscape caches where its container sits on screen and only refreshes that on window
    // scroll. The reader scrolls inside its own panel, so without this every tap after
    // scrolling lands where the map used to be.
    let remeasure = 0;
    const refreshOffset = () => {
      if (remeasure) return;
      remeasure = requestAnimationFrame(() => {
        remeasure = 0;
        cy.resize();
      });
    };
    $("#reader").addEventListener("scroll", refreshOffset, {
      passive: true,
    });
    listen(window).addEventListener("scroll", refreshOffset, { passive: true });
    cy.on("tap", "node", (ev) => peekNode(ev.target.id()));
    cy.on("tap", "edge", (ev) => peekEdge(ev.target.id()));
    // Dragging pins a card to the pointer and lets the rest of the web follow, like Obsidian.
    cy.on("grab", "node", (ev) => {
      follow = 0;
      const s = simById.get(ev.target.id());
      if (s && sim) {
        s.fx = s.x;
        s.fy = s.y;
        sim.alphaTarget(0.3).restart();
      }
    });
    cy.on("drag", "node", (ev) => {
      const s = simById.get(ev.target.id());
      if (s) {
        const p = ev.target.position();
        s.fx = p.x;
        s.fy = p.y;
      }
    });
    cy.on("free", "node", (ev) => {
      const s = simById.get(ev.target.id());
      if (!s || !sim) return;
      if (ev.target.id() !== focusId()) {
        s.fx = null;
        s.fy = null;
      }
      sim.alphaTarget(REDUCED ? 0 : IDLE);
    });
    // Any manual pan or zoom hands the camera back to the reader.
    $("#cy").addEventListener(
      "wheel",
      () => {
        follow = 0;
        manual = true;
      },
      { passive: true },
    );
    $("#cy").addEventListener(
      "touchstart",
      (ev) => {
        if (ev.touches.length > 1) {
          follow = 0;
          manual = true;
        }
      },
      { passive: true },
    );
    cy.on("dragpan", () => {
      follow = 0;
      manual = true;
    });
    $("#zoom-in").addEventListener("click", () => {
      follow = 0;
      manual = true;
      zoomBy(1.25);
    });
    $("#zoom-out").addEventListener("click", () => {
      follow = 0;
      manual = true;
      zoomBy(0.8);
    });
    $("#zoom-fit").addEventListener("click", () => {
      follow = 0;
      manual = false;
      cy.animate(
        { fit: { eles: cy.nodes(".lit"), padding: 30 } },
        { duration: REDUCED ? 0 : 500, easing: "ease-in-out-cubic" },
      );
    });

    if (d3) {
      const nodes = ALL_IDS.map((id, i) => {
        const a = (i / ALL_IDS.length) * Math.PI * 2;
        const s = {
          id,
          phase: Math.random() * Math.PI * 2,
          x: Math.cos(a) * 400,
          y: Math.sin(a) * 300,
          r: 40,
        };
        simById.set(id, s);
        return s;
      });
      const links = F.edges
        .filter((e) => visible(e.from) && visible(e.to))
        .map((e) => ({ id: e.id, source: e.from, target: e.to }));
      sim = d3
        .forceSimulation(nodes)
        .velocityDecay(0.42)
        .force(
          "charge",
          d3
            .forceManyBody()
            .strength((d) => (d.lit ? -300 : 0))
            .distanceMax(520),
        )
        .force(
          "link",
          d3.forceLink(links).id((d) => d.id),
        )
        .force("rect", rectCollide)
        .force(
          "x",
          d3.forceX(0).strength((d) => (d.lit ? 0.015 : 0)),
        )
        .force(
          "y",
          d3.forceY(0).strength((d) => (d.lit ? 0.02 : 0)),
        )
        .force("wander", wander)
        .on("tick", ticked);
      sim.stop();
    }
  }

  function wander() {
    if (REDUCED || !sim) return;
    const t = performance.now() / 1000;
    for (const n of sim.nodes()) {
      if (n.fx != null || !n.lit) continue;
      n.vx += Math.sin(t * 0.7 + n.phase) * 0.04;
      n.vy += Math.cos(t * 0.55 + n.phase * 1.7) * 0.04;
    }
  }

  function ticked() {
    cy.batch(() => {
      for (const n of sim.nodes()) {
        const el = cy.getElementById(n.id);
        if (!el.grabbed()) el.position({ x: n.x, y: n.y });
      }
    });
    if (follow > 0) {
      follow--;
      glide(0.09);
    } else if (!manual) glide(0.03);
  }

  // Camera target: frame the lit cards, never closer than reading size.
  function targetView() {
    const lit = cy.nodes(".lit");
    const bb = (lit.nonempty() ? lit : cy.nodes()).boundingBox();
    const W = cy.width(),
      H = cy.height(),
      pad = 40;
    let z = Math.min(
      (W - 2 * pad) / Math.max(bb.w, 1),
      (H - 2 * pad) / Math.max(bb.h, 1),
    );
    z = Math.min(z, 1);
    // Below this the card text stops being readable; frame the focus instead and let the rest run off-edge.
    const READABLE = 0.6;
    let cx = bb.x1 + bb.w / 2,
      cyy = bb.y1 + bb.h / 2;
    if (z < READABLE) {
      z = READABLE;
      const f = cy.getElementById(focusId()).position();
      cx = f.x;
      cyy = f.y;
    }
    return {
      zoom: z,
      pan: { x: W / 2 - z * cx, y: H / 2 - z * cyy },
    };
  }
  function glide(k) {
    const t = targetView();
    const z = cy.zoom(),
      p = cy.pan();
    cy.viewport({
      zoom: z + (t.zoom - z) * k,
      pan: { x: p.x + (t.pan.x - p.x) * k, y: p.y + (t.pan.y - p.y) * k },
    });
  }

  function syncMap(navigated) {
    if (!cy) return;
    const { focus, prev, nodes, edges, hints } = litSet();
    const extra =
      cur().t === "node" ? (activeCat()?.items.length ?? 0) - MAP_MAX : 0;
    $("#map-more").hidden = extra <= 0;
    $("#map-more").textContent = `+${extra} more in List`;
    for (const [id, { edge }] of hints) {
      nodes.add(id);
      edges.add(edge);
    }
    for (const [id, el] of cardEls) {
      const lit = nodes.has(id);
      el.className = [
        "mcard",
        N[id].kind,
        id === ROOT ? "root" : "",
        lit ? "lit" : "",
        id === focus ? "focused" : "",
        id === prev && id !== ROOT ? "trail" : "",
        hints.has(id) ? "hint" : "",
      ].join(" ");
      if (!lit) continue;
      el.innerHTML = cardHtml(id);
      el.style.setProperty("--tone", cardRel(id)?.tone || "var(--hair3)");
      // Measured at scale 1 while visible; the card layer is hidden in list view.
      if (el.offsetWidth) {
        const node = cy.getElementById(id);
        node.data({ fw: el.offsetWidth, fh: el.offsetHeight });
      }
    }
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const id = n.id();
        const lit = nodes.has(id);
        const d = n.data();
        n.data({ w: lit ? d.fw : 30, h: lit ? d.fh : 14 });
        n.classes(
          [
            N[id].kind,
            lit ? "lit" : "ghost",
            id === focus ? "focused" : "",
            id === prev && id !== ROOT ? "trail" : "",
          ].join(" "),
        );
      });
      cy.edges().forEach((e) => {
        const lit =
          edges.has(e.id()) ||
          (nodes.has(e.source().id()) &&
            nodes.has(e.target().id()) &&
            (e.source().id() === focus || e.target().id() === focus));
        e.classes(
          [
            hints.has(e.source().id()) || hints.has(e.target().id())
              ? "hint"
              : "",
            lit ? "lit" : "",
            cur().t === "edge" && cur().id === e.id() ? "current" : "",
          ].join(" "),
        );
      });
    });
    if (!sim) {
      cy.layout({
        name: "cose",
        animate: !REDUCED,
        fit: true,
        padding: 30,
      }).run();
      return;
    }

    // Newly shown cards start on the card you tapped and spread out from there.
    const fresh = new Set(); // cards appearing in this view
    for (const s of sim.nodes()) {
      const lit = nodes.has(s.id);
      if (lit && !s.lit) fresh.add(s.id);
      s.lit = lit;
      const d = cy.getElementById(s.id).data();
      s.r = lit ? Math.min(d.w, d.h * 2) / 2 : 0;
      s.w = lit ? d.w : 0;
      s.h = lit ? d.h : 0;
      s.fx = s.id === focus ? s.x : null;
      s.fy = s.id === focus ? s.y : null;
    }
    sim.force("charge").strength((d) => (d.lit ? -240 : 0));
    // Radial: the focus in the middle, where you came from above it, and the open tab's cards in
    // a ring around it in tab order, each grayed grandchild further out on the same spoke.
    const fpos = simById.get(focus) || { x: 0, y: 0 };
    const spot = new Map([[focus, [fpos.x, fpos.y]]]);
    const at = (deg, r) => [
      fpos.x + r * Math.cos((deg * Math.PI) / 180),
      fpos.y + r * Math.sin((deg * Math.PI) / 180) * 0.9,
    ];
    const above = [ROOT, prev].filter((id) => id && id !== focus);
    above.forEach((id, i) =>
      spot.set(id, at(-90 + (above.length > 1 ? (i ? 22 : -22) : 0), 190)),
    );
    const ring = [...nodes].filter((id) => !spot.has(id) && !hints.has(id));
    const order = (activeCat()?.items || []).map(({ e, dir }) =>
      dir === "in" ? e.from : e.to,
    );
    ring.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    // Leave the top of the circle to the context cards when there are any.
    const gap = above.length ? 50 : 0;
    const span = 360 - 2 * gap;
    const radius = Math.max(210, ring.length * 52);
    const angleOf = new Map();
    ring.forEach((id, i) => {
      const deg =
        ring.length === 1
          ? 90
          : -90 + gap + (span * (i + (above.length ? 0.5 : 0))) / ring.length;
      angleOf.set(id, deg);
      spot.set(id, at(deg, radius));
    });
    for (const [id, { parent }] of hints)
      spot.set(id, at(angleOf.get(parent) ?? 90, radius + 175));
    // New cards grow out of the focus toward their spot. Cards cannot pass through each other,
    // so a card on the far side of the focus from its spot starts most of the way there instead.
    for (const [id, [tx, ty]] of spot) {
      const s = simById.get(id);
      if (!s || id === focus) continue;
      const across =
        (s.x - fpos.x) * (tx - fpos.x) + (s.y - fpos.y) * (ty - fpos.y) < 0;
      if (!fresh.has(id) && !across) continue;
      s.x = fpos.x + (tx - fpos.x) * 0.75;
      s.y = fpos.y + (ty - fpos.y) * 0.75;
      s.vx = 0;
      s.vy = 0;
      cy.getElementById(id).position({ x: s.x, y: s.y });
    }
    sim.force(
      "x",
      d3
        .forceX((d) => spot.get(d.id)?.[0] ?? 0)
        .strength((d) => (d.lit ? 0.12 : 0)),
    );
    sim.force(
      "y",
      d3
        .forceY((d) => spot.get(d.id)?.[1] ?? 0)
        .strength((d) => (d.lit ? 0.12 : 0)),
    );
    sim
      .force("link")
      .distance(
        (l) =>
          (l.source.h + l.target.h) / 2 +
          (l.source.id === focus || l.target.id === focus ? 60 : 80),
      )
      .strength((l) =>
        !l.source.lit || !l.target.lit
          ? 0
          : l.source.id === focus || l.target.id === focus
            ? 0.6
            : 0.12,
      );
    // Keep the main case near whatever you're reading.
    sim.force("tether", (alpha) => {
      if (focus === ROOT) return;
      const r = simById.get(ROOT),
        f = simById.get(focus);
      if (!r || !f) return;
      const dx = f.x - r.x,
        dy = f.y - r.y,
        dist = Math.hypot(dx, dy) || 1,
        want = r.r + f.r + 120;
      if (dist > want) {
        const k = ((dist - want) / dist) * 0.04 * alpha;
        r.vx += dx * k;
        r.vy += dy * k;
      }
    });

    if (firstView || REDUCED) {
      sim.alpha(1);
      for (let i = 0; i < (firstView ? 400 : 120); i++) sim.tick();
      ticked();
      const t = targetView();
      cy.viewport(t);
      firstView = false;
      if (!REDUCED) sim.alpha(0.05).alphaTarget(IDLE).restart();
      return;
    }
    sim
      .alpha(navigated ? 0.35 : 0.25)
      .alphaTarget(IDLE)
      .restart();
    follow = 110;
    manual = false;
  }

  function fitView() {
    if (!cy) return;
    follow = 0;
    cy.animate(targetView(), {
      duration: REDUCED ? 0 : 450,
      easing: "ease-in-out-cubic",
    });
  }
  function zoomBy(f) {
    cy.animate(
      {
        zoom: {
          level: cy.zoom() * f,
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
        },
      },
      { duration: REDUCED ? 0 : 200 },
    );
  }

  // One map instance moves between the phone slot, the desktop canvas, and full screen.
  const mapEl = $("#map");
  function placeMap() {
    if (mapEl.classList.contains("full")) return;
    const slot = false ? $("#canvas-slot") : $("#phone-slot");
    if (slot && mapEl.parentElement !== slot) slot.appendChild(mapEl);
    if (cy) cy.resize();
  }
  function setFull(on) {
    mapEl.classList.toggle("full", on);
    if (on) root.appendChild(mapEl);
    else placeMap();
    if (cy) {
      cy.resize();
      fitView();
    }
    (on ? $("#map-close") : $("#map-expand")).focus();
  }
  $("#map-expand").addEventListener("click", () => setFull(true));
  $("#map-close").addEventListener("click", () => setFull(false));

  // ── Sheets: source and composer ─────────────────────────────────────
  let lastTrigger = null;
  function openSheet(html, light = false) {
    lastTrigger = document.activeElement;
    $("#layer").innerHTML =
      `<div class="scrim${light ? " light" : ""}" data-scrim><div class="sheet${light ? " peek" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${html}</div></div>`;
    (
      $("#layer").querySelector(".peek .actions .btn") ||
      $("#layer").querySelector("button, textarea, input")
    )?.focus({ preventScroll: true });
  }
  function closeSheet() {
    $("#layer").innerHTML = "";
    cy?.elements(".peeked").removeClass("peeked");
    document
      .querySelectorAll(".mcard.peeked")
      .forEach((el) => el.classList.remove("peeked"));
    if (lastTrigger?.isConnected) lastTrigger.focus();
  }

  // A peek shows what a card says and how it relates to where the reader is, without moving them.
  function relationTo(id) {
    const f = focusId();
    // Prefer the card's link to where the reader is; otherwise say what it bears on.
    const e =
      outgoing(id).find((x) => x.to === f) ||
      outgoing(id).find((x) => visible(x.to) && !KIDS.has(x.type)) ||
      outgoing(id).find((x) => visible(x.to));
    if (!e) return "";
    const label =
      e.to === f
        ? inLabel(e)
        : `${outLabel(e).replace(/ on$/, "")} · ${N[e.to].label || titleOf(e.to)}`;
    if (!label) return ""; // structural links like "Part of" the focus say nothing new
    return `<div class="rel" style="--tone:${TONE_HEX[tone(e)]}">${esc(label)}</div>`;
  }
  function peekNode(id, fromRing = false) {
    const n = N[id];
    const src = n.source || {};
    // Show what is inside, not just how much: the first few cards of its opening tab.
    const cats = categories(id).filter((c) => c.items.length);
    const open = cats.find((c) => c.key === defaultTab(id)) || cats[0];
    const inside = open
      ? `<div class="inside"><p class="inside-h">${esc(open.label)} · ${open.items.length}</p>${open.items
          .slice(0, 3)
          .map(({ e, dir }) => {
            const other = dir === "in" ? e.from : e.to;
            const rel = KIDS.has(e.type)
              ? ""
              : dir === "in"
                ? inLabel(e)
                : outLabel(e);
            return `<button type="button" class="inside-row" data-peek="${other}" style="--tone:${TONE_HEX[tone(e)]}">${rel ? `<span class="inside-rel">${esc(rel)}</span>` : ""}<span>${esc(N[other].label || titleOf(other))}</span></button>`;
          })
          .join(
            "",
          )}${open.items.length > 3 ? `<p class="inside-more">+${open.items.length - 3} more</p>` : ""}</div>`
      : "";
    const here = id === focusId();
    cardEls.get(id)?.classList.add("peeked");
    openSheet(
      `${relationTo(id)}
          <p class="meta" style="margin:0 0 6px">${esc(id === ROOT ? "Main case" : n.kind === "argument" ? src.label : n.kind === "crux" ? cruxState(id).text : KIND[n.kind])}</p>
          <h2 id="sheet-title" class="${N[id].title?.includes("**") ? "stmt" : ""}">${titleHtml(id)}</h2>
          ${n.body ? `<p class="body">${esc(n.body)}</p>` : ""}
          ${n.quote ? `<blockquote class="quote"><span class="clamp">“${esc(n.quote)}”</span><footer><span>${esc(src.locator)}</span></footer></blockquote>` : ""}
          ${inside}
          ${fromRing ? `<button class="linkish" type="button" data-ring style="margin:0 0 10px">‹ Back to the whole debate</button>` : ""}<div class="actions">${here ? `<button class="btn ghost" type="button" data-close>You're here · Close</button>` : `<button class="btn ghost" type="button" data-close>Close</button><button class="btn primary" type="button" data-node="${id}">Go to this ›</button>`}</div>`,
      true,
    );
  }
  // Structural links carry no written reason, so say in plain words what the link means.
  const STRUCTURE = {
    part: "One of the four basics every record starts from.",
    detail: "Part of what this section covers.",
    crux: "One of the questions people disagree about on this measure.",
  };
  function endCard(id, role) {
    return `<button type="button" class="end" data-peek="${id}"><span class="end-role">${role}</span><span class="end-title">${titleHtml(id)}</span><span class="end-meta">${esc(cardMeta(id))}</span></button>`;
  }
  function peekEdge(eid) {
    const e = E[eid];
    cy?.$id(eid).addClass("peeked");
    const label = e.type === "weighs" ? LEAN[e.stance] : OUT[e.type];
    const why = e.why || STRUCTURE[e.type] || "";
    openSheet(
      `<div class="rel" style="--tone:${TONE_HEX[tone(e)]}">The link · ${esc(label)}</div>
          <h2 id="sheet-title">${esc(label)} “${esc(N[e.to].label || titleOf(e.to))}”</h2>
          <div class="ends">${endCard(e.from, "From")}<span class="end-arrow" style="color:${TONE_HEX[tone(e)]}" aria-hidden="true">↓ ${esc(label)}</span>${endCard(e.to, "To")}</div>
          ${why ? `<p class="why"><strong>${e.why ? "Why the link holds" : "What this link means"}</strong>${esc(why)}</p>` : ""}
          ${e.why ? `<p class="counts">A link is its own claim: it can be challenged even if both cards are true.</p>` : ""}
          <div class="actions"><button class="btn ghost" type="button" data-close>Close</button><button class="btn primary" type="button" data-edge="${eid}">Open this link ›</button></div>`,
      true,
    );
  }

  function openSource(id) {
    const n = N[id];
    const s = n.source;
    openSheet(`<div class="sheet-head"><h2 id="sheet-title">${esc(s.label)}</h2><button class="close" type="button" data-close>Close</button></div>
      <p class="meta" style="margin:0 0 10px">${esc(s.locator)}</p>
      <blockquote class="quote">“${esc(n.quote)}”</blockquote>
      ${s.signers ? `<p class="note" style="margin-top:12px">Signed by ${esc(s.signers)}</p>` : ""}
      <p class="empty" style="margin-top:12px">Billion matched this passage to the official document. A matched quote shows what the source says. It does not show that a claim built on it is correct.</p>
      ${s.url ? `<div class="actions"><a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener">Open official source</a></div>` : ""}`);
  }

  const ACTIONS = [
    { v: "supports", label: "A reason", verb: "supports", tone: "for" },
    {
      v: "challenges",
      label: "A challenge",
      verb: "challenges",
      tone: "against",
    },
    {
      v: "qualifies",
      label: "A condition",
      verb: "qualifies",
      tone: "mixed",
    },
    {
      v: "asks",
      label: "A question",
      verb: "asks about",
      tone: "question",
    },
  ];
  function openComposer() {
    const c = cur();
    const targetText =
      c.t === "edge"
        ? `The link: “${titleOf(E[c.id].from)}” ${short(E[c.id])} “${titleOf(E[c.id].to)}”`
        : titleOf(c.id);
    openSheet(`<div class="sheet-head"><h2 id="sheet-title">Add to the argument</h2><button class="close" type="button" data-close>Cancel</button></div>
      <div class="field"><span>You're responding to</span><div class="target">${esc(targetText)}</div></div>
      <fieldset class="field" style="border:0;padding:0;margin-inline:0"><legend style="font-size:13px;font-weight:700;padding:0;margin-bottom:6px">What are you adding?</legend>
        <div class="seg">${ACTIONS.map((a, i) => `<label class="r-${a.tone}"><input type="radio" name="act" id="act-${a.v}" value="${a.v}"${i === 1 ? " checked" : ""}><span>${a.label}</span></label>`).join("")}</div>
      </fieldset>
      <label class="field" for="claim"><span>Your claim or question</span>
        <textarea id="claim" placeholder="One statement. Split independent points into separate contributions."></textarea>
        <small>Already said? Reuse the existing claim so the debate stays in one place.</small>
      </label>
      <div class="similar" id="similar"></div>
      <label class="field" for="why"><span>Why does it connect?</span>
        <textarea id="why" placeholder="Explain how this bears on the target. Readers will argue with this explanation."></textarea>
      </label>
      <label class="field" for="src"><span>Source (optional)</span>
        <input type="text" id="src" placeholder="Link and the exact passage or page">
        <small>Leave blank rather than guess. Unsourced claims are labeled as unsourced.</small>
      </label>
      <p class="error" id="err" hidden></p>
      <div class="actions"><button class="btn primary" type="button" id="preview">Preview</button></div>
      <div id="preview-box"></div>`);
    let reuse = null;
    const claim = $("#claim"),
      sim2 = $("#similar");
    const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9$]{4,}/g) || []);
    claim.addEventListener("input", () => {
      reuse = null;
      const w = words(claim.value);
      if (w.size < 2) {
        sim2.innerHTML = "";
        return;
      }
      const hits = Object.entries(N)
        .filter(
          ([id, n]) => visible(id) && !["branch", "root"].includes(n.kind),
        )
        .map(([id, n]) => [
          id,
          [...words(n.title)].filter((x) => w.has(x)).length,
        ])
        .filter(([, s]) => s >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      sim2.innerHTML = hits.length
        ? `<small style="color:var(--quiet)">Similar claims already here</small>` +
          hits
            .map(
              ([id]) =>
                `<div class="s"><span>${esc(titleOf(id))}</span><button type="button" data-reuse="${id}">Reuse</button></div>`,
            )
            .join("")
        : "";
    });
    sim2.addEventListener("click", (ev) => {
      const id = ev.target.dataset.reuse;
      if (!id) return;
      reuse = id;
      claim.value = titleOf(id);
      sim2.innerHTML = `<div class="dup"><strong>Reusing an existing claim</strong><span>Its original attribution stays. Explain why it applies to this target.</span></div>`;
    });
    $("#preview").addEventListener("click", () => {
      const act = document.querySelector('input[name="act"]:checked').value;
      const missing = !claim.value.trim()
        ? "Write the claim or question you're adding."
        : act !== "asks" && !$("#why").value.trim()
          ? "Explain why it connects. A link without a reason can't be examined."
          : "";
      $("#err").hidden = !missing;
      $("#err").textContent = missing;
      if (missing) return;
      const a = ACTIONS.find((x) => x.v === act);
      $("#preview-box").innerHTML = `<div class="preview">
          <div class="meta"><span class="kind">Reader contribution</span><span>you</span>${reuse ? "<span>· reusing an existing claim</span>" : ""}</div>
          <div style="font:600 16px/1.35 var(--display)">${esc(claim.value)}</div>
          <div class="r-${a.tone}"><span class="relchip static">${esc(a.verb)}</span> <span class="meta" style="display:inline">${esc(targetText)}</span></div>
          ${$("#why").value.trim() ? `<p class="body" style="margin:0">${esc($("#why").value)}</p>` : ""}
          <p class="empty">Public once published, attributed to your account. In this prototype nothing is published or saved.</p>
          <div class="actions" style="margin-top:4px"><button class="btn ghost" type="button" data-close>Keep editing later</button><button class="btn primary" type="button" id="publish">Publish contribution</button></div>
        </div>`;
      $("#publish").addEventListener("click", () => {
        closeSheet();
        toast("Simulated. Nothing was published.");
      });
      $("#publish").focus();
    });
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ── Events ──────────────────────────────────────────────────────────
  listen(document).addEventListener("click", (ev) => {
    const v = ev.target.closest("[data-view]");
    if (v) {
      view = v.dataset.view;
      render(false);
      return;
    }
    const t = ev.target.closest(
      "[data-prop],[data-term],[data-peek],[data-ring],[data-summary-sources],[data-node],[data-edge],[data-crumb],[data-source],[data-close],[data-scrim],[data-more],[data-tab]",
    );
    if (!t) return;
    if (t.hasAttribute("data-scrim") && ev.target !== t) return;
    if (t.dataset.prop) {
      if ($("#layer").innerHTML) closeSheet();
      openMeasure(t.dataset.prop);
    } else if (t.dataset.term) openTerm(t.dataset.term);
    else if (t.dataset.peek)
      peekNode(t.dataset.peek, !!t.closest(".ring-sheet"));
    else if (t.hasAttribute("data-ring")) openRing();
    else if (t.dataset.node) {
      if ($("#layer").innerHTML) closeSheet();
      go({ t: "node", id: t.dataset.node });
    } else if (t.dataset.edge) {
      if ($("#layer").innerHTML) closeSheet();
      go({ t: "edge", id: t.dataset.edge });
    } else if (t.dataset.crumb) {
      path = path.slice(0, Number(t.dataset.crumb) + 1);
      direction = "back";
      tab = defaultTab(focusId());
      render(true);
    } else if (t.dataset.source) openSource(t.dataset.source);
    else if (t.hasAttribute("data-summary-sources")) openSummarySources();
    else if (t.dataset.more) {
      shown.add(t.dataset.more);
      render(false);
    } else if (t.dataset.tab) {
      tab = t.dataset.tab;
      render(false);
      document.querySelector(`[data-tab="${tab}"]`)?.focus();
    } else closeSheet();
  });
  // Desktop: hovering a slice names it in place; a click still only previews.
  listen(document).addEventListener("mouseover", (ev) => {
    const t = ev.target.closest?.(".ring-sheet [data-peek]");
    const out = $("#ov-hover");
    if (!out) return;
    // The line is always present, so the drawer never shifts while hovering.
    out.classList.toggle("is-empty", !t);
    out.textContent = t
      ? titleOf(t.dataset.peek)
      : "Tap a slice to see what it is";
  });
  listen(document).addEventListener("keydown", (ev) => {
    const measureLink = ev.target.closest?.("[data-prop]");
    if (measureLink && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      openMeasure(measureLink.dataset.prop);
      return;
    }
    const term = ev.target.closest?.("[data-term]");
    if (term && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      openTerm(term.dataset.term);
      return;
    }
    if (ev.key === "Escape") {
      if ($("#layer").innerHTML) closeSheet();
      else if (mapEl.classList.contains("full")) setFull(false);
      return;
    }
    const t = ev.target.closest?.("[role=tab]");
    if (t && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) {
      const all = [...document.querySelectorAll("[role=tab]")];
      const next =
        all[
          (all.indexOf(t) + (ev.key === "ArrowRight" ? 1 : all.length - 1)) %
            all.length
        ];
      next.click();
    }
  });
  $("#back").addEventListener("click", back);
  $("#map-main").addEventListener("click", goMain);
  $("#map-ring").addEventListener("click", openRing);
  $("#map-more").addEventListener("click", () => {
    if (mapEl.classList.contains("full")) setFull(false);
    view = "list";
    render(false);
  });
  $("#notice").addEventListener("click", () => {
    const open = $("#notice").getAttribute("aria-expanded") !== "true";
    $("#notice").setAttribute("aria-expanded", String(open));
    $("#notice").setAttribute(
      "aria-label",
      open
        ? "Hide details about Billion AI authorship"
        : "Show details about Billion AI authorship",
    );
    $("#notice .notice-text").hidden = !open;
    $("#notice .notice-action").textContent = open ? "Hide" : "Details";
  });
  // Mockup controls: jump straight to the states worth reviewing.
  function jump(j) {
    if (mapEl.classList.contains("full") && j !== "map") setFull(false);
    const root = { t: "node", id: ROOT };
    const steps = {
      main: [[root], "basics"],
      disagree: [[root], "disagree"],
      crux: [[root, { t: "node", id: "x-expand" }], "args"],
      provision: [
        [root, { t: "node", id: "b-what" }, { t: "node", id: "t-amend" }],
        null,
      ],
      link: [
        [
          root,
          { t: "node", id: "x-expand" },
          { t: "node", id: "a-expand" },
          { t: "edge", id: "e72" },
        ],
        null,
      ],
      map: [[root, { t: "node", id: "x-revenue" }], "args"],
    }[j];
    path = steps[0];
    tab = steps[1] ?? defaultTab(focusId());
    direction = "in";
    render(true);
    if (j === "map") {
      view = "map";
      render(false);
      setTimeout(() => setFull(true), 350);
    } else if (view === "map") {
      view = "list";
      render(false);
    }
  }
  let rt;
  listen(window).addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      placeMap();
      fitView();
    }, 120);
  });

  const start = () => {
    initMap();
    render(false);
  };
  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
  // In the app, external links open in the system browser.
  root.addEventListener("click", (ev) => {
    const a = ev.target.closest?.("a[href^='http']");
    if (a && options.onOpenUrl) {
      ev.preventDefault();
      options.onOpenUrl(a.href);
    }
  });
  if (graph.verification?.state === "verified") $("#notice").hidden = true;
  function destroy() {
    lifetime.abort();
    sim?.stop();
    cy?.destroy();
    root.innerHTML = "";
    delete root.__trillion;
  }
  const api = { jump, destroy };
  root.__trillion = api;
  return api;
}
