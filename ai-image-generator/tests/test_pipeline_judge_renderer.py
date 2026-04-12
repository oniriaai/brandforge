import unittest
from unittest.mock import patch

import judge
import pipeline
from renderer import _inject_brand_tokens
from schemas import NativeBrandKit


class PipelineHelperTests(unittest.TestCase):
    def test_resolve_variant_count_clamps_requested_and_env(self) -> None:
        with patch.dict("os.environ", {"MAX_VARIANT_COUNT": "5", "DEFAULT_VARIANT_COUNT": "3"}, clear=False):
            self.assertEqual(pipeline.resolve_variant_count(None), 3)
            self.assertEqual(pipeline.resolve_variant_count(99), 5)
            self.assertEqual(pipeline.resolve_variant_count(1), 1)

        with patch.dict("os.environ", {"MAX_VARIANT_COUNT": "0", "DEFAULT_VARIANT_COUNT": "0"}, clear=False):
            self.assertEqual(pipeline.resolve_variant_count(None), 1)
            self.assertEqual(pipeline.resolve_variant_count(-10), 1)

    def test_order_html_layouts_uses_variant_index_order(self) -> None:
        html_layouts = [
            {"variantIndex": 2, "html": "<div>two</div>"},
            {"variantIndex": 0, "html": "<div>zero</div>"},
            {"variantIndex": 1, "html": "<div>one</div>"},
        ]
        ordered = pipeline.order_html_layouts(html_layouts, num_variants=3)
        self.assertEqual(ordered, ["<div>zero</div>", "<div>one</div>", "<div>two</div>"])

    def test_order_design_specs_falls_back_to_blueprint_defaults(self) -> None:
        blueprints = [
            {
                "index": 0,
                "layoutStyle": "split-horizontal",
                "surfaceStyle": "solid",
                "textAlign": "left",
                "ctaStyle": "solid",
                "assetDensity": "balanced",
            }
        ]
        specs = pipeline.order_design_specs(
            [],
            variant_blueprints=blueprints,
            format_constraints=pipeline.text_constraints_for_format("1080x1080"),
        )
        self.assertEqual(specs[0]["variantIndex"], 0)
        self.assertEqual(specs[0]["layoutTemplate"], "split-horizontal")
        self.assertEqual(specs[0]["cta"]["style"], "solid")

    def test_rank_assets_prefers_semantic_matches(self) -> None:
        ranked = pipeline.rank_assets_by_relevance(
            pipeline.LUCIDE_ICON_CATALOG,
            ["conversion", "offer", "urgent"],
        )
        self.assertGreater(len(ranked), 0)
        top_names = [item["name"] for item in ranked[:2]]
        self.assertTrue(any(name in {"target", "zap"} for name in top_names))

    def test_asset_catalogs_are_expanded(self) -> None:
        self.assertGreaterEqual(len(pipeline.LUCIDE_ICON_CATALOG), 20)
        self.assertGreaterEqual(len(pipeline.UNDRAW_ILLUSTRATION_CATALOG), 20)

    def test_combine_semantic_signals_expands_synonyms(self) -> None:
        signals = pipeline.combine_semantic_signals(
            objective="lead_generation",
            angle="social_proof",
            audience="startup founders",
            tone="confident",
            keyword_signals=["conversion"],
        )
        self.assertIn("leads", signals)
        self.assertIn("testimonial", signals)
        self.assertIn("checkout", signals)

    def test_apply_repair_directives_adjusts_text_and_cta(self) -> None:
        specs = [
            {
                "variantIndex": 0,
                "surfaceStyle": "gradient",
                "textAlign": "center",
                "spacingScale": "airy",
                "cta": {"placement": "inline", "emphasis": "medium", "style": "outline"},
                "hierarchy": {"ctaPriority": "medium"},
                "textPolicy": {
                    "maxHeadlineLines": 4,
                    "maxBodyLines": 5,
                    "headlineMaxChars": 120,
                    "bodyMaxChars": 220,
                    "ctaMaxChars": 40,
                },
                "visualStrategy": {"supportingVisualMode": "auto", "logoUsage": "selective", "assetDensity": "expressive"},
                "notes": "",
            }
        ]
        repaired = pipeline.apply_repair_directives_to_design_specs(
            design_specs=specs,
            repair_brief={
                0: {
                    "validationProblems": ["cta_invalid", "text_overflow", "low_contrast"],
                    "defects": [{"tag": "cta_not_prominent", "severity": "high"}],
                }
            },
            format_constraints=pipeline.text_constraints_for_format("1080x1080"),
        )
        self.assertEqual(repaired[0]["cta"]["placement"], "bottom")
        self.assertEqual(repaired[0]["cta"]["style"], "solid")
        self.assertLessEqual(
            repaired[0]["textPolicy"]["headlineMaxChars"],
            pipeline.text_constraints_for_format("1080x1080")["headlineMaxChars"],
        )
        self.assertEqual(repaired[0]["surfaceStyle"], "solid")

    def test_variant_selection_score_penalizes_invalid_cta(self) -> None:
        class VariantLike:
            def __init__(self, critic, render_validation):
                self.critic = critic
                self.renderValidation = render_validation

        strong_invalid = VariantLike(
            critic={
                "overall": 9.2,
                "ctaProminence": 9.0,
                "readability": 9.0,
                "brandConsistency": 8.8,
                "guidelineAdherence": 8.9,
                "confidence": 0.95,
                "defects": [],
            },
            render_validation={
                "cta": {"valid": False},
                "visual_assets": {"valid": True},
                "text_overflow": {"valid": True},
                "safe_zone": {"valid": True},
                "contrast": {"valid": True},
            },
        )
        balanced_valid = VariantLike(
            critic={
                "overall": 8.2,
                "ctaProminence": 8.4,
                "readability": 8.2,
                "brandConsistency": 8.0,
                "guidelineAdherence": 8.1,
                "confidence": 0.8,
                "defects": [],
            },
            render_validation={
                "cta": {"valid": True},
                "visual_assets": {"valid": True},
                "text_overflow": {"valid": True},
                "safe_zone": {"valid": True},
                "contrast": {"valid": True},
            },
        )
        self.assertLess(
            pipeline.variant_selection_score(strong_invalid),
            pipeline.variant_selection_score(balanced_valid),
        )


class JudgeNormalizationTests(unittest.TestCase):
    def test_normalize_score_payload_handles_aliases_and_bounds(self) -> None:
        normalized = judge._normalize_score_payload(
            {
                "overallScore": 11,
                "subscores": {
                    "cta": "8.5",
                    "hierarchy": 7,
                    "brand": 6.5,
                    "legibility": "bad",
                    "guidelines": 8,
                },
                "defects": [{"tag": "not-known", "severity": "urgent", "evidence": "x"}],
                "confidence": 95,
            }
        )
        self.assertEqual(normalized["score"], 10.0)
        self.assertEqual(normalized["subscores"]["cta_prominence"], 8.5)
        self.assertEqual(normalized["defects"][0]["tag"], "other")
        self.assertEqual(normalized["defects"][0]["severity"], "medium")
        self.assertEqual(normalized["confidence"], 0.95)


class RendererInjectionTests(unittest.TestCase):
    def test_inject_brand_tokens_procedural_css_is_well_formed(self) -> None:
        brand_kit = NativeBrandKit(
            colors={"primary": "#111111"},
            fonts={"heading": "Inter", "body": "Inter"},
        )
        html = "<html><head></head><body><main>Hi</main></body></html>"
        injected = _inject_brand_tokens(
            html,
            brand_kit,
            1080,
            1080,
            procedural_background={"svgDataUri": "data:image/svg+xml;base64,abc", "textureOpacity": 0.3},
        )
        self.assertIn("body::before{", injected)
        self.assertIn("body::after{", injected)
        self.assertNotIn("pointer-events:none;}}", injected)


if __name__ == "__main__":
    unittest.main()
