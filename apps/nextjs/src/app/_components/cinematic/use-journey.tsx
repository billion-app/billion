"use client";

import type { ReactNode, RefObject } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Lenis from "lenis";

import type { PersonalTopicId } from "./journey";

interface JourneyValue {
  progressRef: RefObject<number>;
  overlayProgress: number;
  reducedMotion: boolean;
  webgl: boolean | null;
  focusTopic: PersonalTopicId | null;
  setFocusTopic: (id: PersonalTopicId | null) => void;
  focusEntity: string | null;
  setFocusEntity: (id: string | null) => void;
  width: number;
  height: number;
}

const JourneyContext = createContext<JourneyValue | null>(null);

export function useJourney() {
  const value = useContext(JourneyContext);
  if (!value) {
    throw new Error("useJourney must be used inside JourneyProvider");
  }
  return value;
}

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const progressRef = useRef(0);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [focusTopic, setFocusTopic] = useState<PersonalTopicId | null>(null);
  const [focusEntity, setFocusEntity] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(motion.matches);
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    onMotion();
    onResize();
    motion.addEventListener("change", onMotion);
    window.addEventListener("resize", onResize);

    return () => {
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setWebgl(detectWebGL());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      progressRef.current = 0;
      return;
    }

    const lenis = new Lenis({
      lerp: 0.075,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.05,
    });

    const onScroll = ({ progress }: { progress: number }) => {
      progressRef.current = progress;
    };
    lenis.on("scroll", onScroll);

    const onResize = () => {
      const progress = progressRef.current;
      lenis.resize();
      lenis.scrollTo(progress * lenis.limit, { immediate: true });
    };
    window.addEventListener("resize", onResize);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href^='#']");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute("href");
      if (!href || href.length < 2) return;
      event.preventDefault();
      lenis.scrollTo(href, { offset: 0, duration: 1.4 });
    };
    document.addEventListener("click", onClick, true);

    if (window.location.hash) {
      requestAnimationFrame(() => {
        lenis.scrollTo(window.location.hash, { offset: 0, immediate: true });
      });
    }

    let frame = 0;
    let lastOverlay = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      if (time - lastOverlay > 32) {
        lastOverlay = time;
        const next = progressRef.current;
        setOverlayProgress((prev) =>
          Math.abs(prev - next) > 0.0008 ? next : prev,
        );
      }
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.off("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onClick, true);
      lenis.destroy();
    };
  }, [reducedMotion]);

  const value = useMemo(
    () => ({
      progressRef,
      overlayProgress,
      reducedMotion,
      webgl,
      focusTopic,
      setFocusTopic,
      focusEntity,
      setFocusEntity,
      width: size.width,
      height: size.height,
    }),
    [
      overlayProgress,
      reducedMotion,
      webgl,
      focusTopic,
      focusEntity,
      size.width,
      size.height,
    ],
  );

  return (
    <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
  );
}
