"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import posthog from "posthog-js";

export function WaitlistForm({
  size = "default",
}: {
  size?: "default" | "large";
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMsg("");

    posthog.capture("waitlist_form_submitted", { form_location: size });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res
        .json()
        .catch(() => null)) as WaitlistResponse | null;

      if (res.ok) {
        const alreadyJoined = data?.result === "already_joined";
        setStatus(alreadyJoined ? "already" : "success");
        setEmail("");

        if (alreadyJoined) {
          posthog.capture("waitlist_already_joined", {
            form_location: size,
          });
        } else {
          posthog.capture("waitlist_joined", { form_location: size });
        }
      } else {
        setStatus("error");
        setErrorMsg(data?.error ?? "Something went wrong. Please try again.");
        posthog.capture("waitlist_signup_error", {
          form_location: size,
          error: data?.error ?? "unknown",
        });
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
      posthog.capture("waitlist_signup_error", {
        form_location: size,
        error: "network_error",
      });
    }
  };

  const isLarge = size === "large";
  const controlHeight = isLarge ? 58 : 52;
  const fontSize = isLarge ? "16px" : "15px";
  const formWidth = isLarge ? "max-w-[760px]" : "max-w-md lg:mx-0";
  const gapClass = isLarge ? "gap-3 sm:gap-5" : "gap-3";
  const confirmation =
    status === "already"
      ? {
          key: "already",
          message: "You're already on the list — you're all set.",
          tone: "rgba(148,163,184,0.1)",
          border: "rgba(148,163,184,0.28)",
          iconFill: "rgba(148,163,184,0.18)",
          iconStroke: "#94a3b8",
          textColor: "#cbd5e1",
        }
      : {
          key: "success",
          message: "You're on the list — we'll be in touch!",
          tone: "rgba(74,124,255,0.1)",
          border: "rgba(74,124,255,0.3)",
          iconFill: "rgba(74,124,255,0.2)",
          iconStroke: "#4A7CFF",
          textColor: "#9DB8FF",
        };

  return (
    <AnimatePresence mode="wait">
      {status === "success" || status === "already" ? (
        <motion.div
          key={confirmation.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`mx-auto flex w-full items-center gap-3 rounded-full px-6 py-3.5 ${formWidth}`}
          style={{
            backgroundColor: confirmation.tone,
            border: `1px solid ${confirmation.border}`,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="9" fill={confirmation.iconFill} />
            <motion.path
              d="M5.5 9l2.5 2.5 4.5-4.5"
              stroke={confirmation.iconStroke}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
              strokeDasharray="1 1"
            />
          </svg>
          <span
            className="font-sans text-[15px] font-medium"
            style={{ color: confirmation.textColor }}
          >
            {confirmation.message}
          </span>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
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
              className="border-border bg-input text-foreground placeholder:text-muted-foreground focus:border-accent w-full rounded-full border font-sans transition-all duration-200 outline-none focus:[box-shadow:0_0_0_3px_rgba(74,124,255,0.15)] disabled:opacity-60"
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
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
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

type WaitlistStatus = "idle" | "loading" | "success" | "already" | "error";

interface WaitlistResponse {
  error?: string;
  result?: "joined" | "already_joined";
}
