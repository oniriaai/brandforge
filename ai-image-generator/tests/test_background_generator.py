import unittest

from background_generator import build_procedural_seed, generate_procedural_background


class ProceduralBackgroundTests(unittest.TestCase):
    def test_seed_is_deterministic(self) -> None:
        seed_a = build_procedural_seed(
            post_id="post-123",
            variant_index=1,
            revision_of_job_id="revision-1",
        )
        seed_b = build_procedural_seed(
            post_id="post-123",
            variant_index=1,
            revision_of_job_id="revision-1",
        )
        seed_c = build_procedural_seed(
            post_id="post-123",
            variant_index=2,
            revision_of_job_id="revision-1",
        )
        self.assertEqual(seed_a, seed_b)
        self.assertNotEqual(seed_a, seed_c)

    def test_generated_background_is_deterministic(self) -> None:
        background_a = generate_procedural_background(
            width=1080,
            height=1080,
            primary_color="#4F46E5",
            secondary_color="#9333EA",
            accent_color="#F59E0B",
            seed=123456,
            density="balanced",
        )
        background_b = generate_procedural_background(
            width=1080,
            height=1080,
            primary_color="#4F46E5",
            secondary_color="#9333EA",
            accent_color="#F59E0B",
            seed=123456,
            density="balanced",
        )
        self.assertEqual(background_a["svgDataUri"], background_b["svgDataUri"])
        self.assertEqual(background_a["decorativeLayers"], background_b["decorativeLayers"])

    def test_layers_match_expected_contract(self) -> None:
        background = generate_procedural_background(
            width=1080,
            height=1350,
            primary_color="#4F46E5",
            secondary_color="#9333EA",
            accent_color="#F59E0B",
            seed=42,
            density="expressive",
        )
        layers = background["decorativeLayers"]
        self.assertGreaterEqual(len(layers), 4)
        self.assertTrue(background["svgDataUri"].startswith("data:image/svg+xml;base64,"))
        allowed_kinds = {"circle", "ring", "mesh", "beam"}
        for layer in layers:
            self.assertIn(layer["kind"], allowed_kinds)
            self.assertGreaterEqual(layer["x"], 0)
            self.assertGreaterEqual(layer["y"], 0)
            self.assertLessEqual(layer["x"], 1080)
            self.assertLessEqual(layer["y"], 1350)
            self.assertGreater(layer["size"], 0)


if __name__ == "__main__":
    unittest.main()
