import MarkdownIt from "markdown-it";

/**
 * Long-form articles and deep dives are stored as Markdown. Raw HTML in the
 * source is not rendered (`html: false`), so pipeline text can never inject
 * markup; links open in a new tab since they leave Billion.
 */
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const defaultLink =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  token?.attrSet("target", "_blank");
  token?.attrSet("rel", "noopener noreferrer");
  return defaultLink(tokens, idx, options, env, self);
};

export function Markdown({ source }: { source: string }) {
  return (
    <div
      className="reader-prose"
      dangerouslySetInnerHTML={{ __html: md.render(source) }}
    />
  );
}

/** The phone's test for "this is Markdown, render it as such". */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s/m.test(text) ||
    /\[[^\]]+\]\((https?:\/\/|\/)/.test(text) ||
    /(^|\n)([-*+]|\d+\.)\s/m.test(text) ||
    /(^|\n)>\s/m.test(text) ||
    /!\[[^\]]*\]\(/.test(text) ||
    text.includes("```")
  );
}
