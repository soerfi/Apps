from flask import Flask, request, send_file, jsonify, abort
import yt_dlp
import os
import uuid
import threading
import time

app = Flask(__name__)
DOWNLOAD_DIR = "/downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def cleanup_file(filepath, delay=300):
    def _clean():
        time.sleep(delay)
        if os.path.exists(filepath):
            os.remove(filepath)
    threading.Thread(target=_clean, daemon=True).start()

@app.route('/')
def index():
    return app.send_static_file('../frontend/index.html')

@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url or ('youtube.com' not in url and 'youtu.be' not in url):
        return jsonify({'error': 'Ungültige YouTube-URL'}), 400

    filename = f"{uuid.uuid4()}.mp4"
    filepath = os.path.join(DOWNLOAD_DIR, filename)

    ydl_opts = {
        'format': 'best[height<=1080][ext=mp4]/best[height<=1080]',
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
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)