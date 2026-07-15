"use client";

import { motion, useScroll, useTransform } from "motion/react";

import { EASE_OUT_QUART } from "./animations";
import { PhoneScreenshot } from "./phone-screenshot";

const browseScreenshot = {
  src: "/app-screenshots/browse.png",
  alt: "Billion iOS Browse screen showing civic content results",
};

const electionsScreenshot = {
  src: "/app-screenshots/elections.png",
  alt: "Billion iOS Elections screen showing ballot information",
};

export function HeroExperience() {
  const { scrollY } = useScroll();
  // Gentle scroll-linked parallax — the two phones drift at slightly
  // different rates as the hero scrolls past, a quiet depth cue rather
  // than a gimmick. MotionConfig's reducedMotion="user" neutralizes this
  // transform-based motion automatically for reduced-motion users.
  const backY = useTransform(scrollY, [0, 600], [0, 46]);
  const frontY = useTransform(scrollY, [0, 600], [0, -26]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.65, ease: EASE_OUT_QUART, delay: 0.1 }}
      className="relative mx-auto flex min-h-[500px] w-full max-w-[600px] items-start justify-center pt-4 md:min-h-[560px] md:items-center md:pt-0 lg:mx-0 lg:ml-auto lg:min-h-[650px] lg:justify-end"
      data-testid="hero-screenshot-stack"
    >
      <div
        className="absolute bottom-8 left-1/2 h-16 w-[420px] max-w-[88vw] -translate-x-1/2 rounded-full bg-black/35 blur-2xl"
        aria-hidden="true"
      />

      <motion.div
        style={{ y: backY }}
        className="absolute top-20 left-0 hidden md:block lg:top-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 26, rotate: -3 }}
          animate={{
            opacity: 0.7,
            y: 0,
            rotate: -3,
            transition: {
              duration: 0.55,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.16,
            },
          }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            <PhoneScreenshot
              src={electionsScreenshot.src}
              alt={electionsScreenshot.alt}
              sizes="(min-width: 1024px) 248px, 210px"
              className="w-[230px] lg:w-[248px]"
            />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ y: frontY }}
        className="relative z-10 w-[min(72vw,270px)] md:w-[310px] lg:w-[340px]"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, rotate: 2 }}
          animate={{
            opacity: 1,
            y: 0,
            rotate: 2,
            transition: {
              duration: 0.55,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.26,
            },
          }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
          >
            <PhoneScreenshot
              src={browseScreenshot.src}
              alt={browseScreenshot.alt}
              priority
              sizes="(min-width: 1024px) 340px, 270px"
              className="w-full"
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
