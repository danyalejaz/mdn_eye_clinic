import { PDFDocument, PageSizes, StandardFonts } from "pdf-lib";

export async function renderPdf(title: string, lines: readonly string[]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.setTitle(title);
  const margin = 48;
  const size = 11;
  const lineHeight = 17;
  let page = document.addPage(PageSizes.A4);
  let y = page.getHeight() - margin;
  const maxWidth = page.getWidth() - 2 * margin;
  const charset = new Set(font.getCharacterSet());

  for (const line of [title, "", ...lines].flatMap((value) => value.split(/\r\n|\n|\r/))) {
    // Fail without altering clinical text when the deployment font cannot render it.
    if ([...line].some((character) => !charset.has(character.codePointAt(0)!))) return null;
    let segment = "";
    for (const character of line) {
      if (font.widthOfTextAtSize(segment + character, size) > maxWidth) {
        page.drawText(segment, { x: margin, y, font, size });
        y -= lineHeight;
        if (y < margin) {
          page = document.addPage(PageSizes.A4);
          y = page.getHeight() - margin;
        }
        segment = "";
      }
      segment += character;
    }
    page.drawText(segment, { x: margin, y, font, size });
    y -= lineHeight;
    if (y < margin) {
      page = document.addPage(PageSizes.A4);
      y = page.getHeight() - margin;
    }
  }
  return document.save();
}
