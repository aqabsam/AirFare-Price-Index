from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd


def calculate_index(clean_path: str, output_path: str) -> None:
    frame = pd.read_json(clean_path)
    if frame.empty:
        Path(output_path).write_text("[]", encoding="utf-8")
        return

    grouped = frame.groupby("route_key", as_index=False).agg(
        cheapest_price=("price", "min"),
        average_price=("price", "mean"),
        median_price=("price", "median"),
    )

    baseline = grouped["cheapest_price"].replace(0, np.nan).min()
    grouped["airfare_index"] = np.where(
        np.isfinite(baseline) & (baseline > 0),
        (grouped["cheapest_price"] / baseline) * 100,
        100,
    )

    Path(output_path).write_text(grouped.to_json(orient="records", indent=2), encoding="utf-8")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Calculate airfare index values.")
    parser.add_argument("clean_path")
    parser.add_argument("output_path")
    args = parser.parse_args()
    calculate_index(args.clean_path, args.output_path)
