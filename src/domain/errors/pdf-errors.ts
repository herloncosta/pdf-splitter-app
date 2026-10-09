export class EncryptedPdfError extends Error {
  readonly code = "ENCRYPTED_PDF";
  constructor(readonly fileName: string) {
    super(`PDF protegido por senha: ${fileName}`);
    this.name = "EncryptedPdfError";
  }
}

export class CorruptPdfError extends Error {
  readonly code = "CORRUPT_PDF";
  constructor(readonly fileName: string) {
    super(`PDF inválido ou corrompido: ${fileName}`);
    this.name = "CorruptPdfError";
  }
}

export type PdfProcessingError = EncryptedPdfError | CorruptPdfError;
