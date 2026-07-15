"use client";

import type { Variants } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

/* ── Shared easing — mirrors --ease-out-quart / --ease-out-expo in theme.css ── */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/* ── Reveal presets ──────────────────────────────────────────────────────
   Each variant carries its own distance/duration/ease so a page built from
   several of these doesn't read as one reflex repeated everywhere. Pick the
   one that matches how much weight the revealed content should carry. */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_QUART },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: EASE_OUT_EXPO },
  },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: EASE_OUT_EXPO, delay: 0.06 },
  },
};

const settle: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_QUART },
  },
};

// The page's one signature reveal — content resolves out of a soft blur
// rather than just fading up, echoing the product's own promise (the record
// made legible). Reserved for the hero's first paint, not scroll reveals.
const focusIn: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE_OUT_QUART },
  },
};

const variantMap = {
  fadeUp,
  fadeIn,
  slideInLeft,
  slideInRight,
  settle,
  focusIn,
};

export type RevealVariant = keyof typeof variantMap;

/* ── Section wrapper — animates once when scrolled into view ───────────── */

export function AnimatedSection({
  children,
  className,
  variant = "fadeUp",
  delay = 0,
  id,
  style,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delay?: number;
  id?: string;
  style?: CSSProperties;
  as?: "div" | "footer";
}) {
  const MotionTag = as === "footer" ? motion.footer : motion.div;
  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      variants={variantMap[variant]}
      className={className}
      id={id}
      style={style}
    >
      {children}
    </MotionTag>
  );
}

/* ── Stagger container + item ──────────────────────────────────────────── */

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ visible: { transition: { staggerChildren: staggerDelay } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  variant = "fadeUp",
}: {
  children: ReactNode;
  className?: string;
  variant?: Extract<RevealVariant, "fadeUp" | "fadeIn" | "settle" | "focusIn">;
}) {
  return (
    <motion.div variants={variantMap[variant]} className={className}>
      {children}
    </motion.div>
  );
}

/* ── Count-up number ───────────────────────────────────────────────────── */

export function CountUp({
  to,
  duration = 2,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const ctrl = animate(mv, to, { duration, ease: "easeOut" });
    return () => ctrl.stop();
  }, [mv, to, duration]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
