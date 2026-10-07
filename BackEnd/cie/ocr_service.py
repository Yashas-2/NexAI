import logging

logger = logging.getLogger(__name__)

def extract_text_from_base64(image_b64: str) -> str:
    """
    Simulated OCR service. 
    In a real implementation, this would call Google Cloud Vision API 
    or a local TrOCR model to extract text from the base64 image.
    """
    if not image_b64:
        return ""
        
    logger.info("Mock OCR: Processing base64 image for text extraction...")
    
    # Simulate processing time/logic here if needed
    
    # Return mock transcription
    return "[Simulated OCR Extraction]\nThe quick brown fox jumps over the lazy dog.\n(This is a mock transcription of the handwritten image)"
