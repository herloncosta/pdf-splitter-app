"use client";

import { formatBytes } from "@/shared/utils/formatters";
import type { PdfSourceView } from "./pdf-source";

interface FileCardProps {
  source: PdfSourceView;
  isFirst: boolean;
  isLast: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

export function FileCard({ source, isFirst, isLast, dragHandleProps, onRemove, onMoveUp, onMoveDown }: FileCardProps) {
  return (
    <li
      data-testid={`file-card-${source.id}`}
      className="flex items-center gap-3 rounded-md border bg-white p-3"
    >
      <div {...dragHandleProps} aria-hidden className="cursor-grab touch-none select-none text-zinc-400" title="Arrastar para reordenar">
        ⠿
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{source.fileName}</p>
        <p className="text-xs text-zinc-500">
          {formatBytes(source.sizeBytes)}
          {source.pageCount !== null && ` • ${source.pageCount} pág.`}
          {source.status === "probing" && " • lendo…"}
          {source.status === "error" && ` • erro: ${source.errorMessage ?? "falha ao ler"}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Mover ${source.fileName} para cima`} disabled={isFirst} onClick={() => onMoveUp(source.id)} className="rounded px-2 py-1 text-xs disabled:opacity-30">
          ↑
        </button>
        <button type="button" aria-label={`Mover ${source.fileName} para baixo`} disabled={isLast} onClick={() => onMoveDown(source.id)} className="rounded px-2 py-1 text-xs disabled:opacity-30">
          ↓
        </button>
        <button type="button" aria-label={`Remover ${source.fileName}`} onClick={() => onRemove(source.id)} className="rounded px-2 py-1 text-xs text-red-600">
          Remover
        </button>
      </div>
    </li>
  );
}
