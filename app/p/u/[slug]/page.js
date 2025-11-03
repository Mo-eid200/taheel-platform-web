import { notFound } from "next/navigation";
import ClientDesignLoader from "./ClientDesignLoader";
import fs from "fs";
import path from "path";

export default function Page({ params }) {
  const slug = (params?.slug || "").toLowerCase();
  const designsDir = path.join(process.cwd(), "app/p/u/_designs");
  const files = fs.readdirSync(designsDir).map((f) => f.replace(".js", ""));

  if (!files.includes(slug)) {
    return notFound();
  }

  return <ClientDesignLoader slug={slug} />;
}
