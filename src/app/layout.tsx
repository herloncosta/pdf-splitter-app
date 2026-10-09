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
  // Nota (T51): sem <meta CSP> restritivo de propósito — o Next.js (mesmo em
  // `output: 'export'`) emite scripts inline e o `script-src 'self'` quebra a
  // hidratação. Privacidade é garantida por arquitetura (zero fetch/XHR para
  // hosts externos, verificado no E2E) + selo no footer.
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
