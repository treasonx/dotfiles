import GLib from "gi://GLib"

/**
 * Convert markdown text to Pango markup for Gtk.Label with useMarkup=true.
 *
 * Supports: bold, italic, headings, inline code, fenced code blocks,
 * links, lists, blockquotes, and Perplexity citation markers [N].
 *
 * All raw text is escaped via GLib.markup_escape_text to prevent
 * Pango parse errors from <, >, & in content.
 */
export function markdownToPango(md: string, citations?: string[]): string {
  const lines = md.split("\n")
  const result: string[] = []
  let inCodeBlock = false
  let codeBlockLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Toggle fenced code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // End code block — render accumulated code
        const code = escapeMarkup(codeBlockLines.join("\n"))
        result.push(
          `<span font_family="monospace" background="#313244" foreground="#cdd6f4"> ${code} </span>`,
        )
        codeBlockLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    result.push(convertLine(line, citations))
  }

  // Handle unclosed code block (streaming — fence opened but not closed yet)
  if (inCodeBlock && codeBlockLines.length > 0) {
    const code = escapeMarkup(codeBlockLines.join("\n"))
    result.push(
      `<span font_family="monospace" background="#313244" foreground="#cdd6f4"> ${code} </span>`,
    )
  }

  return result.join("\n")
}

function convertLine(line: string, citations?: string[]): string {
  // Headings
  if (line.startsWith("### ")) {
    return `<b>${convertInline(line.slice(4), citations)}</b>`
  }
  if (line.startsWith("## ")) {
    return `<span size="large"><b>${convertInline(line.slice(3), citations)}</b></span>`
  }
  if (line.startsWith("# ")) {
    return `<span size="x-large"><b>${convertInline(line.slice(2), citations)}</b></span>`
  }

  // Blockquotes
  if (line.startsWith("> ")) {
    return `<i>▎ ${convertInline(line.slice(2), citations)}</i>`
  }

  // Unordered lists
  if (/^[-*] /.test(line)) {
    return `  • ${convertInline(line.slice(2), citations)}`
  }

  // Ordered lists
  const orderedMatch = line.match(/^(\d+)\. (.*)/)
  if (orderedMatch) {
    return `  ${orderedMatch[1]}. ${convertInline(orderedMatch[2], citations)}`
  }

  // Horizontal rules
  if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
    return "─────────────────────"
  }

  // Regular line
  return convertInline(line, citations)
}

/**
 * Convert inline markdown elements to Pango markup.
 * Order matters: process code first (to avoid interpreting markdown inside code),
 * then bold, italic, links, and citations.
 */
function convertInline(text: string, citations?: string[]): string {
  // Split on inline code spans first to avoid processing markdown inside them
  const parts = text.split(/(`[^`]+`)/)
  const processed = parts.map((part) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      // Inline code — escape and wrap in <tt>
      const code = escapeMarkup(part.slice(1, -1))
      return `<tt>${code}</tt>`
    }

    // Process markdown in non-code segments
    let s = escapeMarkup(part)

    // Bold: **text** or __text__
    s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    s = s.replace(/__(.+?)__/g, "<b>$1</b>")

    // Italic: *text* or _text_ (but not inside words for underscore)
    s = s.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "<i>$1</i>")
    s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>")

    // Strikethrough: ~~text~~
    s = s.replace(/~~(.+?)~~/g, "<s>$1</s>")

    // Links: [text](url)
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>',
    )

    // Citation markers: [1], [2], etc.
    if (citations && citations.length > 0) {
      s = s.replace(/\[(\d+)\]/g, (match, numStr) => {
        const idx = parseInt(numStr, 10) - 1
        if (idx >= 0 && idx < citations.length) {
          return `<a href="${escapeMarkup(citations[idx])}">[${numStr}]</a>`
        }
        return match
      })
    }

    return s
  })

  return processed.join("")
}

function escapeMarkup(text: string): string {
  // GLib.markup_escape_text expects (string, length) — pass -1 for auto-length
  return GLib.markup_escape_text(text, -1)
}
