import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kartify | Find the Right Thing Across Every App",
  description: "Kartify is an AI shopping assistant that understands your needs and recommends the perfect products across multiple shopping platforms through intelligent conversations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kartify" />
      </head>
      <body className="min-h-full flex flex-col font-inter bg-slate-900 text-slate-50 selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
