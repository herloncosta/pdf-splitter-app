"use client";

import { useDropzone } from "react-dropzone";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

export function Dropzone({ onFiles }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    onDrop: (accepted) => {
      if (accepted.length > 0) onFiles(accepted);
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        role="button"
        aria-label="Enviar arquivos PDF"
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300 bg-white"
        }`}
      >
        <input {...getInputProps()} data-testid="pdf-input" />
        {isDragActive ? (
          <p>Solte os PDFs aqui…</p>
        ) : (
          <p className="text-sm text-zinc-600">
            Arraste PDFs aqui ou <span className="font-semibold underline">clique para selecionar</span>
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-400">Somente arquivos .pdf</p>
      </div>
      {fileRejections.length > 0 && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {fileRejections.length} arquivo(s) rejeitado(s): somente PDF é aceito.
        </p>
      )}
    </div>
  );
}
