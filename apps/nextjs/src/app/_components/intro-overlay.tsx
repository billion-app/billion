"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export function IntroOverlay() {
  const [phase, setPhase] = useState<"hold" | "animate" | "done">("hold");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("animate"), 1000);
    const t2 = setTimeout(() => setPhase("done"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <motion.img
            src="/billion-logo.png"
            alt="Billion"
            className="h-20 w-20 rounded-2xl"
            animate={
              phase === "animate"
                ? { rotateY: [0, 360], scale: 0.4 }
                : {}
            }
            transition={{
              duration: 0.9,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{ perspective: 1000 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
