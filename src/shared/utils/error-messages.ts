export const ERROR_MESSAGES = {
  ENCRYPTED_PDF: "PDF protegido por senha — remova a senha e tente de novo.",
  CORRUPT_PDF: "Arquivo inválido ou corrompido.",
  TOO_MANY_FILES: "Limite de 20 arquivos por vez.",
  TOTAL_TOO_LARGE: "Volume total excede 200 MB.",
} as const;

export function messageFor(code: string, fallback: string): string {
  return (ERROR_MESSAGES as Record<string, string>)[code] ?? fallback;
}
