# `cursor_p` Alias

This alias launches Cursor with a **separate profile** for a personal account:

```bash
alias cursor_p='cursor --user-data-dir "$HOME/.config/Cursor-personal" --extensions-dir "$HOME/.cursor-personal/extensions"'
```

## How it works

The alias uses two Cursor CLI flags:

| Flag | Value | Purpose |
|------|-------|---------|
| `--user-data-dir` | `~/.config/Cursor-personal` | Stores settings, keybindings, and account login separately from the default `~/.config/Cursor` |
| `--extensions-dir` | `~/.cursor-personal/extensions` | Keeps extensions isolated from the default profile |

## To set up on another machine

1. Add the alias to your `.zshrc`:
   ```bash
   alias cursor_p='cursor --user-data-dir "$HOME/.config/Cursor-personal" --extensions-dir "$HOME/.cursor-personal/extensions"'
   ```

2. Reload your shell:
   ```bash
   source ~/.zshrc
   ```

3. Run `cursor_p` — it will create the directories automatically on first launch and prompt you to sign in with your personal account.

This pattern is useful when you need separate Cursor instances for work vs personal accounts, each with their own settings, extensions, and signed-in identity.
