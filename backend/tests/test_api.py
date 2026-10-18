"""P3 — FastAPI route smoke tests against the live pipeline case."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

EXPECTED_CONSPIRATORS = {
    "2456431B",
    "2774868P",
    "2786843M",
    "2546112P",
    "2712324G",
    "2813225B",
}
MASTERMIND = "2453876J"


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_case_is_real_data():
    r = client.get("/api/case")
    assert r.status_code == 200
    case = r.json()
    counts = case["meta"]["counts"]
    assert counts["students"] == 163
    assert counts["visits"] == 662
    assert counts["buildings"] == 14
    assert counts["statements"] == 25
    assert counts["conspirators"] == 6


def test_case_verdicts():
    case = client.get("/api/case").json()
    conspirators = {s["student_id"] for s in case["suspects"] if s["verdict"] == "conspirator"}
    masterminds = [s["student_id"] for s in case["suspects"] if s["verdict"] == "mastermind"]
    assert conspirators == EXPECTED_CONSPIRATORS
    assert masterminds == [MASTERMIND]


def test_student_lookup_accepts_lowercase_raw_id():
    # Stuart's logs use lowercase id — API should still resolve
    r = client.get("/api/students/2813225b")
    assert r.status_code == 200
    body = r.json()
    assert body["student"]["id"] == "2813225B"
    assert body["student"]["name"] == "Stuart Wands"


def test_building_lookup():
    r = client.get("/api/buildings/boyd-orr-building")
    assert r.status_code == 200
    assert "Boyd Orr" in r.json()["building"]["name"]


def test_missing_data_degrades_to_503_without_crashing(tmp_path, monkeypatch):
    """A deployment without data/raw or the sample must still start and answer clearly."""
    import app.main as main

    monkeypatch.setattr(main.settings, "RAW_DIR", tmp_path / "missing")
    monkeypatch.setattr(main, "SAMPLE_CASE_PATH", tmp_path / "missing.json")
    monkeypatch.setattr(main, "case_cache", None)

    assert main.refresh_case() is None  # does not raise
    assert client.get("/api/health").status_code == 200
    r = client.get("/api/case")
    assert r.status_code == 503
    assert "RAW_DIR" in r.json()["detail"]
