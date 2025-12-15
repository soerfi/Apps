import os
from flask import Flask, jsonify, request
from celery import Celery
import uuid
from flask_cors import CORS

def make_celery(app):
    celery = Celery(
        app.import_name,
        backend=app.config['CELERY_RESULT_BACKEND'],
        broker=app.config['CELERY_BROKER_URL']
    )
    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery

app = Flask(__name__)
CORS(app)

# Configuration
app.config.update(
    CELERY_BROKER_URL=os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    CELERY_RESULT_BACKEND=os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
)

celery = make_celery(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'E-Commerce Enhancer API is running'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Save file temporarily or stream to processing
    # For now, just a stub
    filename = str(uuid.uuid4()) + "_" + file.filename
    # os.makedirs('uploads', exist_ok=True)
    # file.save(os.path.join('uploads', filename))
    
    return jsonify({'message': 'File uploaded', 'filename': filename}), 200

# Import tasks to ensure they are registered
from tasks import process_image_task

@app.route('/api/process', methods=['POST'])
def trigger_process():
    data = request.json
    image_id = data.get('image_id')
    preset = data.get('preset')
    
    if not image_id or not preset:
        return jsonify({'error': 'Missing image_id or preset'}), 400

    task = process_image_task.delay(image_id, preset)
    return jsonify({'task_id': task.id}), 202

@app.route('/api/status/<task_id>', methods=['GET'])
def get_status(task_id):
    task = process_image_task.AsyncResult(task_id)
    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Pending...'
        }
    elif task.state != 'FAILURE':
        response = {
            'state': task.state,
            'result': task.result
        }
    else:
        # something went wrong in the background job
        response = {
            'state': task.state,
            'status': str(task.info),  # this is the exception raised
        }
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
