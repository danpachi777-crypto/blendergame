import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "連続切り — 切るほど、気持ちいい。",
  description:
    "指を離さず、リズムをつなぐ。Blender製3Dキッチンのスマホ向けスライスゲーム。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
