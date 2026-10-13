import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n/LanguageProvider";

export const metadata: Metadata = {
  title: "InduVision",
  description: "Sélection caméra et objectif pour vision industrielle"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
