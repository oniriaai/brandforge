import importlib
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_job(post_id: str) -> dict:
    first_variant_id = str(uuid4())
    second_variant_id = str(uuid4())
    now = _utc_now()
    first_asset = {
        "filename": "variant_1.png",
        "relativeUrl": "http://localhost:4100/output/variant_1.png",
        "width": 1080,
        "height": 1080,
    }
    second_asset = {
        "filename": "variant_2.png",
        "relativeUrl": "http://localhost:4100/output/variant_2.png",
        "width": 1080,
        "height": 1080,
    }
    return {
        "id": str(uuid4()),
        "threadId": str(uuid4()),
        "status": "pending_approval",
        "input": {
            "postId": post_id,
            "inputText": "Launch offer now",
            "designGuidelines": "Objective: conversion",
            "platform": "instagram_feed_1x1",
            "brandKit": {},
        },
        "content": {"headline": "Launch offer now", "cta": "Get started"},
        "background": {},
        "layout": {},
        "componentSpec": {"variantId": first_variant_id},
        "variants": [
            {
                "id": first_variant_id,
                "provider": "internal",
                "label": "Variant 1",
                "background": {},
                "layout": {},
                "decorativeLayers": [],
                "badges": [],
                "logoPlacement": {},
                "designSpec": {},
                "critic": {"overall": 7.5},
                "rationale": "",
            },
            {
                "id": second_variant_id,
                "provider": "internal",
                "label": "Variant 2",
                "background": {},
                "layout": {},
                "decorativeLayers": [],
                "badges": [],
                "logoPlacement": {},
                "designSpec": {},
                "critic": {"overall": 8.1},
                "rationale": "",
            },
        ],
        "recommendedVariantId": second_variant_id,
        "selectedVariantId": first_variant_id,
        "qualitySnapshot": {"status": "pass", "kpis": {}},
        "providerWarnings": [],
        "asset": first_asset,
        "approval": None,
        "revisionOfJobId": None,
        "revisionRequest": None,
        "createdAt": now,
        "updatedAt": now,
        "postId": post_id,
        "variantAssets": {
            first_variant_id: first_asset,
            second_variant_id: second_asset,
        },
        "variantComponentSpecs": {
            first_variant_id: {"variantId": first_variant_id},
            second_variant_id: {"variantId": second_variant_id},
        },
    }


class CompatApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temp_dir = tempfile.TemporaryDirectory()
        os.environ["AGENT_STATE_FILE"] = str(Path(cls._temp_dir.name) / "state" / "jobs-state.json")
        import main as main_module

        cls.main_module = importlib.reload(main_module)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temp_dir.cleanup()

    def setUp(self) -> None:
        state_file = Path(self._temp_dir.name) / f"{uuid4().hex}.json"
        self.main_module.store = self.main_module.JsonStateStore(str(state_file))
        self.client = TestClient(self.main_module.app)

    def test_get_job_hides_internal_store_fields(self) -> None:
        post_id = str(uuid4())
        job = _build_job(post_id)
        self.main_module.store.create_job(post_id, job)

        response = self.client.get(f"/v1/posts/{post_id}/images/{job['id']}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("postId", payload)
        self.assertNotIn("threadId", payload)
        self.assertNotIn("variantAssets", payload)
        self.assertNotIn("variantComponentSpecs", payload)
        self.assertEqual(payload["id"], job["id"])

    def test_select_variant_updates_selected_asset_and_component_spec(self) -> None:
        post_id = str(uuid4())
        job = _build_job(post_id)
        self.main_module.store.create_job(post_id, job)
        target_variant_id = job["variants"][1]["id"]

        response = self.client.post(
            f"/v1/posts/{post_id}/images/{job['id']}/select-variant",
            json={"variantId": target_variant_id},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["selectedVariantId"], target_variant_id)
        self.assertEqual(
            payload["asset"]["relativeUrl"],
            job["variantAssets"][target_variant_id]["relativeUrl"],
        )

        updated = self.main_module.store.get_job(job["id"])
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated["selectedVariantId"], target_variant_id)
        self.assertEqual(updated["componentSpec"]["variantId"], target_variant_id)


class JsonStateStoreTests(unittest.TestCase):
    def test_state_store_persists_jobs_on_disk(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_file = Path(temp_dir) / "jobs-state.json"
            store = _load_main_module().JsonStateStore(str(state_file))
            post_id = str(uuid4())
            job = _build_job(post_id)
            store.create_job(post_id, job)

            reloaded = _load_main_module().JsonStateStore(str(state_file))
            loaded_job = reloaded.get_job(job["id"])
            self.assertIsNotNone(loaded_job)
            assert loaded_job is not None
            self.assertEqual(loaded_job["id"], job["id"])
            self.assertEqual(loaded_job["selectedVariantId"], job["selectedVariantId"])

    def test_update_job_raises_for_unknown_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_file = Path(temp_dir) / "jobs-state.json"
            store = _load_main_module().JsonStateStore(str(state_file))
            post_id = str(uuid4())
            job = _build_job(post_id)
            with self.assertRaises(KeyError):
                store.update_job(post_id, job)


def _load_main_module():
    import main as main_module

    return importlib.reload(main_module)


if __name__ == "__main__":
    unittest.main()
