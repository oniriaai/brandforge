import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

QUALITY_BASELINE_THRESHOLDS: dict[str, float] = {
    "mean_overall_score_min": 7.2,
    "cta_pass_rate_min": 0.9,
    "supporting_visual_pass_rate_min": 0.85,
    "text_overflow_pass_rate_min": 0.95,
    "safe_zone_pass_rate_min": 0.95,
    "contrast_pass_rate_min": 0.9,
    "file_size_warning_rate_max": 0.1,
}

REPRESENTATIVE_BASELINE_SAMPLES: list[dict[str, Any]] = [
    {
        "scenarioId": "conversion-square-bold",
        "platform": "instagram_feed_1x1",
        "scores": [7.6, 7.9, 7.4],
        "validations": [
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
        ],
    },
    {
        "scenarioId": "leadgen-portrait-authority",
        "platform": "instagram_feed_4x5",
        "scores": [7.1, 7.5, 7.2],
        "validations": [
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": False}, "visual_assets": {"valid": True}, "file_size_warning": False},
        ],
    },
    {
        "scenarioId": "awareness-square-minimal",
        "platform": "instagram_feed_1x1",
        "scores": [7.3, 7.0, 7.4],
        "validations": [
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": False}, "file_size_warning": False},
        ],
    },
    {
        "scenarioId": "engagement-portrait-storytelling",
        "platform": "instagram_feed_4x5",
        "scores": [7.8, 7.6, 7.9],
        "validations": [
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": True},
            {"cta": {"valid": True}, "visual_assets": {"valid": True}, "file_size_warning": False},
        ],
    },
]


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _round_metric(value: float) -> float:
    return round(value, 4)


def compute_quality_snapshot(
    scores: list[Any],
    validations: list[dict[str, Any]],
    *,
    platform: str,
    variant_count: int,
    thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    threshold_values = thresholds or QUALITY_BASELINE_THRESHOLDS
    score_values = [_safe_float(item.get("score", 0.0) if isinstance(item, dict) else item, 0.0) for item in scores]
    if not score_values:
        score_values = [0.0]
    variant_total = max(variant_count, len(score_values), len(validations), 1)

    cta_pass = sum(1 for item in validations if bool(item.get("cta", {}).get("valid")))
    visual_pass = sum(1 for item in validations if bool(item.get("visual_assets", {}).get("valid")))
    overflow_pass = sum(1 for item in validations if bool(item.get("text_overflow", {}).get("valid", True)))
    safe_zone_pass = sum(1 for item in validations if bool(item.get("safe_zone", {}).get("valid", True)))
    contrast_pass = sum(1 for item in validations if bool(item.get("contrast", {}).get("valid", True)))
    file_size_warnings = sum(1 for item in validations if bool(item.get("file_size_warning")))

    kpis = {
        "mean_overall_score": _round_metric(sum(score_values) / len(score_values)),
        "min_overall_score": _round_metric(min(score_values)),
        "max_overall_score": _round_metric(max(score_values)),
        "cta_pass_rate": _round_metric(_safe_rate(cta_pass, variant_total)),
        "supporting_visual_pass_rate": _round_metric(_safe_rate(visual_pass, variant_total)),
        "text_overflow_pass_rate": _round_metric(_safe_rate(overflow_pass, variant_total)),
        "safe_zone_pass_rate": _round_metric(_safe_rate(safe_zone_pass, variant_total)),
        "contrast_pass_rate": _round_metric(_safe_rate(contrast_pass, variant_total)),
        "file_size_warning_rate": _round_metric(_safe_rate(file_size_warnings, variant_total)),
    }
    gates = {
        "mean_overall_score": kpis["mean_overall_score"] >= threshold_values["mean_overall_score_min"],
        "cta_pass_rate": kpis["cta_pass_rate"] >= threshold_values["cta_pass_rate_min"],
        "supporting_visual_pass_rate": (
            kpis["supporting_visual_pass_rate"] >= threshold_values["supporting_visual_pass_rate_min"]
        ),
        "text_overflow_pass_rate": (
            kpis["text_overflow_pass_rate"] >= threshold_values["text_overflow_pass_rate_min"]
        ),
        "safe_zone_pass_rate": (
            kpis["safe_zone_pass_rate"] >= threshold_values["safe_zone_pass_rate_min"]
        ),
        "contrast_pass_rate": (
            kpis["contrast_pass_rate"] >= threshold_values["contrast_pass_rate_min"]
        ),
        "file_size_warning_rate": kpis["file_size_warning_rate"] <= threshold_values["file_size_warning_rate_max"],
    }
    status = "pass" if all(gates.values()) else "needs_attention"
    return {
        "platform": platform,
        "variantCount": variant_total,
        "kpis": kpis,
        "gates": gates,
        "status": status,
        "thresholds": threshold_values,
    }


def _snapshot_from_job(job: dict[str, Any]) -> dict[str, Any] | None:
    existing = job.get("qualitySnapshot")
    if isinstance(existing, dict) and existing.get("kpis"):
        return existing

    variants = job.get("variants", [])
    if not isinstance(variants, list) or not variants:
        return None
    scores = [{"score": item.get("critic", {}).get("overall", 0.0)} for item in variants]
    validations = [item.get("renderValidation", {}) for item in variants]
    platform = str(job.get("input", {}).get("platform", "unknown"))
    return compute_quality_snapshot(scores, validations, platform=platform, variant_count=len(variants))


def aggregate_quality_snapshots(snapshots: list[dict[str, Any]]) -> dict[str, Any]:
    if not snapshots:
        return {
            "snapshotCount": 0,
            "variantCount": 0,
            "statusPassRate": 0.0,
            "kpis": {},
            "thresholds": QUALITY_BASELINE_THRESHOLDS,
        }

    variant_total = sum(int(item.get("variantCount", 0)) for item in snapshots)
    weighted = {
        "mean_overall_score": 0.0,
        "cta_pass_rate": 0.0,
        "supporting_visual_pass_rate": 0.0,
        "text_overflow_pass_rate": 0.0,
        "safe_zone_pass_rate": 0.0,
        "contrast_pass_rate": 0.0,
        "file_size_warning_rate": 0.0,
    }
    for item in snapshots:
        weight = int(item.get("variantCount", 0))
        kpis = item.get("kpis", {})
        for key in weighted:
            weighted[key] += _safe_float(kpis.get(key, 0.0), 0.0) * weight

    divisor = max(variant_total, 1)
    aggregated_kpis = {key: _round_metric(value / divisor) for key, value in weighted.items()}
    pass_count = sum(1 for item in snapshots if item.get("status") == "pass")
    return {
        "snapshotCount": len(snapshots),
        "variantCount": variant_total,
        "statusPassRate": _round_metric(_safe_rate(pass_count, len(snapshots))),
        "kpis": aggregated_kpis,
        "thresholds": QUALITY_BASELINE_THRESHOLDS,
    }


def build_quality_baseline_report(state_file: Path, use_samples_if_empty: bool) -> dict[str, Any]:
    snapshots: list[dict[str, Any]] = []
    source = "state_jobs"

    if state_file.exists():
        raw = state_file.read_text(encoding="utf-8").strip()
        payload = json.loads(raw) if raw else {}
        jobs = payload.get("jobs", {})
        if isinstance(jobs, dict):
            for job in jobs.values():
                if isinstance(job, dict):
                    snapshot = _snapshot_from_job(job)
                    if snapshot:
                        snapshots.append(snapshot)

    if not snapshots and use_samples_if_empty:
        source = "representative_samples"
        for scenario in REPRESENTATIVE_BASELINE_SAMPLES:
            snapshots.append(
                compute_quality_snapshot(
                    scenario["scores"],
                    scenario["validations"],
                    platform=scenario["platform"],
                    variant_count=len(scenario["scores"]),
                )
            )

    aggregate = aggregate_quality_snapshots(snapshots)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "thresholds": QUALITY_BASELINE_THRESHOLDS,
        "snapshotCount": len(snapshots),
        "snapshots": snapshots,
        "aggregate": aggregate,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build quality baseline report for ai-image-generator.")
    parser.add_argument("--state-file", default="state/jobs-state.json", help="Path to jobs-state.json")
    parser.add_argument("--report-file", default="output/quality-baseline.json", help="Baseline report path")
    parser.add_argument(
        "--use-samples-if-empty",
        action="store_true",
        default=False,
        help="Use representative sample scenarios if no state jobs are found.",
    )
    args = parser.parse_args()

    state_file = Path(args.state_file)
    report_file = Path(args.report_file)
    report_file.parent.mkdir(parents=True, exist_ok=True)

    report = build_quality_baseline_report(state_file=state_file, use_samples_if_empty=args.use_samples_if_empty)
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"report_file": str(report_file), "snapshot_count": report["snapshotCount"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
