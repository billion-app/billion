"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

export function IntroOverlay() {
  const [phase, setPhase] = useState<"hold" | "animate" | "done">("hold");
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setTargetPos({
        x: rect.left + 16 - window.innerWidth / 2,
        y: rect.top + 16 - window.innerHeight / 2,
      });
    }

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
          {/* Hidden target matching nav layout to measure logo position */}
          <div
            className="fixed inset-x-0 top-0 mx-auto flex items-center justify-between px-6 py-5"
            style={{ maxWidth: 1120, visibility: "hidden" }}
          >
            <div className="flex items-center gap-3">
              <div ref={targetRef} className="h-8 w-8" />
            </div>
          </div>

          <motion.div
            animate={
              phase === "animate"
                ? { x: targetPos.x, y: targetPos.y }
                : {}
            }
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            style={{ perspective: 1000 }}
          >
            <motion.img
              src="/billion-logo.png"
              alt="Billion"
              className="h-20 w-20 rounded-2xl shadow-md"
              animate={
                phase === "animate"
                  ? { rotateY: [0, 360], scale: 0.4 }
                  : {}
              }
              transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
