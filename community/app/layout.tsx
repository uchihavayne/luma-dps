import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Luma DPS · Community", template: "%s · Luma DPS" },
  description: "Free AION 2 encounter sharing and community rankings. Player controlled, anonymous by default, with no account required.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
