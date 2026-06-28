"use client";

import Image from "next/image";
import { motion } from "motion/react";

const browseScreenshot = {
  src: "/app-screenshots/browse.png",
  alt: "Billion iOS Browse screen showing civic content results",
};

const electionsScreenshot = {
  src: "/app-screenshots/elections.png",
  alt: "Billion iOS Elections screen showing ballot information",
};

function PhoneScreenshot({
  src,
  alt,
  className,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  className: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div
      className={`${className} overflow-hidden rounded-[34px] border border-white/12 bg-[#070b1a] p-2 shadow-[0_26px_70px_rgba(0,0,0,0.38)]`}
    >
      <div className="relative aspect-[1179/2556] overflow-hidden rounded-[28px] bg-[#0e1530]">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    </div>
  );
}

export function HeroExperience() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
      className="relative mx-auto flex min-h-[500px] w-full max-w-[600px] items-start justify-center pt-4 md:min-h-[560px] md:items-center md:pt-0 lg:mx-0 lg:ml-auto lg:min-h-[650px] lg:justify-end"
      data-testid="hero-screenshot-stack"
    >
      <div
        className="absolute bottom-8 left-1/2 h-16 w-[420px] max-w-[88vw] -translate-x-1/2 rounded-full bg-black/35 blur-2xl"
        aria-hidden="true"
      />

      <PhoneScreenshot
        src={electionsScreenshot.src}
        alt={electionsScreenshot.alt}
        sizes="(min-width: 1024px) 248px, 210px"
        className="absolute top-20 left-0 hidden w-[230px] -rotate-3 opacity-70 md:block lg:top-24 lg:w-[248px]"
      />

      <PhoneScreenshot
        src={browseScreenshot.src}
        alt={browseScreenshot.alt}
        priority
        sizes="(min-width: 1024px) 340px, 270px"
        className="relative z-10 w-[min(72vw,270px)] rotate-2 md:w-[310px] lg:w-[340px]"
      />
    </motion.div>
  );
}
