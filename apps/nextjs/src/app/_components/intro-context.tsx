"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

const IntroContext = createContext<boolean>(false);

export function useIntroDone() {
  return useContext(IntroContext);
}

export function IntroProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Overlay: 1s hold + 0.9s animate + 0.4s exit fade = ~2.3s. Fire at 2.4s.
    const timer = setTimeout(() => setDone(true), 2100);
    return () => clearTimeout(timer);
  }, []);

  return <IntroContext.Provider value={done}>{children}</IntroContext.Provider>;
}
