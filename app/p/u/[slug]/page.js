import { notFound } from "next/navigation";
import ClientDesignLoader from "./ClientDesignLoader";

const VALID = new Set(["mohamed-kestiro", "keela"]);

export default function Page({ params }) {
  const slug = (params?.slug || "").toLowerCase();
  if (!VALID.has(slug)) return notFound();
  return <ClientDesignLoader slug={slug} />;
}
