import type { QrCode } from "./qr";
import styles from "./flyer.module.css";

const DARK = "#0E1530";
const LIGHT = "#FFFFFF";

function Qr({ code, className }: { code: QrCode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${code.size} ${code.size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path fill={LIGHT} d={`M0 0h${code.size}v${code.size}H0z`} />
      <path stroke={DARK} d={code.path} />
    </svg>
  );
}

function Flyer({ waitlist, beta }: { waitlist: QrCode; beta: QrCode }) {
  return (
    <article className={styles.flyer}>
      <header className={styles.mast}>
        <span className={styles.lockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.mark} src="/billion-logo.png" alt="" />
          <span className={styles.wordmark}>Billion</span>
        </span>
        <span className={styles.eyebrow}>The Civic Information App</span>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <h2 className={styles.head}>
            See what your government is doing <em>before it affects you.</em>
          </h2>
          <p className={styles.dek}>
            Bills, executive orders, and court rulings &mdash; in plain English,
            each one linked straight to the official document it came from.
          </p>

          <dl className={styles.records}>
            <div className={styles.rec}>
              <dt className={`${styles.tag} ${styles["tag-bill"]}`}>Bill</dt>
              <dd>What Congress is voting on</dd>
            </div>
            <div className={styles.rec}>
              <dt className={`${styles.tag} ${styles["tag-order"]}`}>Order</dt>
              <dd>What the President signed</dd>
            </div>
            <div className={styles.rec}>
              <dt className={`${styles.tag} ${styles["tag-case"]}`}>Case</dt>
              <dd>What the courts decided</dd>
            </div>
          </dl>

          <p className={styles.principle}>
            We&rsquo;re here to start the reading, not replace it &mdash; every
            summary links straight to the real text.
          </p>
        </div>

        <aside className={styles.cta}>
          <div className={styles["qr-frame"]}>
            <Qr code={waitlist} className={styles.qr} />
          </div>
          <p className={styles["cta-title"]}>Join the waitlist</p>
          <p className={styles["cta-url"]}>billion-news.app</p>
          <hr className={styles["cta-rule"]} />
          <div className={styles.beta}>
            <div className={styles["qr-frame-sm"]}>
              <Qr code={beta} className={styles["qr-sm"]} />
            </div>
            <p className={styles["beta-copy"]}>
              <strong>On an iPhone?</strong> Skip the list &mdash; try the beta
              now on TestFlight.
            </p>
          </div>
        </aside>
      </div>

      <footer className={styles.foot}>
        <span>
          Nonpartisan by design &mdash; every topic shown from more than one
          perspective.
        </span>
        <span className={styles.contact}>
          <span className={styles.handle}>
            <svg
              className={styles.ig}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              aria-hidden="true"
            >
              <rect x="2.7" y="2.7" width="18.6" height="18.6" rx="5.2" />
              <circle cx="12" cy="12" r="4.4" />
              <circle
                cx="17.6"
                cy="6.4"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            @billion.news
          </span>
          <span className={styles.email}>
            <svg
              className={styles.mail}
              viewBox="0 0 24 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="1.2" y="1.2" width="21.6" height="15.6" rx="2.2" />
              <path d="M2.3 2.3 L12 9.9 L21.7 2.3" />
            </svg>
            thatxliner@gmail.com
          </span>
        </span>
      </footer>
    </article>
  );
}

/**
 * One letter sheet: two identical flyers with a cut line between them.
 *
 * Every dimension is expressed in inches via `--u`, so the same markup renders
 * scaled-to-fit on screen and at exact physical size on paper.
 */
export function FlyerSheet({
  waitlist,
  beta,
}: {
  waitlist: QrCode;
  beta: QrCode;
}) {
  return (
    <div className={styles.sheetwrap}>
      <div className={styles.sheet}>
        <Flyer waitlist={waitlist} beta={beta} />
        <div className={styles.cutline} />
        <Flyer waitlist={waitlist} beta={beta} />
      </div>
    </div>
  );
}
