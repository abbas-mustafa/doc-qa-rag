// Extracts raw text (and page boundaries, where available) from an uploaded file.
// To be implemented next session using pdf-parse (PDF) and mammoth (DOCX).

export async function parseDocument(filePath, mimeType) {
  // TODO: branch on mimeType
  // - application/pdf -> pdf-parse, return { text, pages: [{ pageNumber, text }] }
  // - .docx -> mammoth.extractRawText, return { text, pages: null }
  // - text/plain -> fs.readFile, return { text, pages: null }
  throw new Error('parseDocument not yet implemented');
}
