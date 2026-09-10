#!/usr/bin/env python3
"""Extract frames from a walkthrough video for review.

Usage:
    python scripts/extract-frames.py <video> [out_dir] [seconds_per_frame] [start] [end]

Examples:
    python scripts/extract-frames.py demo.mp4
    python scripts/extract-frames.py demo.mp4 docs/frames 1.5
    python scripts/extract-frames.py demo.mp4 docs/frames 0.5 120 180   # dense sample of 2:00-3:00

Needs OpenCV (`cv2`), which is already installed in this environment.
Frames are named  frame_<index>_<timestamp>s.png  so they sort in play order.
"""
import os
import sys

import cv2


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "docs/frames"
    every = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    start = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    end = float(sys.argv[5]) if len(sys.argv) > 5 else None

    if not os.path.isfile(src):
        print(f"error: no such file: {src}")
        return 1

    os.makedirs(out_dir, exist_ok=True)
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"error: OpenCV could not open {src}")
        return 1

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / fps if total else 0.0
    step = max(1, int(round(fps * every)))

    if start > 0:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(start * fps))

    i = int(start * fps)
    saved = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        t = i / fps
        if end is not None and t > end:
            break
        if i % step == 0:
            ok, frame = cap.retrieve()
            if ok:
                name = os.path.join(out_dir, f"frame_{saved:04d}_{t:08.2f}s.png")
                cv2.imwrite(name, frame)
                saved += 1
        i += 1

    cap.release()
    print(
        f"{saved} frames -> {out_dir}  "
        f"(video {duration:.1f}s @ {fps:.1f}fps, 1 frame / {every}s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
