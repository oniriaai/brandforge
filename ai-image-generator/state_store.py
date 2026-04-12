import copy
import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any


class JsonStateStore:
    def __init__(self, state_file: str):
        self.state_file = Path(state_file)
        self._lock = threading.RLock()
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.state_file.exists():
            self._atomic_write(json.dumps({"jobs": {}, "post_jobs": {}}, ensure_ascii=False))
        self._state = self._load()

    def _atomic_write(self, payload: str) -> None:
        temp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=str(self.state_file.parent),
                prefix=f".{self.state_file.name}.",
                suffix=".tmp",
                delete=False,
            ) as temp_file:
                temp_file.write(payload)
                temp_file.flush()
                os.fsync(temp_file.fileno())
                temp_path = Path(temp_file.name)
            os.replace(temp_path, self.state_file)
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink()

    def _load(self) -> dict[str, Any]:
        with self._lock:
            raw = self.state_file.read_text(encoding="utf-8")
            try:
                parsed = json.loads(raw) if raw.strip() else {}
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"State file {self.state_file} contains invalid JSON: {exc.msg}") from exc
            parsed.setdefault("jobs", {})
            parsed.setdefault("post_jobs", {})
            return parsed

    def _save(self) -> None:
        with self._lock:
            self._atomic_write(json.dumps(self._state, ensure_ascii=False))

    def create_job(self, post_id: str, job: dict[str, Any]) -> None:
        with self._lock:
            self._state["jobs"][job["id"]] = copy.deepcopy(job)
            post_jobs = self._state["post_jobs"].setdefault(post_id, [])
            if job["id"] not in post_jobs:
                post_jobs.append(job["id"])
            self._save()

    def update_job(self, post_id: str, job: dict[str, Any]) -> None:
        with self._lock:
            if job["id"] not in self._state["jobs"]:
                raise KeyError(f"Job {job['id']} does not exist")
            self._state["jobs"][job["id"]] = copy.deepcopy(job)
            post_jobs = self._state["post_jobs"].setdefault(post_id, [])
            if job["id"] not in post_jobs:
                post_jobs.append(job["id"])
            self._save()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._state["jobs"].get(job_id)
            return copy.deepcopy(job) if job else None

    def list_jobs(self, post_id: str) -> list[dict[str, Any]]:
        with self._lock:
            ids = self._state["post_jobs"].get(post_id, [])
            jobs = [copy.deepcopy(self._state["jobs"][job_id]) for job_id in ids if job_id in self._state["jobs"]]
            return sorted(jobs, key=lambda job: job["createdAt"], reverse=True)
