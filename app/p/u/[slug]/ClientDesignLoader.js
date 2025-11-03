"use client";
import dynamic from "next/dynamic";

export default function ClientDesignLoader({ slug }) {
  const key = String(slug || "").toLowerCase();

  // نحاول نحمل أي ملف في _designs بنفس الاسم
  const Design = dynamic(() => import(`../_designs/${key}`), { ssr: false });

  return <Design />;
}
