from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd


def clean_normalize(raw_path: str, output_path: str) -> None:
    raw = json.loads(Path(raw_path).read_text(encoding="utf-8"))
    frame = pd.DataFrame(raw)

    frame["origin"] = frame["origin"].str.upper().str.strip()
    frame["destination"] = frame["destination"].str.upper().str.strip()
    frame["route_key"] = frame["route_key"].str.upper().str.strip()
    frame["airline"] = frame["airline"].str.strip()
    frame["airline_code"] = frame["airline_code"].str.upper().str.strip()
    frame["currency"] = frame["currency"].str.upper().str.strip()
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce").fillna(0)
    frame["duration_minutes"] = pd.to_numeric(frame["duration_minutes"], errors="coerce").fillna(0).astype(int)
    frame["stops"] = pd.to_numeric(frame["stops"], errors="coerce").fillna(0).astype(int)
    frame["seats_remaining"] = pd.to_numeric(frame["seats_remaining"], errors="coerce").fillna(0).astype(int)
    frame["confidence"] = np.clip(pd.to_numeric(frame["confidence"], errors="coerce").fillna(0), 0, 1)

    cleaned = frame.to_dict(orient="records")
    Path(output_path).write_text(json.dumps(cleaned, indent=2), encoding="utf-8")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Clean and normalize raw fare snapshots.")
    parser.add_argument("raw_path")
    parser.add_argument("output_path")
    args = parser.parse_args()
    clean_normalize(args.raw_path, args.output_path)
