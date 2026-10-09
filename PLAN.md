# Plano de Implementação: Web App de Unificação e Divisão de PDFs (PDF Splitter) — v2

> Revisão aplicada sobre a v1: corrige O(n²), cópia dupla, página única estourada, DnD, `use client`, `pageCount`, `zip-generator`, MB vs MiB, erros, sanitização e limites. Adota **DDD, Clean Architecture, SOLID, Clean Code e TDD**.

Objetivo: unificar múltiplos PDFs e dividir dinamicamente em partes ordenadas com peso <= limite do usuário (default seguro para portais de 3 MB), 100% client-side.

---

## 1. Visão Geral da Arquitetura (Clean + DDD)

- **Framework:** Next.js (App Router) + TypeScript strict + Tailwind CSS + Lucide + shadcn/ui (Radix)
- **Domínio:** `src/domain` — Entities, Value Objects, Domain Services, Errors (puro, sem dependência de `pdf-lib`)
- **Aplicação:** `src/application` — Use Cases + Ports (interfaces). Orquestra, não conhece `pdf-lib`/`jszip`.
- **Infraestrutura:** `src/infrastructure` — Adapters `pdf-lib`, `jszip`, Web Worker
- **Interface:** `src/interface` — `app/` + `components/` + `hooks/` (todos Client Components com `'use client'`)
- **DnD (decisão):** `@dnd-kit/sortable` + `@dnd-kit/core` (substitui `@hello-pangea/dnd` — compatível com React 19 + StrictMode)

```
[interface/Dropzone] -> [application/ProcessPdfsUseCase]
        |                          | (depende só de Ports)
        v                          v
[FileList dnd-kit]      [infrastructure/pdf-lib Adapter + Worker]
        |                          |
        +------> [domain/SplitStrategy] -> [infrastructure/jszip Adapter] -> Download
```

**Princípios:**
- **DDD:** Linguagem ubíqua: `PdfSource`, `MergedDocument`, `PdfPart`, `SizeLimit`, `OutputPrefix`. Lógica de corte vive no Domain Service, não no adapter.
- **SOLID:** S — um Use Case por intenção; O — `ISplitStrategy` aberta a extensão (por tamanho, por N páginas); L — adapters trocáveis; I — Ports mínimas (`IPdfLoader`, `IPdfSaver`, `IZipGateway`); D — Application depende de Ports.
- **Clean Code:** funções < 30 linhas, nomes de domínio, early-return, sem número mágico (`SAFE_3MB_BYTES`).

---

## 2. Estrutura de Pastas e Arquivos (v2)

```text
pdf-splitter-app/
├── src/
│   ├── domain/
│   │   ├── entities/pdf-part.ts           # { name, blob, sizeBytes, pageCount, oversized }
│   │   ├── value-objects/size-limit.ts    # valida >0, default 2_800_000 bytes
│   │   ├── value-objects/output-prefix.ts # sanitiza \/:*?"<>|
│   │   ├── errors/pdf-errors.ts           # EncryptedPdfError, CorruptPdfError, OversizedPageError
│   │   └── services/split-planner.ts      # decide pontos de corte (puro, testável sem pdf-lib)
│   ├── application/
│   │   ├── ports/pdf-gateway.port.ts      # IPdfGateway: load, copyPages, save
│   │   ├── ports/zip-gateway.port.ts      # IZipGateway
│   │   ├── dto/process-pdfs.dto.ts
│   │   └── use-cases/process-pdfs.use-case.ts  # merge + split orquestrado
│   ├── infrastructure/
│   │   ├── pdf/pdf-lib-gateway.adapter.ts
│   │   ├── zip/jszip-gateway.adapter.ts
│   │   └── workers/pdf.worker.ts          # roda UseCase fora do main thread
│   ├── interface/
│   │   ├── app/layout.tsx
│   │   ├── app/page.tsx                   # 'use client' + usePdfProcessor
│   │   ├── components/Dropzone.tsx        # 'use client', react-dropzone, accept: application/pdf
│   │   ├── components/FileList.tsx        # 'use client', dnd-kit sortable
│   │   ├── components/FileCard.tsx
│   │   ├── components/SettingsPanel.tsx
│   │   ├── components/ProcessProgressBar.tsx
│   │   └── components/DownloadSection.tsx # object URLs + revoke
│   ├── shared/
│   │   ├── utils/formatters.ts
│   │   └── utils/filename.ts
├── tests/                                 # espelha src/ (vitest + testing-library)
├── public/
├── package.json
└── tsconfig.json (paths @/domain, @/application, @/infrastructure, @/interface)
```

---

## 3. Algoritmo Core Corrigido (contrato)

Problemas da v1 corrigidos: (1) sem `mergedPdf` intermediário gigante, (2) sem `save()` por página, (3) página única estourada sinalizada.

> Revisão pós-teste real (2 rodadas):
> 1. Medir o `save()` real após cada página maximiza o limite — estimar
>    somando páginas salvas isoladas conta recursos compartilhados (fontes
>    embedadas etc.) uma vez por página e corta cedo demais (partes <1MB).
>    `getSinglePageSize` foi removido do Port/adapters.
> 2. MAS medir não basta: `copyPages` página-a-página em chamadas separadas
>    DUPLICA o compartilhado no destino (medido: 10 págs c/ 1 imagem = 45KB
>    real vs 436KB, ~10x) — media um documento inchado e ainda gerava
>    arquivos maiores que o necessário. Cada tentativa reconstrói
>    [cursor, end) do zero com cópias em LOTE (1 chamada por run
>    consecutiva) e a decisão usa o `save()` desse build íntegro.

```typescript
// domain/value-objects/size-limit.ts
export const SAFE_3MB_BYTES = 2_800_000; // bytes decimais, não MiB. Portal de 3.000.000 -> margem 200KB
export class SizeLimit {
  constructor(readonly bytes: number = SAFE_3MB_BYTES) {
    if (!Number.isInteger(bytes) || bytes <= 0) throw new Error("SizeLimit inválido");
  }
}

// application/use-cases/process-pdfs.use-case.ts (pseudo)
export async function processPdfs(
  sources: OrderedPdfSource[], // já ordenados pela FileList
  limit: SizeLimit,
  prefix: OutputPrefix,
  gateway: IPdfGateway,
  onProgress?: (p: number) => void,
): Promise<PdfPart[]> {
  // 1. load com try/catch por arquivo -> EncryptedPdfError | CorruptPdfError (não aborta fila, marca erro)
  // 2. lista plana de páginas na ordem, sem mergedPdf: mantém `current` por parte
  // 3. fill guloso com MEDIÇÃO REAL: anexa 1 página -> save() -> mede (nunca estimativa)
  // 4. se save > limite && pagesInCurrent > 1 -> fecha parte sem última página (lastGood), nova parte começa com ela
  // 5. se save > limite && pagesInCurrent === 1 -> fecha parte com oversized: true (UI alerta)
  // 6. invariante: cada parte não-final é maximal (a próxima página de fato excederia)
  // 7. yield ao event loop a cada iteração para progresso fluido + Worker
}
```

Regras:
- `pageCount` é extraído no upload (adapter `probePageCount`) para exibir antes de processar.
- `OutputPrefix` sanitizado: `name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "Documento"`.
- Limites: `MAX_FILES=20`, `MAX_TOTAL_BYTES=200_000_000` — acima disso, bloqueia com mensagem.
- Zip: `jszip` gera `Blob`, `DownloadSection` cria `URL.createObjectURL` e revoga no unmount/troca de results.

---

## 4. Testes, Qualidade e Deploy

- **Stack teste:** Vitest (unit/integration domain+application) + Testing Library (componentes) + Playwright (1 fluxo E2E: upload 2 PDFs -> split -> zip).
- **Seams de teste (acordadas):** `SplitPlanner` (puro), `ProcessPdfsUseCase` (via `IPdfGateway` fake in-memory), `SizeLimit`/`OutputPrefix`, `JszipGateway` (integração leve). Não testar internals de `pdf-lib`.
- **Deploy:** `output: 'export'` em `next.config.js`, hospedagem estática (Vercel/Netlify/GH Pages). Selo "100% local — nada sai do navegador" no footer + CSP sem `connect-src` externo.
