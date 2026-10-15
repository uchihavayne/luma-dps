"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type Language = "tr" | "en";
export function useLanguage(): [Language, Dispatch<SetStateAction<Language>>] {
  const [lang, setLang] = useState<Language>("tr");
  useEffect(() => { try { if (localStorage.getItem("luma-community-language") === "en") setLang("en"); } catch {} }, []);
  useEffect(() => { document.documentElement.lang = lang; try { localStorage.setItem("luma-community-language", lang); } catch {} }, [lang]);
  return [lang, setLang];
}
export function compact(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const units = ["", "K", "M", "B", "T"], unit = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log10(value || 1) / 3)));
  return `${Number((value / 1000 ** unit).toFixed(2))}${units[unit]}`;
}
export function rate(value: number, lang: Language): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return `${Number((value / (value >= 1000 ? 1000 : 1)).toFixed(2))}${value >= 1000 ? "K" : ""}/${lang === "tr" ? "sn" : "s"}`;
}
export function duration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const seconds = Math.floor(value / 1000), hours = Math.floor(seconds / 3600);
  return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function classColor(value: string): string {
  return ({ gladiator: "#e5a27f", templar: "#d9c37f", assassin: "#c39bea", ranger: "#90cc9e", sorcerer: "#8dbaf0", spiritmaster: "#acaaeb", cleric: "#e7d69c", chanter: "#82d2c3" } as Record<string, string>)[String(value).toLowerCase()] || "#a4b7bd";
}
export function Arrow() { return <svg className="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>; }
export function CommunityHeader({ lang, setLang }: { lang: Language; setLang: Dispatch<SetStateAction<Language>> }) {
  return <><a className="skip-link" href="#main-content">{lang === "tr" ? "İçeriğe geç" : "Skip to content"}</a><header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="Luma DPS Community"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="m18 3 15 15-15 15L3 18Z" /><path d="m18 10 8 8-8 8-8-8Z" /></svg><span>LUMA<span className="brand-caption">DPS COMMUNITY</span></span></a><nav className="header-nav" aria-label={lang === "tr" ? "Ana bağlantılar" : "Main navigation"}><a className="nav-source" href="https://github.com/uchihavayne/luma-dps" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a><button className="language-toggle" onClick={() => setLang(lang === "tr" ? "en" : "tr")} aria-label={lang === "tr" ? "Switch to English" : "Türkçeye geç"}><span className={lang === "tr" ? "active" : ""}>TR</span><i /><span className={lang === "en" ? "active" : ""}>EN</span></button><a className="button secondary download-button" href="https://github.com/uchihavayne/luma-dps/releases" target="_blank" rel="noopener noreferrer">{lang === "tr" ? "Luma’yı indir" : "Download Luma"}<Arrow /></a></nav></div></header></>;
}
export function CommunityFooter({ lang }: { lang: Language }) {
  return <footer className="site-footer"><div><strong>LUMA <span>DPS</span></strong><p>{lang === "tr" ? "Oyuncular için. Paylaşmak isteyenler için." : "For players. For those who choose to share."}</p></div><div className="footer-links"><a href="https://github.com/uchihavayne/luma-dps" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="https://buymeacoffee.com/12hrsofficp" target="_blank" rel="noopener noreferrer">{lang === "tr" ? "Luma’yı destekle" : "Support Luma"} ↗</a><span>{lang === "tr" ? "AION 2 ile resmi bağlantısı yoktur." : "Not affiliated with AION 2."}</span></div></footer>;
}
export function EmptyState({ kind = "empty", title, text }: { kind?: "empty" | "error" | "loading"; title: string; text: string }) {
  return <div className={`empty-state ${kind}`} role="status"><div className="empty-gem" aria-hidden="true">{kind === "error" ? "!" : "◇"}</div><h3>{title}</h3><p>{text}</p></div>;
}
