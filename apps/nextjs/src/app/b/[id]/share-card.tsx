import type { ShareableContent } from "./share-copy";
import { headerImage, presentType, shareSummary, truncate } from "./share-copy";

/**
 * The images a shared bill turns into.
 *
 * Two shapes, one card: the 1200×630 preview a link unfurls into, and the
 * 1080×1920 image someone posts to an Instagram story. They carry the same
 * three things — what the record is, what it does, and where to read it —
 * because both are seen for about a second by someone who was scrolling.
 *
 * Rendered by Satori, so this is flexbox and inline styles only: no CSS
 * variables, no cascade, and every container states `display: flex`.
 */

const NAVY = "#0E1530";
const SLATE = "#272D3C";
const WHITE = "#FFFFFF";
const MUTED = "#8A8FA0";
const HAIRLINE = "rgba(255,255,255,0.10)";

const SERIF = '"IBM Plex Serif", serif';
const SANS = '"Albert Sans", sans-serif';

/**
 * Satori fetches remote images itself, and a slow or missing thumbnail host
 * would take the whole card down with it. Header art is an inline `data:` URI
 * for most records anyway, so only those are drawn.
 */
function inlineArt(content: ShareableContent): string | undefined {
  const uri = headerImage(content);
  return uri?.startsWith("data:") ? uri : undefined;
}

function Wordmark({ size }: { size: number }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: SERIF,
        fontWeight: 700,
        fontSize: size,
        color: WHITE,
        letterSpacing: -size * 0.02,
      }}
    >
      Billion
    </div>
  );
}

function Badge({
  label,
  color,
  size,
}: {
  label: string;
  color: string;
  size: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        backgroundColor: `${color}26`,
        border: `1px solid ${color}`,
        borderRadius: size * 1.4,
        paddingTop: size * 0.42,
        paddingBottom: size * 0.42,
        paddingLeft: size * 0.9,
        paddingRight: size * 0.9,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: size * 0.09,
        color,
      }}
    >
      {label}
    </div>
  );
}

/** The 1200×630 card a link unfurls into. */
export function OgCard({ content }: { content: ShareableContent }) {
  const type = presentType(content.type);
  const art = inlineArt(content);
  // Sized for the worst case this canvas has to hold: a four-line headline
  // and header art, on 630px of height that cannot scroll.
  const summary = truncate(shareSummary(content), art ? 130 : 165);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: NAVY,
        padding: 56,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark size={34} />
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontSize: 22,
            color: MUTED,
          }}
        >
          {type.kind}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 44,
          paddingTop: 30,
          paddingBottom: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Badge label={type.label} color={type.color} size={20} />
            {content.billNumber ? (
              <div
                style={{
                  display: "flex",
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: 0.6,
                  color: MUTED,
                }}
              >
                {content.billNumber}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 46,
              lineHeight: 1.14,
              letterSpacing: -0.8,
              color: WHITE,
            }}
          >
            {truncate(content.title, 105)}
          </div>

          {summary ? (
            <div
              style={{
                display: "flex",
                fontFamily: SANS,
                fontSize: 24,
                lineHeight: 1.42,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {summary}
            </div>
          ) : null}
        </div>

        {art ? (
          // Satori draws this into a PNG; next/image has no part in it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            width={260}
            height={260}
            style={{
              width: 260,
              height: 260,
              borderRadius: 26,
              objectFit: "cover",
              border: `1px solid ${HAIRLINE}`,
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 24,
            color: WHITE,
          }}
        >
          What your government is actually doing.
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontSize: 24,
            color: type.color,
          }}
        >
          billion-news.app
        </div>
      </div>
    </div>
  );
}

/** The 1080×1920 image for an Instagram story. */
export function StoryCard({ content }: { content: ShareableContent }) {
  const type = presentType(content.type);
  const art = inlineArt(content);
  const summary = truncate(shareSummary(content), 220);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: NAVY,
        // Instagram lays its own chrome over the top and bottom of a story —
        // roughly 250px each at this size — so everything that has to be read
        // is kept inside the middle band rather than centred on the canvas.
        paddingTop: 260,
        paddingBottom: 270,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Wordmark size={56} />
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontSize: 28,
            letterSpacing: 1,
            color: MUTED,
          }}
        >
          {type.kind}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          paddingTop: 44,
          paddingBottom: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 34,
            backgroundColor: SLATE,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 44,
            padding: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Badge label={type.label} color={type.color} size={26} />
            {content.billNumber ? (
              <div
                style={{
                  display: "flex",
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: 0.8,
                  color: MUTED,
                }}
              >
                {content.billNumber}
              </div>
            ) : null}
          </div>

          {art ? (
            // Satori draws this into a PNG; next/image has no part in it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              width={792}
              height={320}
              style={{
                width: "100%",
                height: 320,
                borderRadius: 28,
                objectFit: "cover",
                border: `1px solid ${HAIRLINE}`,
              }}
            />
          ) : null}

          <div
            style={{
              display: "flex",
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 68,
              lineHeight: 1.12,
              letterSpacing: -1.5,
              color: WHITE,
            }}
          >
            {truncate(content.title, 120)}
          </div>

          {summary ? (
            <div
              style={{
                display: "flex",
                fontFamily: SANS,
                fontSize: 34,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.74)",
              }}
            >
              {summary}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 96,
            height: 5,
            borderRadius: 3,
            backgroundColor: type.color,
          }}
        />
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 34,
            color: WHITE,
          }}
        >
          Read the whole thing on Billion
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: SANS,
            fontSize: 30,
            color: MUTED,
          }}
        >
          billion-news.app
        </div>
      </div>
    </div>
  );
}
