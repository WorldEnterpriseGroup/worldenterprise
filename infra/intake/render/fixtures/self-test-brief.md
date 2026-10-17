---
id: self-test-brief
title: Renderer self-test brief
version: "1.0"
updated: 2026-10-10
sentinel: "A renderer that cannot reproduce this exact sentence in both the HTML and the PDF has changed the text of the brief."
sources:
  - { id: s1, title: "Example source, with a comma in the title", publisher: "Example Publisher", url: "https://example.org/source", accessed: 2026-10-10 }
  - id: s2
    title: Block style source
    publisher: Example Publisher
    url: https://example.org/other
    accessed: 2026-10-10
---

This file exercises the brief renderer. It is a test fixture and is never published to the briefs container.

## What the renderer handles

A paragraph with **bold text**, *italic text*, `inline code` and a [link](https://example.org/page). A less-than sign such as <script>alert(1)</script> is escaped, not passed through.

- A bullet with a longer line that wraps onto a second line in the source
  and continues here.
- A second bullet
  - A nested bullet

1. A numbered step
2. Another numbered step

## Tables and quotes

| Column | Meaning |
| --- | --- |
| One | The first column |
| Two | The second column |

> A quotation, rendered as a block quote.

## A fenced block

```
text in a fenced block, with <angle brackets> & ampersands
```

A line that has to survive the round trip: A renderer that cannot reproduce this exact sentence in both the HTML and the PDF has changed the text of the brief.
