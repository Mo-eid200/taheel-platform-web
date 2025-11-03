"use client";
import dynamic from "next/dynamic";

const registry = {
  "mohamed-kestiro": dynamic(() => import("../_designs/mohamed-kestiro"), { ssr:false }),
  "keela": dynamic(() => import("../_designs/keela"), { ssr:false }),
};

export default function ClientDesignLoader({ slug }) {
  const Design = registry[slug];
  return <Design />;
}
