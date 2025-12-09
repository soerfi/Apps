from flask import Flask, request, send_file, jsonify, abort, send_from_directory
import yt_dlp
import os
import uuid
import threading
import time

app = Flask(__name__)
DOWNLOAD_DIR = os.getenv('DOWNLOAD_DIR', '/downloads')
CLEANUP_DELAY = int(os.getenv('CLEANUP_DELAY', '300'))
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def cleanup_file(filepath, delay=CLEANUP_DELAY):
    def _clean():
        time.sleep(delay)
        if os.path.exists(filepath):
            os.remove(filepath)
    threading.Thread(target=_clean, daemon=True).start()

@app.route('/')
def index():
    # Serve the frontend index.html using an absolute path
    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    return send_from_directory(frontend_path, 'index.html')

@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url', '').strip()
    # Basic validation for YouTube URLs (allow various subdomains)
    if not url or not (('youtube.com' in url) or ('youtu.be' in url)):
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    filename = f"{uuid.uuid4()}.mp4"
    filepath = os.path.join(DOWNLOAD_DIR, filename)

    ydl_opts = {
        'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        'outtmpl': filepath,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
        title = info.get('title', 'video').replace('/', '_')
        clean_title = "".join(c for c in title if c.isalnum() or c in " -_")[:100]
        download_name = f"{clean_title}.mp4"

        cleanup_file(filepath)
        return send_file(
            filepath,
            as_attachment=True,
            download_name=download_name,
            mimetype='video/mp4'
        )
    except Exception:
        # Remove any partially downloaded file and return a generic error
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': 'Failed to download video'}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)