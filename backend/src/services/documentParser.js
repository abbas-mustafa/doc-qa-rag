import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Extracts raw text (and page boundaries, where available) from an uploaded file.
export async function parseDocument(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return { text: result.text, pages: null, pageCount: result.numpages };
  }

  if (mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value, pages: null, pageCount: null };
  }

  if (mimeType === 'text/plain') {
    const text = await fs.readFile(filePath, 'utf-8');
    return { text, pages: null, pageCount: null };
  }

  throw new Error(`Unsupported mime type: ${mimeType}`);
}
