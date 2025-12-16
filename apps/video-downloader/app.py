from flask import Flask, render_template, request, send_file, flash, redirect, url_for, send_from_directory, jsonify
import yt_dlp
import os
import logging
import uuid
import shutil
import subprocess
import threading
import re


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.secret_key = 'supersecretkey'

DOWNLOAD_FOLDER = os.path.abspath('downloads')
CONFIG_FOLDER = os.path.abspath('config')

def clean_downloads():
    """Cleans the downloads directory on startup."""
    # Ensure folders exist
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    os.makedirs(CONFIG_FOLDER, exist_ok=True)

    if os.path.exists(DOWNLOAD_FOLDER):
        logger.info(f"Cleaning downloads folder: {DOWNLOAD_FOLDER}")
        for filename in os.listdir(DOWNLOAD_FOLDER):
            file_path = os.path.join(DOWNLOAD_FOLDER, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                logger.error(f'Failed to delete {file_path}. Reason: {e}')

# Clean downloads on startup
clean_downloads()

@app.route('/cookies', methods=['POST'])
def upload_cookies():
    if 'file' not in request.files:
        flash('No file part', 'error')
        return redirect(url_for('index'))
    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'error')
        return redirect(url_for('index'))
    if file:
        filepath = os.path.join(CONFIG_FOLDER, 'cookies.txt')
        file.save(filepath)
        flash('Cookies uploaded successfully!', 'success')
        return redirect(url_for('index'))

@app.route('/downloads/<path:filename>')
def custom_static(filename):
    return send_from_directory(DOWNLOAD_FOLDER, filename)

@app.route('/')
def index():
    cookies_present = os.path.exists(os.path.join(CONFIG_FOLDER, 'cookies.txt'))
    return render_template('index.html', cookies_present=cookies_present)

@app.route('/fetch', methods=['POST'])
def fetch_video():
    url = request.form.get('url')
    if not url:
        flash('Please enter a URL.', 'error')
        return redirect(url_for('index'))

    download_id = str(uuid.uuid4())
    current_download_dir = os.path.join(DOWNLOAD_FOLDER, download_id)
    os.makedirs(current_download_dir, exist_ok=True)

    try:
        # Download the full video in best quality and merge to mp4
        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(current_download_dir, 'original.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
        }
        
        cookie_file = os.path.join(CONFIG_FOLDER, 'cookies.txt')
        if os.path.exists(cookie_file):
            ydl_opts['cookiefile'] = cookie_file
            logger.info("Using cookies.txt for authentication")

        logger.info(f"Fetching video for URL: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_title = info.get('title', 'video')

        files = os.listdir(current_download_dir)
        files = [f for f in files if not f.startswith('.')]
        if not files:
            raise Exception("No file downloaded")
        
        filename = files[0]
        # Pass the relative path for the frontend to load in <video> tag
        video_url = url_for('custom_static', filename=f"{download_id}/{filename}")
        
        return render_template('editor.html', video_url=video_url, directory=download_id, filename=filename, video_title=video_title)

    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        flash(f"Could not fetch video: {str(e)}", 'error')
        shutil.rmtree(current_download_dir, ignore_errors=True)
        return redirect(url_for('index'))

# Job store for async processing
jobs = {}

def parse_time_str(time_str):
    """Parses HH:MM:SS.mm into seconds"""
    if not time_str: return 0.0
    try:
        parts = time_str.split(':')
        seconds = float(parts[-1])
        if len(parts) > 1:
            seconds += int(parts[-2]) * 60
        if len(parts) > 2:
            seconds += int(parts[-3]) * 3600
        return seconds
    except:
        return 0.0

def run_ffmpeg_job(job_id, cmd, total_duration, output_path, output_filename):
    """Background thread to run ffmpeg and track progress"""
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
        
        # Read stderr for progress
        while True:
            line = process.stderr.readline()
            if not line and process.poll() is not None:
                break
            
            if line:
                # Debug logging to see what's happening
                # logger.info(f"FFmpeg: {line.strip()}") 
                
                # Parse time=HH:MM:SS.mm
                if "time=" in line:
                    match = re.search(r'time=(\d{2}:\d{2}:\d{2}\.\d+)', line)
                    if match:
                        current_time_str = match.group(1)
                        current_seconds = parse_time_str(current_time_str)
                        if total_duration > 0:
                            percent = min(99, int((current_seconds / total_duration) * 100))
                            jobs[job_id]['progress'] = percent
                            # logger.info(f"Job {job_id} progress: {percent}%")

        
        if process.returncode == 0:
            jobs[job_id]['progress'] = 100
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['result_path'] = output_path
            jobs[job_id]['download_name'] = output_filename
        else:
            jobs[job_id]['status'] = 'failed'
            jobs[job_id]['error'] = "FFmpeg process failed"
            
    except Exception as e:
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['error'] = str(e)
        logger.error(f"Job {job_id} failed: {e}")

@app.route('/process', methods=['POST'])
def process_video():
    directory = request.form.get('directory')
    filename = request.form.get('filename')
    video_title = request.form.get('video_title', 'video')
    start_time = request.form.get('start_time')
    end_time = request.form.get('end_time')
    fmt = request.form.get('format', 'mp4')
    
    # Advanced settings
    fps = request.form.get('fps')
    width = request.form.get('width')
    quality = request.form.get('quality')
    
    # Force join fps for non-animated formats to prevent accidental downsampling
    if fmt not in ['gif', 'webp']:
        fps = None


    if not directory or not filename:
         return jsonify({'error': 'Missing parameters'}), 400

    work_dir = os.path.join(DOWNLOAD_FOLDER, directory)
    input_path = os.path.join(work_dir, filename)
    
    # Calculate total duration for progress
    start_sec = parse_time_str(start_time)
    end_sec = parse_time_str(end_time)
    duration = end_sec - start_sec if end_sec > start_sec else 0

    # Output filename
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_title = "".join([c for c in video_title if c.isalnum() or c in (' ', '-', '_')]).strip().replace(' ', '_') or "video"
    output_filename = f"{safe_title}_{timestamp}.{fmt}"
    output_path = os.path.join(work_dir, output_filename)

    # Build Command
    cmd = ['ffmpeg', '-y', '-i', input_path]
    if start_time: cmd.extend(['-ss', start_time])
    if end_time: cmd.extend(['-to', end_time])
    
    filters = []
    if fps: filters.append(f"fps={fps}")
    if width: filters.append(f"scale={width}:-1:flags=lanczos")
    
    if fmt in ['mp3', 'wav']:
        cmd.extend(['-vn'])
        if fmt == 'mp3': cmd.extend(['-acodec', 'libmp3lame', '-q:a', '2'])
    
    elif fmt == 'gif':
        if not width: filters.append("scale=480:-1:flags=lanczos")
        if filters: cmd.extend(['-vf', ','.join(filters)])
    
    elif fmt == 'webp':
        if filters: cmd.extend(['-vf', ','.join(filters)])
        cmd.extend(['-c:v', 'libwebp', '-lossless', '0', '-compression_level', '4', '-q:v', '75', '-loop', '0', '-an'])

    elif fmt == 'webm':
         if filters: cmd.extend(['-vf', ','.join(filters)])
         crf_val = quality if quality else '30'
         cmd.extend(['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', crf_val, '-cpu-used', '4', '-row-mt', '1', '-c:a', 'libopus'])
    
    else: # MP4/MKV
        if filters: cmd.extend(['-vf', ','.join(filters)])
        crf_val = quality if quality else '23'
        cmd.extend(['-c:v', 'libx264', '-preset', 'fast', '-crf', crf_val, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac'])

    cmd.append(output_path)
    
    # Start Job
    job_id = str(uuid.uuid4())
    jobs[job_id] = {'status': 'processing', 'progress': 0}
    
    thread = threading.Thread(target=run_ffmpeg_job, args=(job_id, cmd, duration, output_path, output_filename))
    thread.start()
    
    return jsonify({'job_id': job_id})

@app.route('/progress/<job_id>')
def get_progress(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)

@app.route('/download_file/<job_id>')
def download_file(job_id):
    job = jobs.get(job_id)
    if not job or job['status'] != 'completed':
        flash('File not ready or expired.', 'error')
        return redirect(url_for('index'))
    return send_file(job['result_path'], as_attachment=True, download_name=job['download_name'])

if __name__ == '__main__':
    app.run(debug=True, port=5001)