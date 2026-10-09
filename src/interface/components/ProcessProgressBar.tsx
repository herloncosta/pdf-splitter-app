"use client";

export function ProcessProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do processamento">
      <div className="h-2 overflow-hidden rounded bg-zinc-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-1 text-xs text-zinc-500">{Math.round(value)}%</p>
    </div>
  );
}
