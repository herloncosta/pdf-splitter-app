"use client";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">PDF Splitter</h1>
        <p className="text-sm text-zinc-600">
          Unifique e divida PDFs em partes de até 3 MB — 100% no navegador.
        </p>
      </header>
      <p className="text-sm">
        Scaffold T01 pronto. Próximo: domínio (T10 SizeLimit) + upload/split.
      </p>
      <footer className="mt-auto text-xs text-zinc-500">
        100% local — nenhum documento sai do seu navegador.
      </footer>
    </main>
  );
}
