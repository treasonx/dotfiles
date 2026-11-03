"""Offline integration checks against real chezmoi in a disposable home."""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[1]
RESTORE = REPO / "dot_local/bin/executable_restore_laptop"


@unittest.skipUnless(shutil.which("chezmoi"), "chezmoi is required")
class LaptopRestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="laptop-restore-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.config = self.root / "chezmoi.toml"
        self.config.write_text('[data]\nmachine = "laptop"\n')

    def restore(self, *extra):
        return subprocess.run(
            [sys.executable, str(RESTORE), "--source", str(REPO),
             "--config", str(self.config), "--destination", str(self.home), *extra],
            capture_output=True, text=True, check=False,
        )

    def test_preview_does_not_deploy_files(self):
        result = self.restore()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(list(self.home.iterdir()), [])
        self.assertIn("--dry-run", result.stdout)

    def test_fresh_restore_is_complete_and_preserves_gui_edits(self):
        result = self.restore("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        for relative in [".config/niri/config.kdl", ".config/ghostty/config",
                         ".config/noctalia/config.toml", ".config/zsh/.zshrc",
                         ".local/bin/j_lib.py", ".local/bin/restore_laptop"]:
            self.assertTrue((self.home / relative).is_file(), relative)
        self.assertFalse((self.home / ".config/systemd").exists())
        self.assertFalse((self.home / ".local/bin/webview_zone").exists())
        self.assertFalse((self.home / ".local/bin/fabric").exists())
        local_shell = self.home / ".config/zsh/zshrc.local"
        shell = subprocess.run(["zsh", "-fc", 'source "$1"', "zsh", str(local_shell)],
                               capture_output=True, text=True, check=True)
        self.assertEqual(shell.stdout, "")
        seed = self.home / ".local/state/noctalia/settings.toml"
        self.assertNotIn("HDMI-A-1", seed.read_text())
        self.assertNotIn("DP-3", seed.read_text())
        seed.write_text(seed.read_text() + "\n# local GUI change\n")
        before = seed.read_bytes()
        result = self.restore("--apply")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(seed.read_bytes(), before)

    def test_desktop_is_rejected_without_writes(self):
        self.config.write_text('[data]\nmachine = "desktop"\n')
        result = self.restore("--apply")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("machine must be laptop", result.stderr)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_greeter_is_opt_in_for_existing_configs(self):
        for profile in ["laptop", "desktop"]:
            self.config.write_text(f'[data]\nmachine = "{profile}"\n')
            result = subprocess.run(
                ["chezmoi", "--source", str(REPO), "--config", str(self.config),
                 "execute-template", "--file", str(REPO / "run_once_install-sddm-noctalia.sh.tmpl")],
                capture_output=True, text=True, check=True,
            )
            self.assertLess(result.stdout.index("exit 0"), result.stdout.index("exec bash"))


if __name__ == "__main__":
    unittest.main()
