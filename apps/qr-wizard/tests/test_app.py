import io
import os
import tempfile

import pytest


@pytest.fixture()
def client():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    os.environ["DATABASE_URL"] = f"sqlite:///{path}"
    os.environ["PUBLIC_BASE_URL"] = "http://localhost:5000"

    import importlib

    app_module = importlib.import_module("app")
    importlib.reload(app_module)

    app_module.app.config.update(TESTING=True)

    with app_module.app.test_client() as test_client:
        with app_module.app.app_context():
            app_module.db.drop_all()
            app_module.db.create_all()
        yield test_client

    if os.path.exists(path):
        os.remove(path)


def test_create_qr_code(client):
    payload = {
        "destination_url": "https://example.com/landing",
        "name": "Poster A",
        "campaign": "spring",
        "auto_append_utm": True,
        "utm_source": "qr",
        "utm_medium": "print",
    }
    res = client.post("/api/qrcodes", json=payload)
    assert res.status_code == 201

    body = res.get_json()
    assert body["slug"]
    assert body["name"] == "Poster A"
    assert body["campaign"] == "spring"


def test_tracked_redirect_logs_scan(client):
    create = client.post(
        "/api/qrcodes",
        json={
            "destination_url": "https://example.com/product",
            "auto_append_utm": True,
            "utm_source": "qr",
            "utm_medium": "poster",
            "utm_campaign": "launch",
        },
    )
    slug = create.get_json()["slug"]

    res = client.get(
        f"/t/{slug}",
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
        },
        follow_redirects=False,
    )
    assert res.status_code == 302
    location = res.headers["Location"]
    assert "utm_source=qr" in location
    assert "utm_medium=poster" in location
    assert "utm_campaign=launch" in location
    assert "qr_tid=" in location

    summary = client.get("/api/analytics/summary").get_json()
    assert summary["total_scans"] == 1
    assert summary["unique_scans"] == 1


def test_bulk_import(client):
    csv_content = "destination_url,name,campaign\nhttps://example.com/a,A,spring\nhttps://example.com/b,B,spring\n"
    data = {
        "file": (io.BytesIO(csv_content.encode("utf-8")), "batch.csv"),
    }

    res = client.post("/api/qrcodes/bulk", data=data, content_type="multipart/form-data")
    assert res.status_code == 200
    body = res.get_json()
    assert body["created_count"] == 2
    assert body["errors"] == []


def test_download_qr_png(client):
    create = client.post("/api/qrcodes", json={"destination_url": "https://example.com"})
    qr_id = create.get_json()["id"]

    res = client.get(f"/api/qrcodes/{qr_id}/download?format=png")
    assert res.status_code == 200
    assert res.mimetype == "image/png"


def test_conversion_rate(client):
    create = client.post("/api/qrcodes", json={"destination_url": "https://example.com/checkout"})
    body = create.get_json()
    slug = body["slug"]
    qr_id = body["id"]

    client.get(
        f"/t/{slug}",
        headers={
            "User-Agent": "Mozilla/5.0",
        },
    )

    conv = client.post("/api/conversions", json={"qr_code_id": qr_id, "event_name": "purchase"})
    assert conv.status_code == 201

    summary = client.get("/api/analytics/summary").get_json()
    assert summary["conversions"] == 1
    assert summary["conversion_rate"] == 100.0
