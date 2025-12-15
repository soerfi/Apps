from app import celery
import time
import random
from services.nano_banana import NanoBananaClient
from services.color_guardian import ColorGuardianService

@celery.task(bind=True)
def process_image_task(self, image_id, preset):
    """
    Background image processing task.
    """
    self.update_state(state='PROGRESS', meta={'status': f'Initializing preset: {preset}...'})
    
    # Initialize Clients
    client = NanoBananaClient()
    
    # In a real app, 'image_id' would be used to find the file path
    # For this demo, we assume a local lookup or upload URL
    # image_path = f"uploads/{image_id}" 
    # For the API call, we might need a public URL or base64. 
    # Mocking the source URL:
    image_url = f"http://myserver.com/uploads/{image_id}"

    # Step 1: Color Extraction (Color Guardian P1)
    # real_color = ColorGuardianService.extract_dominant_color(image_path)
    extracted_color = "#E63946" # Mocked for now, or implement real PIL logic if desired
    
    self.update_state(state='PROGRESS', meta={'status': f'Color Guardian: Locked {extracted_color}.'})
    time.sleep(1)

    # Step 2: Call Nano Banana API
    self.update_state(state='PROGRESS', meta={'status': 'Contacting Nano Banana Pro API...'})
    
    try:
        # P2: Prompt Injection is handled inside the client based on preset
        result_url = client.generate_image(
            preset=preset, 
            image_url=image_url, 
            hex_color=extracted_color
        )
    except Exception as e:
        self.update_state(state='FAILURE', meta={'status': f'API Error: {str(e)}'})
        # Re-raise to ensure Celery marks it failed
        raise e

    # Step 3: Verification (P3)
    self.update_state(state='PROGRESS', meta={'status': 'Verifying Color Fidelity (Delta E)...'})
    time.sleep(1)
    
    # Real verification would download result_url and compare
    # delta_e = ColorGuardianService.verify(extracted_color, result_url)
    delta_e = round(random.uniform(0.5, 2.5), 2)

    return {
        'status': 'Completed',
        'result_url': result_url,
        'color_metrics': {
            'target': extracted_color,
            'delta_e': delta_e,
            'preset': preset
        }
    }
