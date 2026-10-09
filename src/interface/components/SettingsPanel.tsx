"use client";

import { useState } from "react";

export const PRESET_LIMITS = [
  { label: "2.8 MB", bytes: 2_800_000 },
  { label: "4.8 MB", bytes: 4_800_000 },
  { label: "9.8 MB", bytes: 9_800_000 },
] as const;

interface SettingsPanelProps {
  outputPrefix: string;
  maxSizeBytes: number;
  onPrefixChange: (v: string) => void;
  onLimitChange: (bytes: number) => void;
}

export function SettingsPanel({ outputPrefix, maxSizeBytes, onPrefixChange, onLimitChange }: SettingsPanelProps) {
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const presetSelected = PRESET_LIMITS.some((p) => p.bytes === maxSizeBytes);

  function applyCustom() {
    const v = Number(custom.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setCustomError("Informe um valor maior que zero.");
      return;
    }
    setCustomError(null);
    onLimitChange(Math.round(v * 1_000_000));
  }

  return (
    <section aria-label="Configurações" className="flex flex-col gap-4 rounded-lg border bg-white p-4">
      <div>
        <label htmlFor="output-prefix" className="text-sm font-medium">Prefixo do arquivo</label>
        <input
          id="output-prefix"
          value={outputPrefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          placeholder="Documento_Processado"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Tamanho máximo por parte</legend>
        <p className="text-xs text-zinc-500">Portais de 3 MB usam 2.8 MB de margem.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_LIMITS.map((p) => (
            <label key={p.bytes} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name="max-size"
                checked={maxSizeBytes === p.bytes}
                onChange={() => onLimitChange(p.bytes)}
              />
              {p.label}
            </label>
          ))}
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="max-size"
              checked={!presetSelected}
              onChange={() => custom && applyCustom()}
              aria-label="Tamanho personalizado"
            />
            Personalizado (MB)
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label="Valor personalizado em MB"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex: 5"
            className="w-28 rounded border px-2 py-1 text-sm"
          />
          <button type="button" onClick={applyCustom} className="rounded border px-2 py-1 text-sm">
            Aplicar
          </button>
        </div>
        {customError && <p role="alert" className="mt-1 text-sm text-red-600">{customError}</p>}
      </fieldset>
    </section>
  );
}
