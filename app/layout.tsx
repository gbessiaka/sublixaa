import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getAppConfig } from "@/lib/config";
import { getDictionary } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const { appName } = getAppConfig();

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: getDictionary().metadata.description,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
