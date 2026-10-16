import type { Metadata } from "next";
import Report from "./report";

export const metadata: Metadata = { title: "Karşılaşma raporu", robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Report id={id} />;
}
