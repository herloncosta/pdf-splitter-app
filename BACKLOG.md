# Backlog — PDF Splitter (DDD + Clean Architecture + SOLID + TDD)

> Como trabalhar: **uma tarefa por vez, em fatia vertical, ciclo RED → GREEN → REFACTOR**. Só teste na **seam acordada**. Valor esperado sempre de fonte independente (literal do spec, nunca recomputado pelo código). Sem fatiamento horizontal (não escreva todos os testes antes).

## Convenções TDD (valem para todas as tarefas)

- **Seams acordadas:** `domain/*` (puro), `application/use-cases/*` via Ports fake in-memory, `infrastructure/*` só integração leve, componentes via Testing Library pelo DOM.
- **RED:** 1 teste falhando na seam, com literal esperado da spec (ex: `2_800_000`, `"Parte_01"`, `oversized: true`).
- **GREEN:** mínimo para passar, sem antecipar próxima tarefa.
- **REFACTOR:** só após verde — Clean Code (<30 linhas/fn, early-return, sem mágico), SOLID, checar anti-padrões (acoplado a internals, tautológico).
- **Comando padrão:** `npm run test -- <arquivo> --run` (vitest), depois `npm run lint && npm run typecheck`.

## Linguagem ubíqua (DDD)

| Termo | Significado |
|---|---|
| `PdfSource` | Arquivo de entrada ordenado `{ id, file, name, sizeBytes, pageCount }` |
| `PdfPart` | Parte de saída `{ name, blob, sizeBytes, pageCount, oversized }` |
| `SizeLimit` | VO limite em bytes, default `SAFE_3MB_BYTES = 2_800_000` |
| `OutputPrefix` | VO nome sanitizado |
| `SplitPlanner` | Domain Service puro que decide cortes |
| `ProcessPdfs` | Use Case que orquestra load → split → save |

## Mapa SOLID / Clean

- **S:** 1 Use Case = 1 intenção. **O:** `ISplitStrategy` extensível. **L:** adapters trocáveis via Ports. **I:** `IPdfGateway` / `IZipGateway` mínimas. **D:** application → ports, nunca → `pdf-lib` direto.

---

## ETAPA 0 — Setup e fundação (bloqueia tudo)

### T01 — Scaffold Next + TS strict + paths + Vitest
- **Camada:** tooling. **SOLID:** n/a (fundação).
- **RED:** `tests/smoke.spec.ts` falha (projeto não existe / `tsc --noEmit` falha).
- **GREEN:** `npx create-next-app --typescript --tailwind --app --eslint`, `tsconfig paths` (`@/*`), `vitest + @testing-library/react` instalados, `npm test` verde.
- **REFACTOR:** remover template desnecessário, `output: 'export'` em `next.config.js`.
- **Aceite:** `npm run dev`, `test`, `typecheck`, `build` passam.

### T02 — Deps domínio + lint
- **RED:** `npm ls pdf-lib jszip react-dropzone @dnd-kit/core @dnd-kit/sortable` falha.
- **GREEN:** `npm i pdf-lib jszip react-dropzone @dnd-kit/core @dnd-kit/sortable lucide-react clsx tailwind-merge`, eslint+prettier ok.
- **REFACTOR:** fixar versões, remover `@hello-pangea/dnd` (decisão v2).
- **Aceite:** sem vulnerabilidade crítica nova no `npm audit` (ou justificada).

---

## ETAPA 1 — Domínio puro (sem pdf-lib)

### T10 — VO `SizeLimit`
- **DDD:** Value Object imutável. **SOLID-S:** só valida limite.
- **Seam:** `domain/value-objects/size-limit.ts`.
- **RED:** `tests/domain/size-limit.spec.ts`: default `2_800_000`; rejeita `0, -1, NaN, 1.5`; aceita custom `4_800_000`.
- **GREEN:** classe mínima com `readonly bytes`.
- **REFACTOR:** extrair `SAFE_3MB_BYTES`, mensagem de erro de domínio.
- **Aceite:** 100% branches do VO.

### T11 — VO `OutputPrefix` + `filename.ts`
- **DDD:** VO + util `shared/utils/filename.ts`.
- **Seam:** `domain/value-objects/output-prefix.ts`.
- **RED:** sanitize `Doc: Final/v2*?` → `Doc_ Final_v2__`; vazio → `"Documento"`; trunca >60 chars; `Parte_01` padding.
- **GREEN:** regex mínima.
- **REFACTOR:** lista explícita de chars proibidos Windows, função `buildPartName(prefix, index)`.
- **Aceite:** casos Windows cobertos.

### T12 — `PdfErrors` + `PdfPart` entity
- **DDD:** Entity + Errors tipados.
- **Seam:** `domain/entities/pdf-part.ts`, `domain/errors/pdf-errors.ts`.
- **RED:** `EncryptedPdfError(fileName)`, `CorruptPdfError`, `OversizedPageError` distinguíveis por `instanceof`; `PdfPart` exige `oversized: boolean`.
- **GREEN:** classes mínimas.
- **REFACTOR:** união `PdfProcessingError`, type-guard `isEncrypted`.
- **Aceite:** Use Case consegue mapear erro → mensagem UI sem `instanceof` espalhado (usa `code`).

### T13 — `SplitPlanner` (puro, crítico)
- **DDD:** Domain Service. **SOLID-O:** interface `ISplitStrategy`.
- **Seam:** `domain/services/split-planner.ts` — recebe `pageSizes: number[]` + `limit`, retorna `number[][]` (índices por parte). Sem `pdf-lib`.
- **RED (fatia 1):** `[1MB,1MB,1MB] limit 2.8MB` → `[[0,1],[2]]` (literais).
- **RED (fatia 2):** página única `[5MB]` → `[[0]]` + flag `oversizedIndices: [0]`.
- **RED (fatia 3):** `[]` → `[]`.
- **GREEN:** greedy mínimo por fatia.
- **REFACTOR:** extrair `estimatePartSize`, nomear em linguagem de domínio.
- **Aceite:** 5+ casos tabulares, nenhum import de `pdf-lib`.

---

## ETAPA 2 — Aplicação (orquestração via Ports)

### T20 — Ports + DTOs
- **Clean:** `application/ports/pdf-gateway.port.ts` (`load, copyPageTo, save, probePageCount`), `zip-gateway.port.ts`, `dto/process-pdfs.dto.ts`.
- **Seam:** tipos apenas — **RED:** teste de compilação que usa fake in-memory falha sem as interfaces.
- **GREEN:** interfaces mínimas (ISP: sem método a mais).
- **REFACTOR:** nomes `OrderedPdfSource`, `ProcessProgress`.
- **Aceite:** `ProcessPdfsUseCase` compila só contra Ports (DIP verificável por lint `no-restricted-imports` de `pdf-lib` em `application/`).

### T21 — `ProcessPdfsUseCase` (coração, sem mergedPdf)
- **SOLID-S/D:** só orquestra; depende de `IPdfGateway`.
- **Seam:** `application/use-cases/process-pdfs.use-case.ts` com `FakePdfGateway` in-memory.
- **RED-1 (merge ordenado):** 2 fontes `[A(2p), B(1p)]` → partes preservam ordem.
- **RED-2 (corte por tamanho):** usa `SplitPlanner` fake; fecha parte sem última página quando estoura e `pagesInCurrent>1`.
- **RED-3 (oversized):** 1 página > limite → `PdfPart { oversized: true }`, não loop infinito.
- **RED-4 (progresso):** `onProgress` chamado monotônico 0→100.
- **RED-5 (erro isolado):** fonte criptografada → pula arquivo, continua demais, reporta `skipped[]`.
- **GREEN:** implementação mínima por fatia, save com backoff (só serializa quando `estimate>80%` ou a cada K páginas).
- **REFACTOR:** extrair `closeCurrentPart()`, `startNewPartWith(page)`; garantir `yield` ao loop (`await tick()`).
- **Aceite:** todos REDs verdes com fake; zero import `pdf-lib`.

### T22 — `probePageCount` no upload
- **Seam:** Use Case / gateway `probePageCount(file): Promise<number>`.
- **RED:** PDF inválido → `CorruptPdfError`; criptografado → `EncryptedPdfError` (fakes).
- **GREEN:** delega ao adapter.
- **REFACTOR:** cache por `file.lastModified+size`.
- **Aceite:** `PdfSource.pageCount` preenchido antes do split (resolve gap v1).

---

## ETAPA 3 — Infraestrutura (adapters + Worker)

### T30 — `PdfLibGatewayAdapter`
- **Clean:** adapter fino. **SOLID-L:** substituível pelo fake de T21.
- **Seam:** integração leve `tests/infrastructure/pdf-lib.adapter.spec.ts` com 2 PDFs reais pequenos em `tests/fixtures/`.
- **RED:** load 2 páginas reais → `getPageCount()===2`; save round-trip abre.
- **GREEN:** delega a `pdf-lib`, `try/catch` mapeia para `EncryptedPdfError` (detecta `EncryptedPDFError` / mensagem "encrypted") e `CorruptPdfError`.
- **REFACTOR:** `ignoreEncryption: false` (falhar explícito é melhor que silencioso), sem lógica de corte aqui.
- **Aceite:** teste real <5s, fixtures <100KB.

### T31 — `JszipGatewayAdapter`
- **Seam:** `infrastructure/zip/jszip-gateway.adapter.ts`.
- **RED:** 2 parts in-memory → zip contém `Parte_01.pdf`, `Parte_02.pdf` (lê de volta com jszip).
- **GREEN:** `generateAsync({type:"blob"})` mínimo.
- **REFACTOR:** nível compressão `STORE` para PDFs (já comprimidos) — mais rápido.
- **Aceite:** round-trip verificado.

### T32 — Worker + `usePdfProcessor`
- **SOLID-S:** Worker só transporta; hook só gerencia estado.
- **Seam:** `interface/hooks/usePdfProcessor.ts` testado com Worker mock.
- **RED:** `isProcessing true → progress 0..100 → results`; erro → `error` setado, `isProcessing false`.
- **GREEN:** `new Worker(pdf.worker.ts)`, `postMessage({sources, limit, prefix})`, `onmessage` progresso/resultado.
- **REFACTOR:** fallback main-thread se Worker indisponível; `terminate()` no unmount; sem `save()` no render.
- **Aceite:** UI não congela com 100 páginas (manual + E2E mede FPS/progresso fluido).

---

## ETAPA 4 — Interface (Next App Router, tudo `'use client'`)

### T40 — `Dropzone.tsx`
- **Seam:** DOM — Testing Library.
- **RED:** arrasta `.txt` → rejeita com mensagem; arrasta 2 PDFs → `onFiles` com 2 itens; estado `isDragActive` mostra feedback.
- **GREEN:** `react-dropzone` `accept: {"application/pdf": [".pdf"]}`, `maxSize` guard.
- **REFACTOR:** extrair `acceptPdf`, mensagem a11y `role="button" aria-label`.
- **Aceite:** só PDF aceito; teclado acessível.

### T41 — `FileList.tsx` + `FileCard.tsx` (dnd-kit)
- **Seam:** DOM.
- **RED-1:** lista 3 arquivos → reordena 1º→3º via keyboard DnD → `onReorder` com nova ordem.
- **RED-2:** botão remover → `onRemove(id)`; exibe `nome + tamanho formatado + pageCount`.
- **GREEN:** `@dnd-kit/sortable` + `SortableContext`, `FileCard` burro.
- **REFACTOR:** `id: crypto.randomUUID()`, `formatBytes` em `shared/utils`.
- **Aceite:** funciona com teclado (a11y) + mouse; StrictMode sem erro.

### T42 — `SettingsPanel.tsx`
- **Seam:** DOM.
- **RED:** default prefix `Documento_Processado`, opções `2.8 / 4.8 / 9.8 MB` + custom; custom `0` → erro inline; seleciona `2.8` → `onChange({ maxSizeBytes: 2_800_000 })` (literal decimal, não MiB).
- **GREEN:** radio + input numérico mínimo.
- **REFACTOR:** constantes `PRESET_LIMITS`, label explica margem ("portais de 3MB usam 2.8MB").
- **Aceite:** conversão MB→bytes sempre `MB*1_000_000` (documentado, resolve ambiguidade v1).

### T43 — `page.tsx` + `ProcessProgressBar.tsx`
- **Seam:** DOM/integração hook mockado.
- **RED:** estados `files/isProcessing/progress/results`; processar sem arquivos → botão desabilitado; durante → barra 0..100; depois → `DownloadSection` aparece.
- **GREEN:** `useState` + `usePdfProcessor`, `'use client'` no topo.
- **REFACTOR:** `MAX_FILES=20`, `MAX_TOTAL_BYTES=200MB` bloqueiam antes do Worker.
- **Aceite:** nenhum `await gateway` no render; `page.tsx` <100 linhas (lógica no hook/UseCase).

### T44 — `DownloadSection.tsx` (zip + revoke + oversized)
- **Seam:** DOM com `IZipGateway` mock.
- **RED-1:** lista `name/size/pageCount`; **RED-2:** clica zip → blob chamado; **RED-3:** part `oversized` → alerta vermelho "página X sozinha excede o limite"; **RED-4:** troca `results` → `revokeObjectURL` chamado.
- **GREEN:** `createObjectURL` por part + zip, download individual + `.zip`.
- **REFACTOR:** hook `useObjectUrls(results)` com cleanup.
- **Aceite:** sem leak (verificado por mock de revoke).

---

## ETAPA 5 — Cross-cutting

### T50 — Erros + limites
- **Seam:** `ProcessPdfsUseCase` + `page.tsx`.
- **RED:** PDF criptografado → toast "remova a senha"; corrompido → "arquivo inválido: nome"; >20 arquivos ou >200MB → bloqueio com mensagem.
- **GREEN:** mapeamento `code → mensagem` centralizado.
- **REFACTOR:** dicionário `ERROR_MESSAGES`, sem string solta em componente.
- **Aceite:** nenhum throw não tratado chega ao console em fluxo normal.

### T51 — Privacidade + a11y + responsivo
- **RED:** teste E2E/axe: footer contém "100% local"; sem request `fetch/xhr` externo durante processamento (intercept Playwright); contraste axe sem violação crítica.
- **GREEN:** selo footer + `Content-Security-Policy: connect-src 'self' blob:` + layout mobile-first.
- **REFACTOR:** `prefers-reduced-motion` na barra.
- **Aceite:** Lighthouse a11y ≥90.

---

## ETAPA 6 — Qualidade final e deploy

### T60 — E2E + perf + deploy estático
- **Seam:** Playwright `tests/e2e/happy-path.spec.ts`.
- **RED:** upload 2 PDFs fixture → reordena → limite 2.8MB → processa → baixa zip com N parts (falha sem app).
- **GREEN:** fluxo passa local.
- **REFACTOR:** otimizar `K` do backoff (medir `save()` ms), lazy-load `pdf-lib` via `dynamic import`, `output: 'export'` + deploy Vercel/Netlify.
- **Aceite:** build estático serve de CDN sem servidor; E2E verde em CI.

---

## Ordem de execução sugerida

```
T01 → T02 → T10 → T11 → T12 → T13 → T20 → T21 → T22 → T30 → T31 → T32 → T40 → T41 → T42 → T43 → T44 → T50 → T51 → T60
```

Cada seta = fatia vertical entregue e verde antes da próxima. Se T21 travar, volte a T13 (o corte puro) — nunca empurre lógica de domínio para o adapter.
