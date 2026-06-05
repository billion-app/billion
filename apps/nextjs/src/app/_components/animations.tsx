"use client";

import { motion, useMotionValue, useTransform, animate, type Variants } from "motion/react";
import { useEffect, type ReactNode } from "react";

/* ── Shared animation presets ──────────────────────────────────────────── */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

/* ── Section wrapper — animates when scrolled into view ────────────────── */

export function AnimatedSection({
  children,
  className,
  variant = "fadeUp",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  variant?: "fadeUp" | "fadeIn" | "slideInLeft" | "slideInRight" | "scaleIn";
  delay?: number;
}) {
  const v =
    variant === "fadeIn" ? fadeIn
    : variant === "slideInLeft" ? slideInLeft
    : variant === "slideInRight" ? slideInRight
    : variant === "scaleIn" ? scaleIn
    : fadeUp;

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      variants={v}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger container + item ──────────────────────────────────────────── */

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
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
  variant?: "fadeUp" | "fadeIn" | "scaleIn";
}) {
  const v =
    variant === "fadeIn" ? fadeIn
    : variant === "scaleIn" ? scaleIn
    : fadeUp;

  return (
    <motion.div variants={v} className={className}>
      {children}
    </motion.div>
  );
}

/* ── Animated card — hover lift + optional gold border glow ────────────── */

export function AnimatedCard({
  children,
  className,
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        boxShadow: accent
          ? "0 8px 32px rgba(196, 163, 90, 0.15)"
          : "0 8px 32px rgba(0, 0, 0, 0.3)",
        borderColor: accent
          ? "rgba(196, 163, 90, 0.4)"
          : "rgba(255, 255, 255, 0.12)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
    >
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
