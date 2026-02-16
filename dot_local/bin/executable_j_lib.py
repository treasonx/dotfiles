#!/usr/bin/env python3
"""Shared argument parser for j-launcher scripts.

Wraps argparse.ArgumentParser with a --_j_meta flag that outputs JSON
describing all arguments, enabling the j launcher to walk users through
required and optional args interactively.

Usage in scripts:
    from j_lib import JParser
    parser = JParser(description="My script")
    parser.add_argument("input", help="Input file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose")
    args = parser.run()
"""

import argparse
import json
import sys


class JParser(argparse.ArgumentParser):
    """Drop-in argparse replacement with --_j_meta introspection."""

    def run(self, args=None):
        """Check for --_j_meta, otherwise parse_args() as normal."""
        raw = args if args is not None else sys.argv[1:]
        if "--_j_meta" in raw:
            self._print_meta()
            sys.exit(0)
        return self.parse_args(raw)

    def _print_meta(self):
        meta = {"description": self.description or "", "args": []}
        for action in self._actions:
            if isinstance(action, argparse._HelpAction):
                continue
            if action.dest == "_j_meta":
                continue
            is_flag = isinstance(
                action,
                (argparse._StoreTrueAction, argparse._StoreFalseAction),
            )
            is_count = isinstance(action, argparse._CountAction)
            positional = not bool(action.option_strings)
            # Required: positional args are always required unless nargs makes
            # them optional; optional args check the .required attribute.
            if positional:
                required = action.nargs not in ("?", "*")
            else:
                required = getattr(action, "required", False)
            info = {
                "name": action.dest,
                "help": action.help or "",
                "positional": positional,
                "is_flag": is_flag or is_count,
                "required": required,
                "default": _serialise(action.default),
                "choices": list(action.choices) if action.choices else None,
                "flags": action.option_strings if action.option_strings else None,
                "metavar": action.metavar,
            }
            meta["args"].append(info)
        json.dump(meta, sys.stdout)

    # Allow subparsers — expose add_subparsers transparently.
    # Scripts with subcommands (like download_tidal) will just have their
    # top-level meta emitted; subcommand args won't appear (users pick the
    # subcommand first, then j falls back to --help for the rest).


def _serialise(val):
    """Make argparse defaults JSON-safe."""
    if val is None or val is argparse.SUPPRESS:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    return str(val)
