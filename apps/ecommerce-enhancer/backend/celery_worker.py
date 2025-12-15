from app import app, celery

if __name__ == '__main__':
    celery.start()
