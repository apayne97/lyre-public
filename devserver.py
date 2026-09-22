#!/usr/bin/env python3
"""Dev server: disables caching (edits always show up on reload) and adds a
tiny JSON API for saving custom chord progressions to songs-data.md, so
"Add your own" in the Progressions page persists across reloads/machines
instead of living only in an in-page JS object. Saving is an upsert keyed
on Title+Artist (case-insensitive) — re-saving the same song edits it in
place instead of piling up duplicates."""
import http.server
import json
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8934
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "songs-data.md")
SEP = "\n---\n"


def read_blocks():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        raw = f.read()
    return [t.strip() for t in raw.split(SEP) if t.strip()]


def write_blocks(blocks):
    with open(DATA_FILE, "w") as f:
        f.write((SEP.join(blocks) + "\n") if blocks else "")


def parse_header(text):
    title, artist = None, None
    for line in text.split("\n"):
        line = line.strip()
        if line == "":
            if title is not None:
                break
            continue
        m = re.match(r"^Title:\s*(.+)$", line, re.I)
        if m:
            title = m.group(1).strip()
            continue
        m = re.match(r"^Artist:\s*(.+)$", line, re.I)
        if m:
            artist = m.group(1).strip()
    return title, (artist or "")


def same_song(a_title, a_artist, b_title, b_artist):
    return a_title is not None and b_title is not None \
        and a_title.lower() == b_title.lower() \
        and a_artist.lower() == b_artist.lower()


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _json(self, status, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path == "/api/songs":
            self._json(200, read_blocks())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/songs":
            self.send_response(404)
            self.end_headers()
            return
        try:
            text = self._read_json_body()["text"].strip()
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            self._json(400, {"error": "Expected JSON body {\"text\": \"...\"}"})
            return
        if not text:
            self._json(400, {"error": "Empty chart text."})
            return

        new_title, new_artist = parse_header(text)
        blocks = read_blocks()
        replaced = False
        for i, block in enumerate(blocks):
            t, a = parse_header(block)
            if same_song(t, a, new_title, new_artist):
                blocks[i] = text
                replaced = True
                break
        if not replaced:
            blocks.append(text)
        write_blocks(blocks)
        self._json(200, {"ok": True, "replaced": replaced})

    def do_DELETE(self):
        if self.path != "/api/songs":
            self.send_response(404)
            self.end_headers()
            return
        try:
            payload = self._read_json_body()
            del_title = payload["title"].strip()
            del_artist = (payload.get("artist") or "").strip()
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            self._json(400, {"error": "Expected JSON body {\"title\": \"...\", \"artist\": \"...\"}"})
            return

        blocks = read_blocks()
        kept = []
        removed = False
        for block in blocks:
            t, a = parse_header(block)
            if same_song(t, a, del_title, del_artist):
                removed = True
                continue
            kept.append(block)
        write_blocks(kept)
        self._json(200, {"ok": True, "removed": removed})


if __name__ == "__main__":
    http.server.test(HandlerClass=NoCacheHandler, port=PORT)
