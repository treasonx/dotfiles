---
date: 2026-11-03
topic: encrypted-fedora-rebuild
---

# Encrypted Fedora Rebuild

## Problem Frame

The secondary machine uses eCryptfs, which limits filenames to 143 bytes. James wants a fresh encrypted Fedora installation and a familiar desktop based on his primary machine, reachable as `linux-server`. Most secondary-machine data is disposable; preserving the essentials matters more than recreating every installed application.

---

## Requirements

- R1. Install Fedora with LUKS2 encryption for the system and home data, removing the eCryptfs layer and its filename restriction.
- R2. Restore niri, keybindings, shell, terminal, and theme using the actual configuration on `linux-server`, including relevant uncommitted and unmanaged settings.
- R3. Adapt the restored desktop to the secondary machine's hardware; do not copy primary-machine monitor or GPU assumptions blindly.
- R4. Exclude the primary machine's webview, its startup service, and automatic launch behavior on this machine.
- R5. Use Fedora's default login screen and make niri available as a login session. Custom login-screen themes are excluded.
- R6. Generate new SSH keys after reinstalling and authorize them from the primary machine. Existing secondary-machine private keys are not part of the restoration target.
- R7. Before any wipe, preserve the selected restoration material and recovery instructions off the secondary machine and verify they are readable. Keep secrets outside the public dotfiles repository.
- R8. Preserve existing uncommitted repo work on both machines before any reconciliation. Planning and inspection must not alter the primary machine's working desktop.
- R9. Provide a concise recovery checklist covering access to the repository before new SSH keys are authorized, installation, restoration, and verification.

---

## Key Flow

Audit the primary desktop and the secondary machine's local changes; capture the selected configuration and instructions off-machine; verify recovery access; explicitly confirm the wipe target before installation; reinstall encrypted Fedora; restore essentials; generate and authorize new SSH keys; verify the desktop. If the recovery material is incomplete or inaccessible, stop before wiping.

---

## Success Criteria

- Fedora boots with encrypted system/home storage, and a 255-byte filename can be created in the restored home.
- The default login screen can start niri; familiar keybindings, terminal, shell, and theme work on the secondary hardware.
- No primary-machine webview process or startup service runs here, including after reboot.
- Fresh SSH credentials provide intended access to `linux-server` and GitHub.
- Restoration instructions and selected configuration remain accessible independently of the reinstalled machine.
- The primary machine's desktop and existing uncommitted work remain intact.

---

## Scope Boundaries

- No full application, development-environment, session-history, or bulk-data restoration.
- No promise of a universal automated workstation provisioning system.
- Necessary desktop dependencies and scripts invoked by retained essential keybindings are included; unrelated tools can be installed later.
- This brainstorm authorizes documentation and read-only inspection, not wiping, installing, or modifying the primary machine.

---

## Verified Context

- Secondary machine: Fedora 45, eCryptfs home, Btrfs root and home subvolumes sharing one unencrypted partition; approximately 764 GB available at inspection.
- Primary machine: SSH alias `linux-server`, hostname `fedora`, Fedora 44; chezmoi machine profile is `desktop`.
- Both repos have uncommitted changes. The primary has changes to niri, shell, dependency inventory, and webview files, among others.
- Primary Noctalia has both configuration files and GUI override state; selection requires auditing beyond Git alone.
- Existing starting points: `README.md`, `DEPENDENCIES.md`, `.chezmoi.toml.tmpl`, `.chezmoiignore.tmpl`, and `dot_config/niri/config.kdl.tmpl`. Local dependency documentation and current Noctalia instructions differ, so they cannot yet be treated as a verified reinstall recipe.

---

## Outstanding Questions — Deferred to Planning

- Audit exact configuration drift and essential script dependencies on the primary; distinguish preferences from hardware-specific settings and secrets.
- Choose and verify off-machine storage for the recovery bundle, potentially on `linux-server`; document access without the old SSH keys.
- Inspect secondary hardware and decide the correct chezmoi profile and webview exclusion mechanism.
- Verify current Fedora installation options, desktop package sources, default login-manager session integration, and media requirements.
- Identify any small secondary-only items worth keeping during the audit; do not expand into a full data migration without a new decision.

---

## Next Steps

Proceed to `ce-plan` for an auditable capture, reinstall, and restoration checklist. No disk changes occur during planning.
