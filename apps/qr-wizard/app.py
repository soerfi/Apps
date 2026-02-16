import csv
import hashlib
import io
import ipaddress
import json
import os
import re
import secrets
import threading
import zipfile
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import qrcode
import qrcode.image.svg
from PIL import Image
from flask import (
    Flask,
    Response,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    send_file,
    session,
)
from werkzeug.security import check_password_hash
from flask_sqlalchemy import SQLAlchemy
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import case, func, or_, text
from user_agents import parse as parse_user_agent

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///qr_tracker.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["IP_HASH_SALT"] = os.getenv("IP_HASH_SALT", "replace-me")
app.config["UNIQUE_WINDOW_HOURS"] = int(os.getenv("UNIQUE_WINDOW_HOURS", "24"))
app.config["DATA_RETENTION_DAYS"] = int(os.getenv("DATA_RETENTION_DAYS", "365"))
app.config["PUBLIC_BASE_URL"] = os.getenv("PUBLIC_BASE_URL", "").strip()
app.config["TRACKING_PARAM"] = os.getenv("TRACKING_PARAM", "qr_tid")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "a-very-secret-internal-key-12345")
# The password provided: asof$dSSDWggt89
app.config["ADMIN_PASSWORD_HASH"] = os.getenv("ADMIN_PASSWORD_HASH", "scrypt:32768:8:1$6jrKvL9KGbYOoKZG$7896820a48846f40b52b191a2b1391675b2993e3fe6a8dc9885cb9591003f06d9e2b1f475cc674ae57757d09237b84cf3b6efe77f294eae21a2077f55ac86978")


db = SQLAlchemy(app)


def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class QRCode(db.Model):
    __tablename__ = "qr_codes"

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(32), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)
    destination_url = db.Column(db.Text, nullable=False)
    campaign = db.Column(db.String(255), nullable=True)
    channel = db.Column(db.String(255), nullable=True)
    location = db.Column(db.String(255), nullable=True)
    asset = db.Column(db.String(255), nullable=True)
    owner = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")
    auto_append_utm = db.Column(db.Boolean, nullable=False, default=False)
    utm_source = db.Column(db.String(255), nullable=True)
    utm_medium = db.Column(db.String(255), nullable=True)
    utm_campaign = db.Column(db.String(255), nullable=True)
    utm_term = db.Column(db.String(255), nullable=True)
    utm_content = db.Column(db.String(255), nullable=True)
    dynamic = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_utc)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_utc, onupdate=now_utc)
    expires_at = db.Column(db.DateTime, nullable=True)


class ScanEvent(db.Model):
    __tablename__ = "scan_events"

    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey("qr_codes.id"), nullable=False, index=True)
    scanned_at = db.Column(db.DateTime, nullable=False, default=now_utc, index=True)
    ip_hash = db.Column(db.String(64), nullable=True, index=True)
    visitor_fingerprint = db.Column(db.String(64), nullable=True, index=True)
    country = db.Column(db.String(120), nullable=True)
    region = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(120), nullable=True)
    os = db.Column(db.String(120), nullable=True)
    browser = db.Column(db.String(120), nullable=True)
    device_type = db.Column(db.String(50), nullable=True)
    referrer = db.Column(db.Text, nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    is_bot = db.Column(db.Boolean, nullable=False, default=False, index=True)
    is_unique = db.Column(db.Boolean, nullable=False, default=False, index=True)
    is_duplicate = db.Column(db.Boolean, nullable=False, default=False, index=True)
    query_payload = db.Column(db.Text, nullable=True)


class QRHistory(db.Model):
    __tablename__ = "qr_history"

    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey("qr_codes.id"), nullable=False, index=True)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_utc)


class Goal(db.Model):
    __tablename__ = "goals"

    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey("qr_codes.id"), nullable=True, index=True)
    name = db.Column(db.String(255), nullable=False)
    target_url = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_utc)


class ConversionEvent(db.Model):
    __tablename__ = "conversion_events"

    id = db.Column(db.Integer, primary_key=True)
    qr_code_id = db.Column(db.Integer, db.ForeignKey("qr_codes.id"), nullable=False, index=True)
    goal_id = db.Column(db.Integer, db.ForeignKey("goals.id"), nullable=True, index=True)
    scan_event_id = db.Column(db.Integer, db.ForeignKey("scan_events.id"), nullable=True, index=True)
    event_name = db.Column(db.String(255), nullable=True)
    value = db.Column(db.Float, nullable=True)
    visitor_fingerprint = db.Column(db.String(64), nullable=True, index=True)
    occurred_at = db.Column(db.DateTime, nullable=False, default=now_utc, index=True)


def migrate_db():
    with app.app_context():
        # Check if expires_at exists
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        columns = [c["name"] for c in inspector.get_columns("qr_codes")]
        if "expires_at" not in columns:
            print("Migrating: Adding expires_at to qr_codes")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE qr_codes ADD COLUMN expires_at DATETIME'))
        
        # Also check for other tables if needed
        db.create_all()


# Call migration
try:
    migrate_db()
except Exception as e:
    print(f"Migration error: {e}")


class GeoResolver:
    def __init__(self):
        self.reader = None
        db_path = os.getenv("GEOIP_DB_PATH", "").strip()
        if not db_path:
            return
        try:
            import geoip2.database  # type: ignore

            if os.path.exists(db_path):
                self.reader = geoip2.database.Reader(db_path)
        except Exception:
            self.reader = None

    def resolve(self, ip_str):
        if not ip_str:
            return {"country": None, "region": None, "city": None}
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.is_private or ip_obj.is_loopback:
                return {"country": "Private", "region": None, "city": None}
        except ValueError:
            return {"country": None, "region": None, "city": None}

        if not self.reader:
            return {"country": None, "region": None, "city": None}

        try:
            city_info = self.reader.city(ip_str)
            region = city_info.subdivisions.most_specific.name if city_info.subdivisions else None
            return {
                "country": city_info.country.name,
                "region": region,
                "city": city_info.city.name,
            }
        except Exception:
            return {"country": None, "region": None, "city": None}


geo_resolver = GeoResolver()


BOT_KEYWORDS = {
    "bot",
    "spider",
    "crawler",
    "preview",
    "headless",
    "monitor",
    "httpclient",
}





def get_public_base_url():
    configured = app.config.get("PUBLIC_BASE_URL")
    if configured:
        return configured.rstrip("/")
    return request.url_root.rstrip("/")


def valid_url(value):
    try:
        parsed = urlparse(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def pick_text(payload, key, max_len=255):
    value = payload.get(key)
    if value is None:
        return None
    trimmed = str(value).strip()
    if not trimmed:
        return None
    return trimmed[:max_len]


def generate_slug(length=7):
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    while True:
        slug = "".join(secrets.choice(alphabet) for _ in range(length))
        if not QRCode.query.filter_by(slug=slug).first():
            return slug


def tracking_url(slug):
    return f"{get_public_base_url()}/t/{slug}"


def anonymize_ip(ip_str):
    if not ip_str:
        return None
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return None

    if ip_obj.version == 4:
        network = ipaddress.ip_network(f"{ip_str}/24", strict=False)
    else:
        network = ipaddress.ip_network(f"{ip_str}/48", strict=False)
    return f"{network.network_address}/{network.prefixlen}"


def ip_hash(ip_str):
    anon = anonymize_ip(ip_str)
    if not anon:
        return None
    salted = f"{app.config['IP_HASH_SALT']}::{anon}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.remote_addr


def is_bot_user_agent(ua):
    if not ua:
        return False
    ua_lower = ua.lower()
    if any(keyword in ua_lower for keyword in BOT_KEYWORDS):
        return True
    try:
        parsed = parse_user_agent(ua)
        return bool(parsed.is_bot)
    except Exception:
        return False


def parse_device(ua):
    if not ua:
        return {"os": None, "browser": None, "device_type": "unknown"}
    parsed = parse_user_agent(ua)
    if parsed.is_mobile:
        dtype = "mobile"
    elif parsed.is_tablet:
        dtype = "tablet"
    elif parsed.is_pc:
        dtype = "desktop"
    elif parsed.is_bot:
        dtype = "bot"
    else:
        dtype = "other"
    return {
        "os": f"{parsed.os.family} {parsed.os.version_string}".strip(),
        "browser": f"{parsed.browser.family} {parsed.browser.version_string}".strip(),
        "device_type": dtype,
    }


def visitor_fingerprint_from(ip_h, ua):
    normalized_ua = (ua or "")[:300].lower()
    if not ip_h and not normalized_ua:
        return None
    value = f"{ip_h}|{normalized_ua}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def to_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def apply_utm(url, qr_code):
    if not qr_code.auto_append_utm:
        return url

    utm_fields = {
        "utm_source": qr_code.utm_source,
        "utm_medium": qr_code.utm_medium,
        "utm_campaign": qr_code.utm_campaign,
        "utm_term": qr_code.utm_term,
        "utm_content": qr_code.utm_content,
    }
    clean = {k: v for k, v in utm_fields.items() if v}
    if not clean:
        return url

    parsed = urlparse(url)
    query_dict = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in clean.items():
        query_dict.setdefault(key, value)

    updated_query = urlencode(query_dict, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, updated_query, parsed.fragment))


def append_tracking_param(url, slug):
    param_name = app.config["TRACKING_PARAM"]
    if not param_name:
        return url
    parsed = urlparse(url)
    query_dict = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_dict.setdefault(param_name, slug)
    updated_query = urlencode(query_dict, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, updated_query, parsed.fragment))


def qr_to_dict(qr_code, scan_count=None):
    res = {
        "id": qr_code.id,
        "slug": qr_code.slug,
        "tracking_url": f"{app.config['PUBLIC_BASE_URL'].rstrip('/') if app.config['PUBLIC_BASE_URL'] else ''}/t/{qr_code.slug}" if app.config["PUBLIC_BASE_URL"] else None,
        "name": qr_code.name,
        "destination_url": qr_code.destination_url,
        "campaign": qr_code.campaign,
        "channel": qr_code.channel,
        "location": qr_code.location,
        "asset": qr_code.asset,
        "owner": qr_code.owner,
        "notes": qr_code.notes,
        "status": qr_code.status,
        "dynamic": qr_code.dynamic,
        "auto_append_utm": qr_code.auto_append_utm,
        "utm_source": qr_code.utm_source,
        "utm_medium": qr_code.utm_medium,
        "utm_campaign": qr_code.utm_campaign,
        "utm_term": qr_code.utm_term,
        "utm_content": qr_code.utm_content,
        "total_scans": scan_count if scan_count is not None else 0,
        "created_at": qr_code.created_at.isoformat(),
        "updated_at": qr_code.updated_at.isoformat(),
        "expires_at": qr_code.expires_at.isoformat() if qr_code.expires_at else None,
        # Integrated Primary Goal
        "goal_name": None,
        "goal_target": None
    }
    # Attach first active goal if exists
    primary_goal = Goal.query.filter_by(qr_code_id=qr_code.id, active=True).first()
    if primary_goal:
        res["goal_name"] = primary_goal.name
        res["goal_target"] = primary_goal.target_url
    return res


def save_history(qr_code_id, action, details=None):
    entry = QRHistory(qr_code_id=qr_code_id, action=action, details=details)
    db.session.add(entry)


def filters_from_request():
    start_raw = request.args.get("start")
    end_raw = request.args.get("end")
    parsed_start = None
    parsed_end = None

    if start_raw:
        try:
            parsed_start = datetime.fromisoformat(start_raw)
        except ValueError:
            pass
    if end_raw:
        try:
            parsed_end = datetime.fromisoformat(end_raw)
        except ValueError:
            pass

    return {
        "start": parsed_start,
        "end": parsed_end,
        "campaign": request.args.get("campaign"),
        "channel": request.args.get("channel"),
        "location": request.args.get("location"),
        "owner": request.args.get("owner"),
        "status": request.args.get("status"),
        "qr_code_id": request.args.get("qr_code_id", type=int),
    }


def apply_scan_filters(query, filters):
    query = query.join(QRCode, QRCode.id == ScanEvent.qr_code_id)

    if filters.get("start"):
        query = query.filter(ScanEvent.scanned_at >= filters["start"])
    if filters.get("end"):
        query = query.filter(ScanEvent.scanned_at <= filters["end"])
    for field in ["campaign", "channel", "location", "owner", "status"]:
        value = filters.get(field)
        if value:
            query = query.filter(getattr(QRCode, field) == value)
    if filters.get("qr_code_id"):
        query = query.filter(ScanEvent.qr_code_id == filters["qr_code_id"])

    return query


def apply_conversion_filters(query, filters):
    query = query.join(QRCode, QRCode.id == ConversionEvent.qr_code_id)

    if filters.get("start"):
        query = query.filter(ConversionEvent.occurred_at >= filters["start"])
    if filters.get("end"):
        query = query.filter(ConversionEvent.occurred_at <= filters["end"])
    for field in ["campaign", "channel", "location", "owner", "status"]:
        value = filters.get(field)
        if value:
            query = query.filter(getattr(QRCode, field) == value)
    if filters.get("qr_code_id"):
        query = query.filter(ConversionEvent.qr_code_id == filters["qr_code_id"])

    return query


def time_bucket_expr(granularity):
    if granularity == "hour":
        return func.strftime("%Y-%m-%d %H:00", ScanEvent.scanned_at)
    if granularity == "week":
        return func.strftime("%Y-W%W", ScanEvent.scanned_at)
    if granularity == "month":
        return func.strftime("%Y-%m", ScanEvent.scanned_at)
    return func.strftime("%Y-%m-%d", ScanEvent.scanned_at)


def breakdown_expr(field):
    if field == "campaign":
        return QRCode.campaign
    if field == "channel":
        return QRCode.channel
    if field == "location":
        return QRCode.location
    if field == "country":
        return ScanEvent.country
    if field == "region":
        return ScanEvent.region
    if field == "city":
        return ScanEvent.city
    if field == "device":
        return ScanEvent.device_type
    if field == "browser":
        return ScanEvent.browser
    if field == "os":
        return ScanEvent.os
    if field == "referrer":
        return ScanEvent.referrer
    if field == "hour_of_day":
        return func.strftime("%H", ScanEvent.scanned_at)
    if field == "day_of_week":
        return func.strftime("%w", ScanEvent.scanned_at)
    return QRCode.campaign


def build_qr_image(data, fmt, size_px=400):
    # Error correction H for robustness
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10, # box_size=10 with SvgPathImage produces 1-unit coordinates
        border=0,
    )
    qr.add_data(data)
    qr.make(fit=True)

    if fmt == "png":
        img_obj = qr.make_image(fill_color="black", back_color="white")
        # PilImage wrapper has the actual PIL image in _img
        pil_img = img_obj._img
        
        # Use NEAREST resampling to keep QR edges perfectly sharp
        resampling = getattr(Image, 'Resampling', Image).NEAREST
        if hasattr(Image, 'Resampling'):
            resampling = Image.Resampling.NEAREST
        
        pil_img = pil_img.resize((size_px, size_px), resampling)
        
        buffer = io.BytesIO()
        pil_img.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer, "image/png", "png"

    if fmt == "svg":
        factory = qrcode.image.svg.SvgPathImage
        img = qr.make_image(image_factory=factory) 
        buffer = io.BytesIO()
        img.save(buffer)
        svg_data = buffer.getvalue().decode("utf-8")
        
        # Extract module count for a perfect viewBox
        modules_count = len(qr.modules)
        
        # Completely rebuild the svg tag to ensure no extra whitespace/units
        # Added a white background rect for consistency.
        svg_head = f'<svg width="{size_px}" height="{size_px}" viewBox="0 0 {modules_count} {modules_count}" xmlns="http://www.w3.org/2000/svg">'
        svg_bg = f'<rect width="{modules_count}" height="{modules_count}" fill="white"/>'
        svg_data = re.sub(r'<svg[^>]*>', f'{svg_head}{svg_bg}', svg_data, count=1)
        
        final_buffer = io.BytesIO(svg_data.encode("utf-8"))
        return final_buffer, "image/svg+xml", "svg"


    raise ValueError("Unsupported format")


def status_value(raw):
    value = (raw or "active").strip().lower()
    if value not in {"active", "paused", "archived"}:
        return "active"
    return value


def purge_old_data(days):
    cutoff = now_utc() - timedelta(days=days)
    deleted_scans = ScanEvent.query.filter(ScanEvent.scanned_at < cutoff).delete()
    deleted_conversions = ConversionEvent.query.filter(ConversionEvent.occurred_at < cutoff).delete()
    db.session.commit()
    return deleted_scans, deleted_conversions


@app.before_request
def require_auth():
    # Public routes that dont need login
    public_paths = ["/api/login", "/static/", "/favicon.ico"]
    if request.path.startswith("/t/") or request.path in public_paths or request.path.startswith("/static/"):
        return
        
    if not session.get("authenticated"):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Unauthorized"}), 401
        # For the main page, we still serve the template, but the JS will show the login overlay
        # Alternatively, we could redirect, but showing an overlay is smoother for a SPA-like app
        pass

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    password = data.get("password")
    if password and check_password_hash(app.config["ADMIN_PASSWORD_HASH"], password):
        session["authenticated"] = True
        return jsonify({"success": True})
    return jsonify({"error": "Invalid password"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("authenticated", None)
    return jsonify({"success": True})

@app.route("/api/auth_status")
def auth_status():
    return jsonify({"authenticated": session.get("authenticated", False)})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "time": now_utc().isoformat()})


@app.route("/api/qrcodes", methods=["POST"])
def create_qr_code():
    payload = request.get_json(silent=True) or {}
    destination_url = (payload.get("destination_url") or "").strip()

    if not valid_url(destination_url):
        return jsonify({"error": "Please provide a valid http(s) destination_url"}), 400

    qr = QRCode(
        slug=generate_slug(),
        destination_url=destination_url,
        name=pick_text(payload, "name"),
        campaign=pick_text(payload, "campaign"),
        channel=pick_text(payload, "channel"),
        location=pick_text(payload, "location"),
        asset=pick_text(payload, "asset"),
        owner=pick_text(payload, "owner"),
        notes=payload.get("notes"),
        status=status_value(payload.get("status", "active")),
        auto_append_utm=to_bool(payload.get("auto_append_utm"), False),
        utm_source=pick_text(payload, "utm_source"),
        utm_medium=pick_text(payload, "utm_medium"),
        utm_campaign=pick_text(payload, "utm_campaign"),
        utm_term=pick_text(payload, "utm_term"),
        utm_content=pick_text(payload, "utm_content"),
        dynamic=True,
        expires_at=None, # Initialize
    )
    expires_at_raw = payload.get("expires_at")
    if expires_at_raw:
        try:
            qr.expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
        except ValueError:
            pass # Or return error

    db.session.add(qr)
    db.session.flush()

    # Integrated Goal Creation
    goal_name = (payload.get("goal_name") or "").strip()
    goal_target = (payload.get("goal_target") or "").strip()
    if goal_name:
        new_goal = Goal(qr_code_id=qr.id, name=goal_name, target_url=goal_target or None, active=True)
        db.session.add(new_goal)

    save_history(qr.id, "created", json.dumps({"destination_url": destination_url}))
    db.session.commit()

    data = qr_to_dict(qr)
    data["tracking_url"] = tracking_url(qr.slug)
    return jsonify(data), 201


@app.route("/api/qrcodes/bulk", methods=["POST"])
def bulk_create_qr_codes():
    if "file" not in request.files:
        return jsonify({"error": "Please upload a CSV file under the 'file' field"}), 400

    upload = request.files["file"]
    try:
        content = upload.stream.read().decode("utf-8-sig")
    except Exception:
        return jsonify({"error": "Could not read CSV file as UTF-8"}), 400

    if not content.strip():
        return jsonify({"error": "CSV file is empty"}), 400

    # Auto-detect dialect (delimiter)
    try:
        dialect = csv.Sniffer().sniff(content[:2048], delimiters=";,|\t")
    except csv.Error:
        # Fallback to comma if sniffing fails
        dialect = "excel"

    csv_file = io.StringIO(content)
    
    # Check for header
    try:
        has_header = csv.Sniffer().has_header(content[:2048])
    except csv.Error:
        has_header = False

    # Force check for specific header keywords to be sure
    first_line = content.splitlines()[0].lower()
    if not has_header:
        # Sometimes sniffer says no header but we might have one if it looks like key=value or standard keys
        if "destination_url" in first_line or "url" in first_line:
            has_header = True
    
    csv_file.seek(0)
    
    rows_to_process = []
    
    try:
        if has_header:
            reader = csv.DictReader(csv_file, dialect=dialect)
            # Normalize keys to lowercase just in case
            # But DictReader keys depend on the header row.
            # We'll just read and try to find matching keys.
            for row in reader:
                # support various column names
                cleaned_row = {k.strip().lower(): v for k, v in row.items() if k}
                rows_to_process.append(cleaned_row)
        else:
            # No header: assume first column is URL
            reader = csv.reader(csv_file, dialect=dialect)
            for row in reader:
                if row:
                    rows_to_process.append({"destination_url": row[0], "url": row[0]})
    except Exception as e:
         return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400

    created = []
    errors = []

    for idx, row in enumerate(rows_to_process, start=2 if has_header else 1):
        # Flexible key lookup
        raw_destination = row.get("destination_url") or row.get("url") or row.get("link") or row.get("target")
        destination_url = (raw_destination or "").strip()

        if not valid_url(destination_url):
            # Sometimes empty rows creep in
            if not destination_url:
                 continue
            errors.append({"row": idx, "error": f"Invalid destination_url: '{destination_url}'"})
            continue

        # Extract other fields if they exist (mostly for header-based CSVs)
        qr = QRCode(
            slug=generate_slug(),
            destination_url=destination_url,
            name=pick_text(row, "name"),
            campaign=pick_text(row, "campaign"),
            channel=pick_text(row, "channel"),
            location=pick_text(row, "location"),
            asset=pick_text(row, "asset"),
            owner=pick_text(row, "owner"),
            notes=row.get("notes"),
            status=status_value(row.get("status", "active")),
            auto_append_utm=to_bool(row.get("auto_append_utm"), False),
            utm_source=pick_text(row, "utm_source"),
            utm_medium=pick_text(row, "utm_medium"),
            utm_campaign=pick_text(row, "utm_campaign"),
            utm_term=pick_text(row, "utm_term"),
            utm_content=pick_text(row, "utm_content"),
            dynamic=True,
        )
        db.session.add(qr)
        db.session.flush()
        save_history(qr.id, "created_bulk", json.dumps({"row": idx}))
        created.append(qr)

    db.session.commit()

    return jsonify(
        {
            "created": [
                {
                    "id": qr.id,
                    "slug": qr.slug,
                    "name": qr.name,
                    "destination_url": qr.destination_url,
                    "tracking_url": tracking_url(qr.slug),
                }
                for qr in created
            ],
            "created_ids": [qr.id for qr in created],
            "created_count": len(created),
            "errors": errors,
        }
    )


@app.route("/api/qrcodes", methods=["GET"])
def list_qr_codes():
    # Use a subquery to get scan counts for all QRs in the result set efficiently
    scan_counts = (
        db.session.query(ScanEvent.qr_code_id, func.count(ScanEvent.id).label("count"))
        .group_by(ScanEvent.qr_code_id)
        .subquery()
    )

    query = db.session.query(QRCode, scan_counts.c.count).outerjoin(
        scan_counts, QRCode.id == scan_counts.c.qr_code_id
    )

    q = (request.args.get("q") or "").strip()
    status = request.args.get("status")
    campaign = request.args.get("campaign")
    channel = request.args.get("channel")
    location = request.args.get("location")
    owner = request.args.get("owner")

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                QRCode.name.ilike(like),
                QRCode.slug.ilike(like),
                QRCode.destination_url.ilike(like),
                QRCode.campaign.ilike(like),
                QRCode.channel.ilike(like),
                QRCode.location.ilike(like),
                QRCode.asset.ilike(like),
                QRCode.owner.ilike(like),
            )
        )

    if status:
        query = query.filter(QRCode.status == status)
    if campaign:
        query = query.filter(QRCode.campaign == campaign)
    if channel:
        query = query.filter(QRCode.channel == channel)
    if location:
        query = query.filter(QRCode.location == location)
    if owner:
        query = query.filter(QRCode.owner == owner)

    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 50, type=int), 1), 200)

    pagination = query.order_by(QRCode.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    items = []
    for qr, count in pagination.items:
        item = qr_to_dict(qr, scan_count=count)
        item["tracking_url"] = tracking_url(qr.slug)
        items.append(item)

    return jsonify(
        {
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        }
    )


@app.route("/api/qrcodes/<int:qr_code_id>", methods=["GET", "PATCH", "DELETE"])
def update_qr_code(qr_code_id):
    qr = db.session.get(QRCode, qr_code_id)
    if not qr:
        return jsonify({"error": "QR Code not found"}), 404

    if request.method == "GET":
        data = qr_to_dict(qr)
        data["tracking_url"] = tracking_url(qr.slug)
        return jsonify(data)

    if request.method == "DELETE":
        ScanEvent.query.filter_by(qr_code_id=qr.id).delete()
        ConversionEvent.query.filter_by(qr_code_id=qr.id).delete()
        QRHistory.query.filter_by(qr_code_id=qr.id).delete()
        Goal.query.filter_by(qr_code_id=qr.id).delete()
        db.session.delete(qr)
        db.session.commit()
        return jsonify({"success": True})

    payload = request.get_json(silent=True) or {}

    changes = {}

    for field in ["name", "campaign", "channel", "location", "asset", "owner", "notes"]:
        if field in payload:
            new_value = payload[field]
            setattr(qr, field, new_value.strip() if isinstance(new_value, str) else new_value)
            changes[field] = getattr(qr, field)

    if "destination_url" in payload:
        destination_url = (payload.get("destination_url") or "").strip()
        if not valid_url(destination_url):
            return jsonify({"error": "Invalid destination_url"}), 400
        qr.destination_url = destination_url
        changes["destination_url"] = destination_url

    if "expires_at" in payload:
        expires_at_raw = payload.get("expires_at")
        if expires_at_raw:
            try:
                qr.expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "Invalid date format for expires_at"}), 400
        else:
            qr.expires_at = None
        changes["expires_at"] = qr.expires_at.isoformat() if qr.expires_at else None

    # Status value is handled after expiration check in tracked_redirect, 
    # but let's allow manual status change too.
    if "status" in payload:
        qr.status = status_value(payload.get("status"))
        changes["status"] = qr.status

    if "auto_append_utm" in payload:
        qr.auto_append_utm = to_bool(payload.get("auto_append_utm"), qr.auto_append_utm)
        changes["auto_append_utm"] = qr.auto_append_utm

    for field in ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]:
        if field in payload:
            value = payload.get(field)
            setattr(qr, field, value.strip() if isinstance(value, str) else value)
            changes[field] = getattr(qr, field)

    # Goal Management
    goal_name = (payload.get("goal_name") or "").strip()
    goal_target = (payload.get("goal_target") or "").strip()
    
    # We find existing primary goal (one linked to this QR)
    existing_goal = Goal.query.filter_by(qr_code_id=qr.id).first()
    
    if goal_name:
        if existing_goal:
            existing_goal.name = goal_name
            existing_goal.target_url = goal_target or None
            existing_goal.active = True
        else:
            new_goal = Goal(qr_code_id=qr.id, name=goal_name, target_url=goal_target or None, active=True)
            db.session.add(new_goal)
        changes["goal_updated"] = True
    elif "goal_name" in payload and not goal_name:
        # User explicitly emptied goal_name -> deactivate or delete goal
        if existing_goal:
            db.session.delete(existing_goal)
            changes["goal_deleted"] = True

    db.session.add(qr)
    if changes:
        save_history(qr.id, "updated", json.dumps(changes))
    db.session.commit()

    data = qr_to_dict(qr)
    data["tracking_url"] = tracking_url(qr.slug)
    return jsonify(data)


@app.route("/api/qrcodes/bulk_action", methods=["POST"])
def bulk_actions():
    payload = request.get_json(silent=True) or {}
    action = payload.get("action")
    ids = payload.get("ids", [])

    if not ids:
        return jsonify({"error": "No IDs provided"}), 400

    qrs = QRCode.query.filter(QRCode.id.in_(ids)).all()
    if not qrs:
        return jsonify({"error": "No valid QR codes found"}), 404

    if action == "delete":
        for qr in qrs:
            ScanEvent.query.filter_by(qr_code_id=qr.id).delete()
            ConversionEvent.query.filter_by(qr_code_id=qr.id).delete()
            QRHistory.query.filter_by(qr_code_id=qr.id).delete()
            Goal.query.filter_by(qr_code_id=qr.id).delete()
            db.session.delete(qr)
        db.session.commit()
        return jsonify({"success": True, "count": len(qrs)})

    elif action == "update":
        data = payload.get("data", {})
        count = 0
        for qr in qrs:
            updated = False
            for field in ["campaign", "channel", "location", "owner", "status", "auto_append_utm", "expires_at"]:
                if field in data and data[field]: # Only update if value provided
                     # Bool check
                    val = data[field]
                    if field == "auto_append_utm":
                         val = to_bool(val, qr.auto_append_utm)
                    elif field == "status":
                         val = status_value(val)
                    elif field == "expires_at":
                        try:
                            val = datetime.fromisoformat(val.replace("Z", "+00:00"))
                        except ValueError:
                            continue
                    
                    if getattr(qr, field) != val:
                        setattr(qr, field, val)
                        updated = True
            if updated:
                count += 1
                db.session.add(qr)
        db.session.commit()
        return jsonify({"success": True, "count": count})

    elif action == "download_zip":
        fmt = (payload.get("format") or "png").lower()
        size_px = payload.get("size", 400)
        if fmt not in {"png", "svg"}:
            return jsonify({"error": "Invalid format"}), 400

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for qr in qrs:
                data = tracking_url(qr.slug)
                try:
                    img_buffer, _, ext = build_qr_image(data, fmt, size_px=size_px)
                    # filename: slug_name.ext
                    safe_name = "".join(c for c in (qr.name or "") if c.isalnum() or c in " -_").strip()
                    fname = f"{qr.slug}_{safe_name}.{ext}" if safe_name else f"{qr.slug}.{ext}"
                    zf.writestr(fname, img_buffer.getvalue())
                except Exception as e:
                    print(f"Error generating {qr.slug}: {e}")
        
        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"qrcodes_{fmt}.zip"
        )

    return jsonify({"error": "Invalid action"}), 400


@app.route("/api/qrcodes/<int:qr_code_id>/history", methods=["GET"])
def qr_history(qr_code_id):
    qr = db.session.get(QRCode, qr_code_id)
    if not qr:
        return jsonify({"error": "QR Code not found"}), 404
    history_rows = (
        QRHistory.query.filter_by(qr_code_id=qr_code_id)
        .order_by(QRHistory.created_at.desc())
        .limit(200)
        .all()
    )

    return jsonify(
        [
            {
                "id": row.id,
                "action": row.action,
                "details": row.details,
                "created_at": row.created_at.isoformat(),
            }
            for row in history_rows
        ]
    )


@app.route("/api/qrcodes/<int:qr_code_id>/download")
def download_qr_code(qr_code_id):
    qr = db.session.get(QRCode, qr_code_id)
    if not qr:
        return jsonify({"error": "QR Code not found"}), 404
    fmt = (request.args.get("format") or "png").lower()
    size_px = request.args.get("size", 400, type=int)
    data = tracking_url(qr.slug)

    if fmt not in {"png", "svg"}:
        return jsonify({"error": "format must be png or svg"}), 400

    buffer, mime_type, ext = build_qr_image(data, fmt, size_px=size_px)
    
    # Better naming: QR_Slug_Name.ext
    safe_name = "".join(c for c in (qr.name or "") if c.isalnum() or c in " -_").strip().replace(" ", "_")
    filename = f"QR_{qr.slug}_{safe_name}.{ext}" if safe_name else f"QR_{qr.slug}.{ext}"
    
    # Use as_attachment=True for downloads to satisfy browser security (prevents "insecure download" warnings)
    # But allow as_attachment=False for library previews if 'preview' param is present.
    is_preview = to_bool(request.args.get("preview"), False)
    
    return send_file(
        buffer,
        mimetype=mime_type,
        as_attachment=not is_preview,
        download_name=filename,
    )


def log_scan_sync(qr_id, raw_ip, ua, referrer, query_payload):
    """
    Synchronous logging to avoid threading issues on some server setups.
    """
    try:
        ip_h = ip_hash(raw_ip)
        visitor_fp = visitor_fingerprint_from(ip_h, ua)
        bot = is_bot_user_agent(ua)

        unique = False
        duplicate = False
        if not bot and visitor_fp:
            window = app.config["UNIQUE_WINDOW_HOURS"]
            window_start = now_utc() - timedelta(hours=window)
            
            prior = (
                ScanEvent.query.filter_by(qr_code_id=qr_id, visitor_fingerprint=visitor_fp, is_bot=False)
                .filter(ScanEvent.scanned_at >= window_start)
                .first()
            )
            unique = prior is None
            duplicate = prior is not None

        # Resolve Geo & Device (Sync)
        geo = geo_resolver.resolve(raw_ip)
        device = parse_device(ua)

        scan_event = ScanEvent(
            qr_code_id=qr_id,
            ip_hash=ip_h,
            visitor_fingerprint=visitor_fp,
            country=geo["country"],
            region=geo["region"],
            city=geo["city"],
            os=device["os"],
            browser=device["browser"],
            device_type=device["device_type"],
            referrer=referrer,
            user_agent=ua,
            is_bot=bot,
            is_unique=unique,
            is_duplicate=duplicate,
            query_payload=query_payload,
        )

        db.session.add(scan_event)
        db.session.commit()
    except Exception as e:
        print(f"Error logging scan for QR {qr_id}: {e}")


@app.route("/t/<slug>")
def tracked_redirect(slug):
    # Fetch QR code - fast query on indexed slug
    qr = QRCode.query.filter_by(slug=slug).first_or_404()
    
    # Check status
    if qr.status == "active" and qr.expires_at and qr.expires_at < now_utc():
        qr.status = "archived"
        db.session.commit()

    if qr.status != "active":
        return render_template("error.html", message=f"This QR Code is currently {qr.status}."), 410

    # Log synchronously to prevent server errors with threading
    log_scan_sync(
        qr.id,
        client_ip(),
        request.headers.get("User-Agent"),
        request.headers.get("Referer"),
        json.dumps(request.args.to_dict(flat=False))
    )

    # Calculate destination immediately
    destination = qr.destination_url
    destination = apply_utm(destination, qr)
    destination = append_tracking_param(destination, qr.slug)

    return redirect(destination, code=302)


@app.route("/api/goals", methods=["POST"])
def create_goal():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Goal name is required"}), 400

    qr_code_id = payload.get("qr_code_id")
    if qr_code_id:
        QRCode.query.get_or_404(qr_code_id)
    target_url = (payload.get("target_url") or "").strip() or None
    if target_url and not valid_url(target_url):
        return jsonify({"error": "target_url must be a valid http(s) URL"}), 400

    goal = Goal(
        qr_code_id=qr_code_id,
        name=name,
        target_url=target_url,
        description=payload.get("description"),
        active=to_bool(payload.get("active"), True),
    )
    db.session.add(goal)
    db.session.commit()

    return (
        jsonify(
            {
                "id": goal.id,
                "qr_code_id": goal.qr_code_id,
                "name": goal.name,
                "target_url": goal.target_url,
                "description": goal.description,
                "active": goal.active,
                "created_at": goal.created_at.isoformat(),
            }
        ),
        201,
    )


@app.route("/api/goals", methods=["GET"])
def list_goals():
    qr_code_id = request.args.get("qr_code_id", type=int)
    query = Goal.query
    if qr_code_id:
        query = query.filter(Goal.qr_code_id == qr_code_id)
    rows = query.order_by(Goal.created_at.desc()).all()

    return jsonify(
        [
            {
                "id": row.id,
                "qr_code_id": row.qr_code_id,
                "name": row.name,
                "target_url": row.target_url,
                "description": row.description,
                "active": row.active,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    )


@app.route("/api/conversions", methods=["POST"])
def create_conversion():
    payload = request.get_json(silent=True) or {}

    qr = None
    qr_code_id = payload.get("qr_code_id")
    slug = (payload.get("slug") or "").strip()

    if qr_code_id:
        qr = db.session.get(QRCode, qr_code_id)
    elif slug:
        qr = QRCode.query.filter_by(slug=slug).first()

    if not qr:
        return jsonify({"error": "Provide a valid qr_code_id or slug"}), 400

    goal_id = payload.get("goal_id")
    goal = None
    if goal_id:
        goal = db.session.get(Goal, goal_id)
        if not goal:
            return jsonify({"error": "goal_id not found"}), 400
    else:
        current_url = (payload.get("current_url") or "").strip()
        if current_url:
            goal_candidates = (
                Goal.query.filter(Goal.active.is_(True))
                .filter(or_(Goal.qr_code_id.is_(None), Goal.qr_code_id == qr.id))
                .all()
            )
            for candidate in goal_candidates:
                if candidate.target_url and current_url.startswith(candidate.target_url):
                    goal = candidate
                    break

    scan_event_id = payload.get("scan_event_id")
    if scan_event_id:
        scan = db.session.get(ScanEvent, scan_event_id)
        if not scan:
            return jsonify({"error": "scan_event_id not found"}), 400
        visitor_fp = scan.visitor_fingerprint
    else:
        ip_h = ip_hash(client_ip())
        visitor_fp = visitor_fingerprint_from(ip_h, request.headers.get("User-Agent"))

    conversion = ConversionEvent(
        qr_code_id=qr.id,
        goal_id=goal.id if goal else None,
        scan_event_id=scan_event_id,
        event_name=pick_text(payload, "event_name"),
        value=payload.get("value"),
        visitor_fingerprint=visitor_fp,
    )

    db.session.add(conversion)
    db.session.commit()

    return (
        jsonify(
            {
                "id": conversion.id,
                "qr_code_id": conversion.qr_code_id,
                "goal_id": conversion.goal_id,
                "event_name": conversion.event_name,
                "value": conversion.value,
                "occurred_at": conversion.occurred_at.isoformat(),
            }
        ),
        201,
    )


@app.route("/api/analytics/summary")
def analytics_summary():
    filters = filters_from_request()

    scan_query = apply_scan_filters(ScanEvent.query, filters).filter(ScanEvent.is_bot.is_(False))
    total_scans = scan_query.count()
    unique_scans = scan_query.filter(ScanEvent.is_unique.is_(True)).count()
    bot_scans = apply_scan_filters(ScanEvent.query, filters).filter(ScanEvent.is_bot.is_(True)).count()

    conversion_query = apply_conversion_filters(ConversionEvent.query, filters)
    conversions = conversion_query.count()

    conversion_rate = 0.0
    if unique_scans:
        conversion_rate = round((conversions / unique_scans) * 100, 2)

    return jsonify(
        {
            "total_scans": total_scans,
            "unique_scans": unique_scans,
            "bot_scans": bot_scans,
            "conversions": conversions,
            "conversion_rate": conversion_rate,
            "geo_accuracy_note": "Geo is IP-based and approximate; city-level resolution may be imprecise or unavailable.",
            "unique_definition": f"Unique = first non-bot scan per visitor fingerprint within {app.config['UNIQUE_WINDOW_HOURS']}h.",
        }
    )


@app.route("/api/analytics/timeseries")
def analytics_timeseries():
    filters = filters_from_request()
    granularity = (request.args.get("granularity") or "day").lower()
    if granularity not in {"hour", "day", "week", "month"}:
        return jsonify({"error": "granularity must be hour, day, week, or month"}), 400

    bucket = time_bucket_expr(granularity)

    rows = (
        apply_scan_filters(ScanEvent.query, filters)
        .with_entities(
            bucket.label("bucket"),
            func.count(ScanEvent.id).label("total_scans"),
            func.sum(case((ScanEvent.is_unique.is_(True), 1), else_=0)).label("unique_scans"),
        )
        .filter(ScanEvent.is_bot.is_(False))
        .group_by(bucket)
        .order_by(bucket.asc())
        .all()
    )

    return jsonify(
        [
            {
                "bucket": row.bucket,
                "total_scans": int(row.total_scans or 0),
                "unique_scans": int(row.unique_scans or 0),
            }
            for row in rows
        ]
    )


@app.route("/api/analytics/top")
def analytics_top_qr_codes():
    filters = filters_from_request()
    limit = min(max(request.args.get("limit", 10, type=int), 1), 100)

    rows = (
        apply_scan_filters(ScanEvent.query, filters)
        .with_entities(
            QRCode.id,
            QRCode.slug,
            QRCode.name,
            QRCode.campaign,
            QRCode.channel,
            QRCode.location,
            func.count(ScanEvent.id).label("total_scans"),
            func.sum(case((ScanEvent.is_unique.is_(True), 1), else_=0)).label("unique_scans"),
        )
        .filter(ScanEvent.is_bot.is_(False))
        .group_by(QRCode.id)
        .order_by(func.count(ScanEvent.id).desc())
        .limit(limit)
        .all()
    )

    return jsonify(
        [
            {
                "qr_code_id": row.id,
                "slug": row.slug,
                "name": row.name,
                "campaign": row.campaign,
                "channel": row.channel,
                "location": row.location,
                "total_scans": int(row.total_scans or 0),
                "unique_scans": int(row.unique_scans or 0),
            }
            for row in rows
        ]
    )


@app.route("/api/analytics/breakdown")
def analytics_breakdown():
    filters = filters_from_request()
    field = (request.args.get("field") or "campaign").lower()
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)

    expr = breakdown_expr(field)

    rows = (
        apply_scan_filters(ScanEvent.query, filters)
        .with_entities(
            expr.label("label"),
            func.count(ScanEvent.id).label("total_scans"),
            func.sum(case((ScanEvent.is_unique.is_(True), 1), else_=0)).label("unique_scans"),
        )
        .filter(ScanEvent.is_bot.is_(False))
        .group_by(expr)
        .order_by(func.count(ScanEvent.id).desc())
        .limit(limit)
        .all()
    )

    day_names = {
        "0": "Sunday",
        "1": "Monday",
        "2": "Tuesday",
        "3": "Wednesday",
        "4": "Thursday",
        "5": "Friday",
        "6": "Saturday",
    }

    payload = []
    for row in rows:
        label = row.label
        if field == "day_of_week" and label is not None:
            label = day_names.get(str(label), str(label))
        if field == "hour_of_day" and label is not None:
            label = f"{label}:00"
        payload.append(
            {
                "label": label or "(unknown)",
                "total_scans": int(row.total_scans or 0),
                "unique_scans": int(row.unique_scans or 0),
            }
        )

    return jsonify(payload)


@app.route("/api/export/scans.csv")
def export_scans_csv():
    filters = filters_from_request()
    rows = (
        apply_scan_filters(ScanEvent.query, filters)
        .with_entities(
            ScanEvent.id,
            ScanEvent.scanned_at,
            QRCode.slug,
            QRCode.name,
            QRCode.campaign,
            QRCode.channel,
            QRCode.location,
            QRCode.owner,
            ScanEvent.country,
            ScanEvent.region,
            ScanEvent.city,
            ScanEvent.os,
            ScanEvent.browser,
            ScanEvent.device_type,
            ScanEvent.referrer,
            ScanEvent.is_bot,
            ScanEvent.is_unique,
            ScanEvent.is_duplicate,
        )
        .order_by(ScanEvent.scanned_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "scan_id",
            "scanned_at",
            "slug",
            "name",
            "campaign",
            "channel",
            "location",
            "owner",
            "country",
            "region",
            "city",
            "os",
            "browser",
            "device_type",
            "referrer",
            "is_bot",
            "is_unique",
            "is_duplicate",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row.id,
                row.scanned_at.isoformat(),
                row.slug,
                row.name,
                row.campaign,
                row.channel,
                row.location,
                row.owner,
                row.country,
                row.region,
                row.city,
                row.os,
                row.browser,
                row.device_type,
                row.referrer,
                row.is_bot,
                row.is_unique,
                row.is_duplicate,
            ]
        )

    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv"
    response.headers["Content-Disposition"] = "attachment; filename=scans_export.csv"
    return response


@app.route("/api/export/qrcodes.csv")
def export_qrcodes_csv():
    rows = QRCode.query.order_by(QRCode.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "slug",
            "name",
            "destination_url",
            "tracking_url",
            "campaign",
            "channel",
            "location",
            "asset",
            "owner",
            "status",
            "auto_append_utm",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "created_at",
            "updated_at",
        ]
    )

    base = get_public_base_url()
    for qr in rows:
        writer.writerow(
            [
                qr.id,
                qr.slug,
                qr.name,
                qr.destination_url,
                f"{base}/t/{qr.slug}",
                qr.campaign,
                qr.channel,
                qr.location,
                qr.asset,
                qr.owner,
                qr.status,
                qr.auto_append_utm,
                qr.utm_source,
                qr.utm_medium,
                qr.utm_campaign,
                qr.utm_term,
                qr.utm_content,
                qr.created_at.isoformat(),
                qr.updated_at.isoformat(),
            ]
        )

    response = make_response(output.getvalue())
    response.headers["Content-Type"] = "text/csv"
    response.headers["Content-Disposition"] = "attachment; filename=qrcodes_export.csv"
    return response


@app.route("/api/analytics/options")
def analytics_options():
    campaigns = [row[0] for row in db.session.query(QRCode.campaign).distinct().all() if row[0]]
    channels = [row[0] for row in db.session.query(QRCode.channel).distinct().all() if row[0]]
    locations = [row[0] for row in db.session.query(QRCode.location).distinct().all() if row[0]]
    owners = [row[0] for row in db.session.query(QRCode.owner).distinct().all() if row[0]]

    return jsonify(
        {
            "campaigns": sorted(campaigns),
            "channels": sorted(channels),
            "locations": sorted(locations),
            "owners": sorted(owners),
        }
    )


@app.route("/api/library/stats")
def library_stats():
    rows = (
        db.session.query(QRCode.status, func.count(QRCode.id))
        .group_by(QRCode.status)
        .all()
    )
    summary = {"active": 0, "paused": 0, "archived": 0}
    for status, count in rows:
        summary[status] = count
    summary["total"] = sum(summary.values())
    return jsonify(summary)


@app.route("/api/retention/run", methods=["POST"])
def run_retention():
    days = request.get_json(silent=True) or {}
    retention_days = int(days.get("days") or app.config["DATA_RETENTION_DAYS"])
    deleted_scans, deleted_conversions = purge_old_data(retention_days)
    return jsonify(
        {
            "retention_days": retention_days,
            "deleted_scans": deleted_scans,
            "deleted_conversions": deleted_conversions,
        }
    )


@app.route("/goal.gif")
def conversion_pixel():
    slug = request.args.get("slug")
    event_name = request.args.get("event_name", "goal")
    if slug:
        qr = QRCode.query.filter_by(slug=slug).first()
        if qr:
            ip_h = ip_hash(client_ip())
            visitor_fp = visitor_fingerprint_from(ip_h, request.headers.get("User-Agent"))
            conversion = ConversionEvent(
                qr_code_id=qr.id,
                event_name=event_name,
                visitor_fingerprint=visitor_fp,
            )
            db.session.add(conversion)
            db.session.commit()

    pixel = b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
    return Response(pixel, mimetype="image/gif")


def init_db():
    with app.app_context():
        db.create_all()


init_db()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="QR Code Analytics Tool")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--purge", action="store_true", help="Purge old scan/conversion data and exit")
    parser.add_argument("--days", type=int, default=None, help="Retention window for --purge")
    args = parser.parse_args()

    if args.purge:
        with app.app_context():
            days = args.days or app.config["DATA_RETENTION_DAYS"]
            deleted_scans, deleted_conversions = purge_old_data(days)
            print(f"Purged scans={deleted_scans}, conversions={deleted_conversions}, days={days}")
    else:
        app.run(host=args.host, port=args.port, debug=args.debug)
