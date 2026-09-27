/**
 * Briefs mark the useful phrase in a sentence with `**bold**`. Render those
 * spans as <strong>, and everything else as text — never as HTML.
 */
export function Emphasis({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="text-ink-night font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
