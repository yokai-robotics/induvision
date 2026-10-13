import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
