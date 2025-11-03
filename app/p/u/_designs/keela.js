"use client";
import dynamic from "next/dynamic";

const registry = {
  "mohamed-kestiro": dynamic(() => import("../_designs/mohamed-kestiro"), { ssr: false }),
  // شيل السطر ده لو ماعندكش keela لسه:
  // "keela": dynamic(() => import("../_designs/keela"), { ssr: false }),
};

export default function ClientDesignLoader({ slug }) {
  const Design = registry[slug];
  if (!Design) return null;
  return <Design />;
}
