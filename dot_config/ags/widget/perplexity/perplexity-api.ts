import GLib from "gi://GLib"
import { Process } from "ags/process"
import type { SearchResult } from "./perplexity-state"

const SCRIPT = GLib.build_filenamev([GLib.get_home_dir(), ".local", "bin", "perplexity_chat.py"])

// ── API Key ────────────────────────────────────────────────────────

export function getApiKey(): string | null {
  return GLib.getenv("PERPLEXITY_API_KEY") ?? null
}

// ── Streaming via Python subprocess ────────────────────────────────

/**
 * Stream a chat completion from the Perplexity API.
 *
 * Spawns perplexity_chat.py as a subprocess, writes the request JSON
 * to its stdin, and reads NDJSON events from stdout. This avoids GJS
 * Soup SSE streaming issues — Python handles HTTP, AGS handles UI.
 *
 * Returns a kill function to abort the stream (replaces Gio.Cancellable).
 */
export function streamChat(
  messages: { role: string; content: string }[],
  onToken: (token: string) => void,
  onCitations: (citations: string[], searchResults: SearchResult[]) => void,
  onError: (error: Error) => void,
  onDone: () => void,
): () => void {
  const apiKey = getApiKey()
  if (!apiKey) {
    onError(new Error("PERPLEXITY_API_KEY not set. Add it to your environment and restart AGS."))
    return () => {}
  }

  let done = false

  const proc = new Process({ argv: [SCRIPT] })

  proc.connect("stdout", (_: any, line: string) => {
    if (done) return

    try {
      const event = JSON.parse(line)

      switch (event.type) {
        case "token":
          onToken(event.value)
          break

        case "citations":
          onCitations(
            event.citations ?? [],
            (event.search_results ?? []).map((r: any) => ({
              title: r.title ?? "",
              url: r.url ?? "",
              snippet: r.snippet ?? "",
            })),
          )
          break

        case "done":
          done = true
          onDone()
          break

        case "error":
          done = true
          onError(new Error(event.message ?? "Unknown error"))
          break
      }
    } catch {
      // Malformed JSON line — skip
    }
  })

  proc.connect("stderr", (_: any, line: string) => {
    console.error(`[perplexity_chat.py] ${line}`)
  })

  proc.connect("exit", (_: any, code: number, signaled: boolean) => {
    if (done) return
    done = true

    if (signaled) {
      // Killed by us (cancellation) — treat as normal completion
      onDone()
    } else if (code !== 0) {
      onError(new Error(`perplexity_chat.py exited with code ${code}`))
    } else {
      // Clean exit without a "done" event — shouldn't happen, but handle it
      onDone()
    }
  })

  // Write the request to stdin — Python reads a single JSON line
  // Note: use write() not writeAsync() — writeAsync uses write_all_async
  // which mishandles Uint8Array in GJS (sends raw memory instead of buffer)
  const payload = JSON.stringify({ messages }) + "\n"
  proc.write(payload)

  // Return a kill function for cancellation
  return () => {
    if (!done) {
      done = true
      proc.kill()
    }
  }
}
