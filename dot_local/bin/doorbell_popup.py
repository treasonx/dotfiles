#!/usr/bin/env python3
"""
Doorbell Video Popup for Hyprland

Connects to eufy-security-ws WebSocket server and displays a video popup
when the doorbell rings. The popup appears in the bottom-left of the
active monitor.

Usage:
    ./doorbell_popup.py [--ws-url URL] [-v]
"""

import argparse
import asyncio
import base64
import json
import logging
import signal
import subprocess
import sys

try:
    import websockets
except ImportError:
    print("Error: websockets library not installed")
    print("Run: pip install websockets")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

MPV_CLASS = "doorbell-popup"


def is_dpms_on() -> bool:
    """Check if any monitor has DPMS on (screen is active)."""
    try:
        result = subprocess.run(
            ["hyprctl", "monitors", "-j"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return True
        monitors = json.loads(result.stdout)
        for monitor in monitors:
            if monitor.get("dpmsStatus", True):
                return True
        return False
    except Exception as e:
        log.warning(f"Error checking DPMS: {e}")
        return True


def get_active_monitor_geometry() -> tuple[int, int, int, int]:
    """Get geometry of active monitor (x, y, width, height)."""
    try:
        result = subprocess.run(
            ["hyprctl", "activeworkspace", "-j"],
            capture_output=True, text=True, timeout=5
        )
        workspace = json.loads(result.stdout)
        monitor_name = workspace.get("monitor", "")

        result = subprocess.run(
            ["hyprctl", "monitors", "-j"],
            capture_output=True, text=True, timeout=5
        )
        monitors = json.loads(result.stdout)

        for mon in monitors:
            if mon.get("name") == monitor_name:
                return (mon.get("x", 0), mon.get("y", 0),
                        mon.get("width", 1920), mon.get("height", 1080))
        if monitors:
            mon = monitors[0]
            return (mon.get("x", 0), mon.get("y", 0),
                    mon.get("width", 1920), mon.get("height", 1080))
    except Exception as e:
        log.warning(f"Error getting monitor geometry: {e}")
    return (0, 0, 1920, 1080)


def send_notification(title: str, body: str, urgency: str = "normal"):
    """Send a notification via notify-send."""
    try:
        subprocess.run(
            ["notify-send", "-u", urgency, "-a", "Doorbell", title, body],
            timeout=5
        )
    except Exception as e:
        log.warning(f"Failed to send notification: {e}")


class DoorbellHandler:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws = None
        self.message_id = 0
        self.devices = {}
        self.active_streams = {}  # serial -> dict with process, etc.
        self.schema_version = 21

    def next_message_id(self) -> str:
        self.message_id += 1
        return f"msg_{self.message_id}"

    async def send_command(self, command: str, **params):
        """Send a command to the WebSocket server."""
        msg = {
            "messageId": self.next_message_id(),
            "command": command,
            **params
        }
        log.debug(f"Sending: {msg}")
        await self.ws.send(json.dumps(msg))

    async def monitor_player(self, serial_number: str):
        """Monitor ffplay process and stop stream when window is closed."""
        while serial_number in self.active_streams:
            stream = self.active_streams.get(serial_number)
            if not stream:
                break

            proc = stream.get("process")
            if proc and proc.poll() is not None:
                # Process exited (user closed window)
                log.info(f"Player closed for {serial_number}, stopping stream")
                await self.stop_livestream(serial_number)
                break

            await asyncio.sleep(0.5)

    async def start_livestream(self, serial_number: str):
        """Start livestream and open video player."""
        if serial_number in self.active_streams:
            log.info(f"Stream already active for {serial_number}")
            return

        if not is_dpms_on():
            log.info("All screens off, skipping video popup")
            send_notification("Doorbell", "Someone is at the door (screens off)")
            return

        log.info(f"Starting livestream for {serial_number}")

        # Calculate window position (bottom-left of active monitor)
        mon_x, mon_y, mon_w, mon_h = get_active_monitor_geometry()
        win_w, win_h = 480, 360
        padding = 20
        win_x = mon_x + padding
        win_y = mon_y + mon_h - win_h - padding

        # Start ffplay reading from stdin
        # ffplay is more forgiving with raw H.264 streams
        ffplay_cmd = [
            "ffplay",
            "-autoexit",
            "-window_title", "[Doorbell]",
            "-x", str(win_w),
            "-y", str(win_h),
            "-left", str(win_x),
            "-top", str(win_y),
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            "-framedrop",
            "-f", "h264",
            "-i", "pipe:0"
        ]

        log.info(f"Starting ffplay")

        try:
            proc = subprocess.Popen(
                ffplay_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            self.active_streams[serial_number] = {
                "process": proc,
                "video_started": False
            }

            # Request the livestream from eufy
            await self.send_command(
                "device.start_livestream",
                serialNumber=serial_number
            )

            # Start monitoring the player in the background
            asyncio.create_task(self.monitor_player(serial_number))

            send_notification("Doorbell", "Someone is at the door!", "critical")

        except Exception as e:
            log.error(f"Failed to start ffplay: {e}")
            self.cleanup_stream(serial_number)

    def write_video_data(self, serial_number: str, data: bytes):
        """Write video data to ffplay's stdin."""
        if serial_number not in self.active_streams:
            return

        stream = self.active_streams[serial_number]
        proc = stream.get("process")

        if proc and proc.poll() is None:
            try:
                proc.stdin.write(data)
                proc.stdin.flush()
                if not stream.get("video_started"):
                    stream["video_started"] = True
                    log.info(f"Video data flowing for {serial_number}")
            except (BrokenPipeError, OSError) as e:
                log.debug(f"Pipe error: {e}")
                self.cleanup_stream(serial_number)
        else:
            self.cleanup_stream(serial_number)

    def cleanup_stream(self, serial_number: str):
        """Clean up a livestream."""
        if serial_number not in self.active_streams:
            return

        stream = self.active_streams.pop(serial_number)
        proc = stream.get("process")

        if proc:
            try:
                proc.stdin.close()
            except:
                pass
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()

        log.info(f"Cleaned up stream for {serial_number}")

    async def stop_livestream(self, serial_number: str):
        """Stop a livestream."""
        if serial_number in self.active_streams:
            await self.send_command(
                "device.stop_livestream",
                serialNumber=serial_number
            )
            self.cleanup_stream(serial_number)

    async def handle_event(self, event: dict):
        """Handle incoming events."""
        event_type = event.get("event")
        serial = event.get("serialNumber", "")

        if event_type == "rings":
            state = event.get("state", False)
            log.info(f"Doorbell ring: {serial}, state={state}")
            if state:
                await self.start_livestream(serial)

        elif event_type == "livestream started":
            log.info(f"Livestream started: {serial}")

        elif event_type == "livestream stopped":
            log.info(f"Livestream stopped: {serial}")
            self.cleanup_stream(serial)

        elif event_type == "livestream video data":
            # Extract video data from the event
            buffer_data = event.get("buffer", {})
            if isinstance(buffer_data, dict):
                data_array = buffer_data.get("data", [])
                if data_array:
                    video_bytes = bytes(data_array)
                    self.write_video_data(serial, video_bytes)

        elif event_type == "device added":
            device = event.get("device", {})
            name = device.get("name", "Unknown")
            dev_serial = device.get("serialNumber", "")
            self.devices[dev_serial] = device
            log.info(f"Device: {name} ({dev_serial})")

    async def handle_result(self, result: dict):
        """Handle command results."""
        if not result.get("success", False):
            error = result.get("error", {})
            msg_id = result.get("messageId", "")
            log.error(f"Command {msg_id} failed: {error}")

    async def run(self):
        """Main loop."""
        while True:
            try:
                log.info(f"Connecting to {self.ws_url}")
                async with websockets.connect(self.ws_url) as ws:
                    self.ws = ws
                    log.info("Connected to eufy-security-ws")

                    await self.send_command(
                        "set_api_schema",
                        schemaVersion=self.schema_version
                    )
                    await self.send_command("start_listening")

                    async for message in ws:
                        try:
                            data = json.loads(message)
                            msg_type = data.get("type")

                            if msg_type == "event":
                                event = data.get("event", {})
                                await self.handle_event(event)
                            elif msg_type == "result":
                                await self.handle_result(data)
                            elif msg_type == "version":
                                log.info(f"Server: {data.get('serverVersion')}")

                        except json.JSONDecodeError as e:
                            log.warning(f"Invalid JSON: {e}")

            except websockets.exceptions.ConnectionClosed:
                log.warning("Connection closed, reconnecting...")
            except ConnectionRefusedError:
                log.warning("Connection refused, retrying in 5s...")
            except Exception as e:
                log.error(f"Error: {e}, retrying in 5s...")

            for serial in list(self.active_streams.keys()):
                self.cleanup_stream(serial)

            await asyncio.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Doorbell video popup")
    parser.add_argument(
        "--ws-url", default="ws://localhost:3777",
        help="WebSocket URL (default: ws://localhost:3777)"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    handler = DoorbellHandler(args.ws_url)

    def shutdown(sig, frame):
        log.info("Shutting down...")
        for serial in list(handler.active_streams.keys()):
            handler.cleanup_stream(serial)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    asyncio.run(handler.run())


if __name__ == "__main__":
    main()
