"""
DocMind AI - Document Classification Service
Uses Google Gemini Flash to classify documents into structured categories
"""

import json
import re
import google.generativeai as genai
from utils.config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

CLASSIFICATION_PROMPT = """You are an expert document analyst. Analyze the following document text and classify it.

Document Name: {document_name}
Document Text (first 3000 chars):
---
{text_sample}
---

Respond with ONLY a valid JSON object (no markdown, no explanation) with exactly these fields:
{{
  "document_type": "Invoice|Contract|Report|Research Paper|Manual|Letter|Form|Resume|Presentation|Financial Statement|Legal Document|Medical Record|News Article|Email|Other",
  "topic": "brief topic description (max 50 chars)",
  "sensitivity_level": "Public|Internal|Confidential|Restricted",
  "language": "English|Hindi|Spanish|French|German|Arabic|Chinese|Other",
  "domain": "Business|Legal|Medical|Technology|Finance|Education|Government|Personal|Other",
  "summary": "2-3 sentence summary of the document content",
  "business_relevance": "High|Medium|Low",
  "confidence_score": 0.95
}}

Be accurate and concise. Return ONLY the JSON."""


async def classify_document(text_sample: str, document_name: str) -> dict:
    """
    Classify a document using Gemini Flash LLM.
    
    Args:
        text_sample: First portion of extracted document text
        document_name: Original filename for context
        
    Returns:
        Dictionary with classification fields
    """
    # Truncate text to first 3000 chars for classification
    truncated_text = text_sample[:3000].strip()

    if not truncated_text:
        return _default_classification("Empty document - no text extracted")

    try:
        if settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            return await _classify_with_gemini(truncated_text, document_name)
        elif settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY:
            return await _classify_with_groq(truncated_text, document_name)
        else:
            logger.warning("No LLM API key configured. Using rule-based classification.")
            return _rule_based_classification(truncated_text, document_name)

    except Exception as e:
        logger.error(f"Classification failed: {e}")
        return _default_classification(str(e))


async def _classify_with_gemini(text_sample: str, document_name: str) -> dict:
    """Classify using Google Gemini Flash 1.5."""
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = CLASSIFICATION_PROMPT.format(
            document_name=document_name,
            text_sample=text_sample
        )

        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=512,
            )
        )

        response_text = response.text.strip()
        # Clean any markdown code fences
        response_text = re.sub(r"```json\s*", "", response_text)
        response_text = re.sub(r"```\s*", "", response_text)

        result = json.loads(response_text)
        logger.info(f"Gemini classified '{document_name}' as: {result.get('document_type')}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini JSON response: {e}")
        return _default_classification("JSON parse error")
    except Exception as e:
        logger.error(f"Gemini classification error: {e}")
        return _default_classification(str(e))


async def _classify_with_groq(text_sample: str, document_name: str) -> dict:
    """Classify using Groq Llama (fallback)."""
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = CLASSIFICATION_PROMPT.format(
            document_name=document_name,
            text_sample=text_sample
        )

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=512,
        )

        response_text = completion.choices[0].message.content.strip()
        response_text = re.sub(r"```json\s*", "", response_text)
        response_text = re.sub(r"```\s*", "", response_text)
        result = json.loads(response_text)
        return result

    except Exception as e:
        logger.error(f"Groq classification error: {e}")
        return _default_classification(str(e))


def _rule_based_classification(text: str, document_name: str) -> dict:
    """Fallback rule-based classification when no API key is available."""
    text_lower = text.lower()
    name_lower = document_name.lower()

    doc_type = "Other"
    if any(k in text_lower for k in ["invoice", "total amount", "bill to", "payment"]):
        doc_type = "Invoice"
    elif any(k in text_lower for k in ["contract", "agreement", "hereby", "party"]):
        doc_type = "Contract"
    elif any(k in text_lower for k in ["report", "analysis", "findings", "summary"]):
        doc_type = "Report"
    elif any(k in text_lower for k in ["abstract", "references", "doi", "journal"]):
        doc_type = "Research Paper"
    elif any(k in name_lower for k in ["resume", "cv", "curriculum"]):
        doc_type = "Resume"

    return {
        "document_type": doc_type,
        "topic": "General Document",
        "sensitivity_level": "Internal",
        "language": "English",
        "domain": "Business",
        "summary": f"Document '{document_name}' processed with rule-based classification.",
        "business_relevance": "Medium",
        "confidence_score": 0.5,
    }


def _default_classification(reason: str) -> dict:
    """Default classification when processing fails."""
    return {
        "document_type": "Other",
        "topic": "Unknown",
        "sensitivity_level": "Internal",
        "language": "English",
        "domain": "Other",
        "summary": f"Classification unavailable: {reason}",
        "business_relevance": "Low",
        "confidence_score": 0.0,
    }
