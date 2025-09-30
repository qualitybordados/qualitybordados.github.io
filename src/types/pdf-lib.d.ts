declare module 'pdf-lib' {
  export const StandardFonts: Record<string, string>
  export function rgb(r: number, g: number, b: number): { r: number; g: number; b: number }

  export interface PDFFont {
    widthOfTextAtSize(text: string, size: number): number
  }

  export interface PDFPage {
    drawText(text: string, options: Record<string, unknown>): void
    drawRectangle(options: Record<string, unknown>): void
  }

  export class PDFDocument {
    static create(): Promise<PDFDocument>
    addPage(size?: [number, number]): PDFPage
    embedFont(font: string): Promise<PDFFont>
    save(): Promise<Uint8Array>
  }
}
