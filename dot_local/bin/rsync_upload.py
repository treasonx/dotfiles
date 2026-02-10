#!/usr/bin/env python3
"""
Upload files to a remote server via rsync over SSH with bandwidth control.

Rsync is ideal for large transfers because:
- Resumes interrupted transfers (--partial)
- Only transfers changed files on subsequent runs (delta sync)
- Supports bandwidth limiting (--bwlimit)
- Compresses data in transit (-z)

Usage:
    rsync_upload.py <source> <user@host:/path> [--speed MBPS] [--dry-run]

Examples:
    # Full speed upload
    rsync_upload.py ~/data user@vps.example.com:/backup/

    # Limit to 20 Mbps
    rsync_upload.py ~/data user@vps.example.com:/backup/ --speed 20

    # Preview what would be transferred
    rsync_upload.py ~/data user@vps.example.com:/backup/ --dry-run
"""

import argparse
import subprocess
import sys


def mbps_to_kbps(mbps: float) -> int:
    """
    Convert megabits per second to kilobytes per second for rsync --bwlimit.

    Network speeds are typically measured in bits, but rsync uses bytes.
    1 Mbps = 125 KB/s (1,000,000 bits / 8 bits per byte / 1000)
    """
    return int(mbps * 125)


def build_rsync_command(
    source: str,
    destination: str,
    speed_mbps: float | None = None,
    dry_run: bool = False,
    compress: bool = True,
    delete: bool = False,
) -> list[str]:
    """
    Build the rsync command with appropriate flags.

    Key flags explained:
    - -a (archive): preserves permissions, timestamps, symlinks, etc.
    - -v (verbose): show files being transferred
    - -h (human-readable): show sizes in KB/MB/GB
    - --partial: keep partially transferred files for resume
    - --progress: show transfer progress per file
    - -z (compress): compress data during transfer (saves bandwidth)
    - --bwlimit: limit bandwidth in KB/s
    """
    cmd = ['rsync', '-avh', '--partial', '--progress']

    if compress:
        # -z compresses during transfer; useful for text/code but less so for
        # already-compressed files (videos, archives). Enable by default.
        cmd.append('-z')

    if speed_mbps is not None:
        bwlimit = mbps_to_kbps(speed_mbps)
        cmd.append(f'--bwlimit={bwlimit}')

    if dry_run:
        # -n shows what would be transferred without doing it
        cmd.append('-n')

    if delete:
        # Remove files on destination that don't exist in source
        # Disabled by default for safety
        cmd.append('--delete')

    # Use SSH with compression disabled (rsync -z handles it)
    # and enable connection keep-alive to prevent drops
    cmd.extend(['-e', 'ssh -o Compression=no -o ServerAliveInterval=60'])

    cmd.append(source)
    cmd.append(destination)

    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Upload files to a remote server via rsync with bandwidth control.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s ~/photos user@vps:/backup/photos/
  %(prog)s ~/videos user@vps:/media/ --speed 20
  %(prog)s ./data server:/data/ --speed 10 --dry-run

Speed reference (approximate transfer times for 200GB):
  40 Mbps (full):  ~11 hours
  20 Mbps:         ~22 hours
  10 Mbps:         ~44 hours
   5 Mbps:         ~88 hours
"""
    )
    parser.add_argument(
        'source',
        help='Local path to upload (file or directory)'
    )
    parser.add_argument(
        'destination',
        help='Remote destination (user@host:/path/)'
    )
    parser.add_argument(
        '--speed', '-s',
        type=float,
        metavar='MBPS',
        help='Bandwidth limit in Mbps (e.g., 20 for 20 Mbps). No limit if not specified.'
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Show what would be transferred without actually transferring'
    )
    parser.add_argument(
        '--no-compress', '-C',
        action='store_true',
        help='Disable compression (useful for already-compressed files like videos)'
    )
    parser.add_argument(
        '--delete',
        action='store_true',
        help='Delete files on destination that do not exist in source (use with caution!)'
    )

    args = parser.parse_args()

    cmd = build_rsync_command(
        source=args.source,
        destination=args.destination,
        speed_mbps=args.speed,
        dry_run=args.dry_run,
        compress=not args.no_compress,
        delete=args.delete,
    )

    # Show the command being run
    print(f"Running: {' '.join(cmd)}\n")

    if args.speed:
        kbps = mbps_to_kbps(args.speed)
        print(f"Bandwidth limit: {args.speed} Mbps (~{kbps} KB/s)\n")

    # Run rsync, streaming output directly to terminal
    # Using subprocess.run with inherited stdout/stderr shows real-time progress
    try:
        result = subprocess.run(cmd)
        return result.returncode
    except KeyboardInterrupt:
        print("\n\nTransfer interrupted. Run again to resume from where you left off.")
        return 130


if __name__ == '__main__':
    sys.exit(main())
