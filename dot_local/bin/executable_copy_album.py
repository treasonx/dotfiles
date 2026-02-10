#!/usr/bin/env python3
"""
Copy audio files belonging to a specific album to a destination directory.

Uses audio file metadata (ID3 tags, Vorbis comments, etc.) to identify album membership,
which is more reliable than relying on filename conventions or directory structure.

Usage:
    copy_album.py <source_dir> <dest_dir> <album_name> [--dry-run] [--prefix]
"""

import argparse
import shutil
from pathlib import Path

from mutagen import File as MutagenFile


def get_album_name(filepath: Path) -> str | None:
    """
    Extract album name from audio file metadata.

    Mutagen provides a unified interface for different audio formats:
    - FLAC uses Vorbis comments (lowercase keys like 'album')
    - MP3 uses ID3 tags (TALB frame)
    - M4A uses MP4 atoms (©alb)
    """
    try:
        audio = MutagenFile(filepath, easy=True)
        if audio is None:
            return None
        # easy=True normalizes tag access across formats
        album = audio.get('album')
        if album:
            return album[0] if isinstance(album, list) else album
    except Exception:
        return None
    return None


def get_track_number(filepath: Path) -> int:
    """Extract track number for proper ordering in destination."""
    try:
        audio = MutagenFile(filepath, easy=True)
        if audio is None:
            return 999
        track = audio.get('tracknumber')
        if track:
            track_str = track[0] if isinstance(track, list) else track
            # Handle "1/12" format
            return int(track_str.split('/')[0])
    except Exception:
        pass
    return 999


def get_artist_name(filepath: Path) -> str:
    """Extract artist name for destination filename."""
    try:
        audio = MutagenFile(filepath, easy=True)
        if audio is None:
            return "Unknown"
        artist = audio.get('artist')
        if artist:
            return artist[0] if isinstance(artist, list) else artist
    except Exception:
        pass
    return "Unknown"


def get_title(filepath: Path) -> str:
    """Extract track title for destination filename."""
    try:
        audio = MutagenFile(filepath, easy=True)
        if audio is None:
            return filepath.stem
        title = audio.get('title')
        if title:
            return title[0] if isinstance(title, list) else title
    except Exception:
        pass
    return filepath.stem


def find_album_files(source_dir: Path, album_name: str) -> list[Path]:
    """Find all audio files in source_dir that belong to the specified album."""
    audio_extensions = {'.flac', '.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac'}
    matches = []

    for filepath in source_dir.iterdir():
        if filepath.suffix.lower() in audio_extensions:
            file_album = get_album_name(filepath)
            if file_album and album_name.lower() in file_album.lower():
                matches.append(filepath)

    # Sort by track number for consistent ordering
    matches.sort(key=lambda f: get_track_number(f))
    return matches


def generate_dest_filename(filepath: Path, track_offset: int, use_prefix: bool) -> str:
    """
    Generate destination filename with sequential numbering.

    Format: NNN. Artist - Title.ext
    This matches the existing convention in the _christmas directory.
    """
    track_num = get_track_number(filepath)
    artist = get_artist_name(filepath)
    title = get_title(filepath)
    ext = filepath.suffix

    if use_prefix:
        return f"{track_offset + track_num:03d}. {artist} - {title}{ext}"
    else:
        return f"{artist} - {title}{ext}"


def get_next_track_number(dest_dir: Path) -> int:
    """Find the highest existing track number in destination to continue from."""
    max_num = 0
    for f in dest_dir.iterdir():
        if f.is_file() and f.name[0].isdigit():
            try:
                num = int(f.name.split('.')[0])
                max_num = max(max_num, num)
            except ValueError:
                pass
    return max_num


def main():
    parser = argparse.ArgumentParser(
        description='Copy audio files from a specific album to a destination directory.'
    )
    parser.add_argument('source_dir', type=Path, help='Directory containing audio files')
    parser.add_argument('dest_dir', type=Path, help='Destination directory')
    parser.add_argument('album_name', help='Album name to search for (case-insensitive partial match)')
    parser.add_argument('--dry-run', '-n', action='store_true',
                        help='Show what would be copied without actually copying')
    parser.add_argument('--prefix', '-p', action='store_true',
                        help='Add sequential number prefix (continues from existing files in dest)')

    args = parser.parse_args()

    if not args.source_dir.is_dir():
        print(f"Error: Source directory does not exist: {args.source_dir}")
        return 1

    if not args.dest_dir.is_dir():
        print(f"Error: Destination directory does not exist: {args.dest_dir}")
        return 1

    # Find matching files
    matches = find_album_files(args.source_dir, args.album_name)

    if not matches:
        print(f"No files found with album matching '{args.album_name}'")
        return 1

    print(f"Found {len(matches)} files from album matching '{args.album_name}':\n")

    # Get starting track number if prefixing
    track_offset = get_next_track_number(args.dest_dir) if args.prefix else 0

    for i, filepath in enumerate(matches, 1):
        dest_name = generate_dest_filename(filepath, track_offset, args.prefix)
        dest_path = args.dest_dir / dest_name

        album = get_album_name(filepath)
        print(f"  [{i:2d}] {filepath.name}")
        print(f"       Album: {album}")
        print(f"       → {dest_name}")

        if not args.dry_run:
            shutil.copy2(filepath, dest_path)

    print()
    if args.dry_run:
        print("Dry run - no files were copied.")
    else:
        print(f"Copied {len(matches)} files to {args.dest_dir}")

    return 0


if __name__ == '__main__':
    exit(main())
