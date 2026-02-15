# QR Code Analytics

A web tool to generate trackable QR codes that redirect to any URL while recording each scan and showing analytics for scans, uniques, time trends, geo/device breakdowns, attribution fields, conversions, and exports.

## Features

- Single QR creation with destination URL + campaign/channel/location/asset/owner metadata.
- Bulk QR creation via CSV upload.
- Dynamic QR behavior: update destination URL later without changing the QR image.
- Download QR images as PNG, SVG, or PDF.
- Tracking redirect endpoint (`/t/<slug>`) that logs scan context, then redirects.
- Analytics endpoints + dashboard:
  - Total scans, unique scans, bot scans
  - Scans over time (`hour`, `day`, `week`, `month`)
  - Top QR codes
  - Breakdowns by campaign/location/channel/geo/device/referrer/time patterns
  - Conversion count and scan-to-conversion rate
- Data quality and privacy controls:
  - Bot filtering
  - Duplicate filtering via configurable unique window
  - IP anonymization + hashing
  - Retention cleanup endpoint/CLI
- Data export as CSV for scans and QR library.

## Tech Stack

- Python + Flask
- SQLite (via SQLAlchemy)
- Vanilla JS frontend

## Quick Start

1. **Install dependencies**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Run app**:
   ```bash
   python app.py --debug --port 5005
   ```

3. **Open Dashboard**:
   [http://localhost:5005](http://localhost:5005)

## Deployment (Production)

The easiest way to deploy is using the provided script in the root directory:

```bash
./deploy-qr.sh
```

### Using Docker Compose
Alternatively, use the compose file:

```bash
docker compose up --build -d
```

Notes:

- SQLite data is persisted in Docker volume `qr_data` mounted to `/app/data`.
- Container serves the app on port `5000` with Gunicorn.

## Environment Variables

- `DATABASE_URL` (default: `sqlite:///qr_tracker.db`)
- `PUBLIC_BASE_URL` (optional; used for API outputs and file exports)
- `IP_HASH_SALT` (set this in production)
- `UNIQUE_WINDOW_HOURS` (default: `24`)
- `DATA_RETENTION_DAYS` (default: `365`)
- `TRACKING_PARAM` (default: `qr_tid`; appended to destination URLs)
- `GEOIP_DB_PATH` (optional path to MaxMind GeoLite2 City DB)

## CSV Import Format

Required columns:

- `destination_url`

Optional columns:

- `name`, `campaign`, `channel`, `location`, `asset`, `owner`, `notes`
- `status` (`active`, `paused`, `archived`)
- `auto_append_utm`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`

## Core Endpoints

- `POST /api/qrcodes`
- `POST /api/qrcodes/bulk`
- `GET /api/qrcodes`
- `PATCH /api/qrcodes/<id>`
- `GET /api/qrcodes/<id>/download?format=png|svg|pdf`
- `GET /t/<slug>`
- `GET /api/analytics/summary`
- `GET /api/analytics/timeseries`
- `GET /api/analytics/top`
- `GET /api/analytics/breakdown`
- `POST /api/goals`
- `POST /api/conversions`
- `GET /api/export/scans.csv`
- `GET /api/export/qrcodes.csv`

## Conversion Tracking

Option 1:

- Send server-side event to `POST /api/conversions` with `slug` or `qr_code_id`.
- Optionally include `current_url` and the backend will auto-match an active `target_url` goal.

Option 2:

- Embed pixel on conversion page:

```html
<img src="https://your-domain/goal.gif?slug=YOUR_SLUG&event_name=signup" alt="" width="1" height="1" />
```

## Data Retention Cleanup

CLI:

```bash
python app.py --purge --days 180
```

API:

```bash
curl -X POST http://localhost:5000/api/retention/run -H "Content-Type: application/json" -d '{"days":180}'
```

## Tests

```bash
pytest
```

## Privacy Notes

- IPs are anonymized (IPv4 `/24`, IPv6 `/48`) and then hashed.
- City/region/country are approximate and depend on the GeoIP DB used.
- Add legal/compliance controls (consent banners, DPA, retention policy) as required for your deployment context.
