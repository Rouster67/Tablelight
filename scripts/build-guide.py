# SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors.
"""Build the offline guide from the deliberately small Markdown dialect in GUIDE.md."""
import argparse
import hashlib
import json
import re
from html import escape
from pathlib import Path

from pypdf import PdfReader
from reportlab import Version as reportlab_version
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/user-guide"
PDF = ROOT / "docs/Tablelight-User-Guide.pdf"


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def inline(text):
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r"<font name='Guide'>\1</font>", text)
    return re.sub(r"\[([^]]+)\]\(#([a-z0-9-]+)\)", r'<link href="#\2" color="#205f59"><u>\1</u></link>', text)


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--draft", action="store_true", help="Produce a visibly marked development draft")
    options = args.parse_args()
    status = "draft" if options.draft else "final"
    version = json.loads((ROOT / "package.json").read_text())['version']
    capture = json.loads((SOURCE / "captures.json").read_text())
    if capture['appVersion'] != version:
        raise ValueError("Screenshots belong to a different app version. Recapture them.")
    for name, expected in capture['uiInputs'].items():
        if sha(ROOT / name) != expected:
            raise ValueError(f"UI changed since capture: {name}. Recapture affected screenshots.")
    for suffix, file in [("", "Vera.ttf"), ("Bold", "VeraBd.ttf"), ("Italic", "VeraIt.ttf"), ("BoldItalic", "VeraBI.ttf")]:
        pdfmetrics.registerFont(TTFont("Guide" + suffix, str(SOURCE / "fonts" / file)))
    pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold", italic="GuideItalic", boldItalic="GuideBoldItalic")
    body = ParagraphStyle("Body", fontName="Guide", fontSize=11, leading=16, textColor=colors.HexColor('#243431'), spaceAfter=10)
    title = ParagraphStyle("Title", parent=body, fontName="GuideBold", fontSize=30, leading=38, spaceAfter=22)
    heading = ParagraphStyle("Chapter", parent=body, fontName="GuideBold", fontSize=22, leading=28, spaceAfter=17, keepWithNext=True)
    sub = ParagraphStyle("Section", parent=body, fontName="GuideBold", fontSize=14, leading=19, spaceBefore=13, spaceAfter=9, keepWithNext=True)
    caption = ParagraphStyle("Caption", parent=body, fontSize=10, leading=14, textColor=colors.HexColor('#45635c'), spaceBefore=8, spaceAfter=16)
    numbered = ParagraphStyle("Steps", parent=body, leftIndent=20, firstLineIndent=-20)
    footer = ParagraphStyle("Footer", parent=body, fontSize=8, leading=10, alignment=TA_CENTER)

    class GuideDoc(BaseDocTemplate):
        def afterFlowable(self, flowable):
            if hasattr(flowable, 'destination'):
                self.canv.bookmarkPage(flowable.destination)
                self.canv.addOutlineEntry(flowable.getPlainText(), flowable.destination, flowable.depth)
                self.notify('TOCEntry', (flowable.depth, flowable.getPlainText(), self.page, flowable.destination))

    def page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#b5c8c1'))
        canvas.line(48, 47, 564, 47)
        p = Paragraph(f"Tablelight {version} {'| DEVELOPMENT DRAFT' if options.draft else '| User guide'} | {doc.page}", footer)
        p.wrap(516, 25)
        p.drawOn(canvas, 48, 30)
        canvas.restoreState()

    doc = GuideDoc(str(PDF), pagesize=(612, 792), leftMargin=48, rightMargin=48, topMargin=46, bottomMargin=64,
                   title=f"Tablelight {version} illustrated user guide" + (" - DEVELOPMENT DRAFT" if options.draft else ""),
                   author="Tablelight contributors", subject=f"Offline guide; app {version}; status {status}",
                   lang="en-US", invariant=1, initialFontName="Guide")
    doc.addPageTemplates(PageTemplate(id="Guide", frames=[Frame(48, 64, 516, 682, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page))
    story = [Spacer(1, 75), Paragraph("TABLELIGHT", title), Paragraph("Illustrated user guide", heading),
             Paragraph(f"App version {version}", sub), Spacer(1, 26),
             Paragraph("DEVELOPMENT DRAFT" if options.draft else "Offline edition", sub),
             Paragraph("Guide integration and layout prototype. The extensive final manual is still in preparation. This draft is for testing only and is blocked from release packaging." if options.draft else "Read the guide alongside your session. All essential text, images and navigation are bundled locally.", body),
             Spacer(1, 20), Paragraph("Original examples. Real Tablelight screenshots. Linked contents and bookmarks.", body),
             Spacer(1, 60), Paragraph("Copyright (C) 2026 Tablelight contributors. GPL-3.0-or-later. Font licenses are included with the editable guide source. Tablelight is an independent manual tracker; no game rulebook text is included.", caption), PageBreak(), Paragraph("Contents", heading)]
    toc = TableOfContents()
    toc.tableStyle.add('FONTNAME', (0, 0), (-1, -1), 'Guide')
    toc.levelStyles = [ParagraphStyle("Contents chapter", parent=body, fontName="GuideBold", fontSize=12, leading=18, spaceBefore=12), ParagraphStyle("Contents section", parent=body, leftIndent=18, fontSize=10, leading=15)]
    story += [toc, PageBreak()]
    lines = (SOURCE / "GUIDE.md").read_text(encoding="utf8").replace('{{version}}', version).splitlines()
    paragraphs = []
    current = []
    for line in lines + ['']:
        if not line.strip() or line.startswith(('# ', '## ', '![', '1. ', '2. ', '3. ', '4. ', '5. ')):
            if current:
                paragraphs.append(' '.join(current))
                current = []
        if line.strip():
            current.append(line.strip())
    chapters = 0
    destinations = []
    for text in paragraphs:
        if text.startswith('#'):
            depth = 1 if text.startswith('## ') else 0
            label = text[3 if depth else 2:]
            if not depth:
                if chapters:
                    story.append(PageBreak())
                chapters += 1
            p = Paragraph(inline(label), sub if depth else heading)
            p.destination, p.depth = slug(label), depth
            if p.destination in destinations:
                raise ValueError('Duplicate heading: ' + label)
            destinations.append(p.destination)
            story.append(p)
        elif text.startswith('!['):
            match = re.fullmatch(r'!\[([^]]+)\]\((images/[^)]+)\)', text)
            if not match:
                raise ValueError('Invalid image block: ' + text)
            alt, name = match.groups()
            image_path = SOURCE / name
            size = ImageReader(str(image_path)).getSize()
            width = min(516, size[0] * 0.85)
            height = width * size[1] / size[0]
            if height > 330:
                width *= 330 / height
                height = 330
            story.append(KeepTogether([Image(str(image_path), width=width, height=height, hAlign='LEFT'), Paragraph(inline(alt), caption)]))
        else:
            story.append(Paragraph(inline(text), numbered if re.match(r'\d+\. ', text) else body))
    doc.multiBuild(story)
    reader = PdfReader(PDF)
    text = '\n'.join(p.extract_text() for p in reader.pages)
    if version not in text or not reader.outline:
        raise ValueError('PDF metadata or navigation is incomplete')
    links = sum(len(p.get('/Annots', [])) for p in reader.pages)
    fonts = set()
    page_ids = {p.indirect_reference.idnum for p in reader.pages}
    for p in reader.pages:
        for reference in p['/Resources']['/Font'].values():
            font = reference.get_object()
            descriptor = font.get('/FontDescriptor')
            if not descriptor or not any(key in descriptor for key in ('/FontFile', '/FontFile2', '/FontFile3')):
                raise ValueError('Unembedded PDF font: ' + str(font['/BaseFont']))
            fonts.add(str(font['/BaseFont']))
        for reference in p.get('/Annots', []):
            link = reference.get_object()
            destination = link.get('/Dest')
            if not destination or destination[0].idnum not in page_ids:
                raise ValueError('Invalid or nonlocal PDF link')
    def verify_bookmarks(items):
        for item in items:
            if isinstance(item, list):
                verify_bookmarks(item)
            else:
                page_number = reader.get_destination_page_number(item)
                if page_number is None or item.title not in reader.pages[page_number].extract_text():
                    raise ValueError('Bookmark does not reach its heading')
    verify_bookmarks(reader.outline)
    inputs = {name: sha(ROOT / name) for name in capture['uiInputs']}
    sources = [ROOT / 'scripts/build-guide.py', ROOT / 'package.json']
    sources += [p for p in SOURCE.rglob('*') if p.is_file() and p.name not in ('manifest.json', 'review.json', 'README.md', 'COVERAGE.md')]
    for file in sorted(sources):
        inputs[file.relative_to(ROOT).as_posix()] = sha(file)
    manifest = dict(schema=1, status=status, appVersion=version, sourceRevision=capture['sourceRevision'],
                    pdf='docs/Tablelight-User-Guide.pdf', pdfSha256=sha(PDF), pages=len(reader.pages),
                    bookmarks=len(destinations), links=links, embeddedFonts=sorted(fonts), generator=f'ReportLab {reportlab_version}', inputs=inputs)
    (SOURCE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print(f"Built {status} PDF: {len(reader.pages)} pages, {len(destinations)} bookmarks, {links} links.")


if __name__ == '__main__':
    main()
