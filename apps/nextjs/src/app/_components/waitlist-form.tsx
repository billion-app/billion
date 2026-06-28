"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function WaitlistForm({
  size = "default",
}: {
  size?: "default" | "large";
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("https://getlaunchlist.com/s/m2zvn0", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  };

  const isLarge = size === "large";
  const controlHeight = isLarge ? 58 : 52;
  const fontSize = isLarge ? "16px" : "15px";
  const formWidth = isLarge ? "max-w-[760px]" : "max-w-md lg:mx-0";
  const gapClass = isLarge ? "gap-3 sm:gap-5" : "gap-3";

  return (
    <AnimatePresence mode="wait">
      {status === "success" ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: "auto" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="flex items-center gap-3 rounded-full px-6 py-3.5"
          style={{
            backgroundColor: "rgba(196,163,90,0.1)",
            border: "1px solid rgba(196,163,90,0.3)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <motion.circle
              cx="9"
              cy="9"
              r="9"
              fill="rgba(196,163,90,0.2)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            />
            <motion.path
              d="M5.5 9l2.5 2.5 4.5-4.5"
              stroke="#c4a35a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
              strokeDasharray="1 1"
            />
          </svg>
          <span
            className="font-sans text-[15px] font-medium"
            style={{ color: gold }}
          >
            You&apos;re on the list — we&apos;ll be in touch!
          </span>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`mx-auto flex w-full flex-col items-stretch sm:flex-row sm:items-center ${gapClass} ${formWidth}`}
        >
          <div className="relative min-w-0 flex-1">
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-gold w-full rounded-full border font-sans transition-all duration-200 outline-none focus:[box-shadow:0_0_0_3px_rgba(196,163,90,0.1)] disabled:opacity-60"
              style={{
                height: controlHeight,
                fontSize,
                paddingLeft: "20px",
                paddingRight: "20px",
              }}
            />
          </div>
          <motion.button
            type="submit"
            disabled={status === "loading"}
            whileHover={{ scale: status === "loading" ? 1 : 1.02 }}
            whileTap={{ scale: status === "loading" ? 1 : 0.98 }}
            className="bg-primary text-primary-foreground flex items-center justify-center rounded-full px-7 font-sans font-medium whitespace-nowrap transition-all duration-200 hover:opacity-90 disabled:opacity-60"
            style={{
              height: controlHeight,
              fontSize,
            }}
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  Joining
                </motion.span>
                <span className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="bg-primary-foreground/40 inline-block h-[4px] w-[4px] rounded-full"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </span>
              </span>
            ) : (
              "Join waitlist"
            )}
          </motion.button>
          <AnimatePresence>
            {status === "error" && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full text-center font-sans text-[13px]"
                style={{ color: "#ef4444" }}
              >
                {errorMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

const gold = "#c4a35a";
