#!/usr/bin/env python3
"""Copy the bundled Three.js primitive scene template to an output HTML file."""
from pathlib import Path
import argparse


def main():
    parser = argparse.ArgumentParser(description="Copy the Three.js primitive scene template.")
    parser.add_argument("output", nargs="?", default="scene.html", help="Output HTML path")
    args = parser.parse_args()

    skill_dir = Path(__file__).resolve().parents[1]
    template = skill_dir / "assets" / "threejs-scene-template.html"
    output = Path(args.output).resolve()
    output.write_text(template.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
