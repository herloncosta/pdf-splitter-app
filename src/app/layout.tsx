import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Splitter — Unificar e dividir PDFs no navegador",
  description:
    "Unifique múltiplos PDFs e divida em partes de até 3 MB. 100% client-side: nada sai do seu navegador.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
