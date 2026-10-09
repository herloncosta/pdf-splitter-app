"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileCard } from "./FileCard";
import type { PdfSourceView } from "./pdf-source";

interface FileListProps {
  sources: PdfSourceView[];
  onReorder: (idsInOrder: string[]) => void;
  onRemove: (id: string) => void;
}

function move(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function SortableRow({
  source, isFirst, isLast, onRemove, onMoveUp, onMoveDown,
}: {
  source: PdfSourceView; isFirst: boolean; isLast: boolean;
  onRemove: (id: string) => void; onMoveUp: (id: string) => void; onMoveDown: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: source.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <FileCard
        source={source}
        isFirst={isFirst}
        isLast={isLast}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRemove={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </div>
  );
}

export function FileList({ sources, onReorder, onRemove }: FileListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = sources.map((s) => s.id);

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    onReorder(next);
  }

  if (sources.length === 0) return <p className="text-sm text-zinc-500">Nenhum PDF na fila.</p>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {sources.map((s, i) => (
            <SortableRow
              key={s.id}
              source={s}
              isFirst={i === 0}
              isLast={i === sources.length - 1}
              onRemove={onRemove}
              onMoveUp={(id) => onReorder(move(ids, id, -1))}
              onMoveDown={(id) => onReorder(move(ids, id, 1))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
