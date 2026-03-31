"use client";

import { useState } from "react";

export function WaitlistForm({ size = "default" }: { size?: "default" | "large" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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

  if (status === "success") {
    return (
      <div
        className="flex items-center gap-3 rounded-full px-6 py-3.5"
        style={{
          backgroundColor: "rgba(74,124,255,0.12)",
          border: "1px solid rgba(74,124,255,0.3)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="9" fill="#4A7CFF" fillOpacity="0.2" />
          <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#4A7CFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className="text-[15px] font-medium"
          style={{ color: "#4A7CFF", fontFamily: "var(--font-albert-sans)" }}
        >
          You're on the list — we'll be in touch!
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <div className="relative w-full sm:w-auto">
        <input
          type="email"
          required
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="w-full rounded-full border-0 px-5 outline-none transition-all duration-150 sm:w-72"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "#FFFFFF",
            fontFamily: "var(--font-albert-sans)",
            fontSize: size === "large" ? "16px" : "15px",
            paddingTop: size === "large" ? "14px" : "12px",
            paddingBottom: size === "large" ? "14px" : "12px",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-full px-8 font-medium text-black transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        style={{
          backgroundColor: "#FFFFFF",
          fontFamily: "var(--font-albert-sans)",
          fontSize: size === "large" ? "16px" : "15px",
          paddingTop: size === "large" ? "14px" : "12px",
          paddingBottom: size === "large" ? "14px" : "12px",
        }}
      >
        {status === "loading" ? "Joining…" : "Join the waitlist"}
      </button>
      {status === "error" && (
        <p
          className="w-full text-center text-[13px]"
          style={{ color: "#FF6B6B", fontFamily: "var(--font-albert-sans)" }}
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
