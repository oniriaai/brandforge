import unittest

from baseline import compute_quality_snapshot


class BaselineQualitySnapshotTests(unittest.TestCase):
    def test_quality_snapshot_tracks_new_validation_rates(self) -> None:
        snapshot = compute_quality_snapshot(
            scores=[{"score": 8.1}, {"score": 7.9}],
            validations=[
                {
                    "cta": {"valid": True},
                    "visual_assets": {"valid": True},
                    "text_overflow": {"valid": True},
                    "safe_zone": {"valid": True},
                    "contrast": {"valid": True},
                    "file_size_warning": False,
                },
                {
                    "cta": {"valid": True},
                    "visual_assets": {"valid": True},
                    "text_overflow": {"valid": False},
                    "safe_zone": {"valid": True},
                    "contrast": {"valid": False},
                    "file_size_warning": False,
                },
            ],
            platform="instagram_feed_1x1",
            variant_count=2,
        )
        self.assertIn("text_overflow_pass_rate", snapshot["kpis"])
        self.assertIn("safe_zone_pass_rate", snapshot["kpis"])
        self.assertIn("contrast_pass_rate", snapshot["kpis"])
        self.assertEqual(snapshot["kpis"]["text_overflow_pass_rate"], 0.5)
        self.assertEqual(snapshot["kpis"]["contrast_pass_rate"], 0.5)
        self.assertFalse(snapshot["gates"]["contrast_pass_rate"])


if __name__ == "__main__":
    unittest.main()
