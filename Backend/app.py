import os
import re
import math
import json
import io
from collections import Counter
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

# Try importing PDF extractors
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

# Try importing OpenAI if API key provided
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

load_dotenv('env/.env')
load_dotenv()

app = Flask(__name__)
CORS(app)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'md', 'csv', 'doc', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_storage):
    """Extract plain text from uploaded file buffer."""
    filename = file_storage.filename.lower()
    content_type = file_storage.mimetype
    file_bytes = file_storage.read()
    
    extracted_text = ""
    
    if filename.endswith('.pdf'):
        # Method 1: PyMuPDF (fitz)
        if HAS_PYMUPDF:
            try:
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    extracted_text += page.get_text() + "\n"
            except Exception as e:
                print(f"PyMuPDF error: {e}")
        
        # Method 2: pypdf fallback
        if not extracted_text.strip() and HAS_PYPDF:
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
            except Exception as e:
                print(f"pypdf error: {e}")
                
        if not extracted_text.strip():
            raise ValueError("Could not extract readable text from PDF. It may be scanned or image-only.")

    elif filename.endswith('.txt') or filename.endswith('.md') or filename.endswith('.csv'):
        try:
            extracted_text = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            extracted_text = file_bytes.decode('latin-1', errors='ignore')
            
    elif filename.endswith('.docx') or filename.endswith('.doc'):
        # Simple plain-text extraction from docx xml inside zip if python-docx not installed
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                xml_content = z.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                paragraphs = []
                for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                    texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                    if texts:
                        paragraphs.append("".join(texts))
                extracted_text = "\n\n".join(paragraphs)
        except Exception as e:
            # Fallback string extraction
            extracted_text = re.sub(r'[^\x20-\x7E\n\r\t]', '', file_bytes.decode('latin-1', errors='ignore'))
            
    else:
        try:
            extracted_text = file_bytes.decode('utf-8', errors='ignore')
        except Exception:
            raise ValueError("Unsupported or unreadable file format.")

    return extracted_text.strip()

# --- NLP & TextRank Summarization Engine ---

STOP_WORDS = set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
    'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
    'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
    'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
    'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
    'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
    'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
    'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
    'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
    'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which',
    'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
    'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'also', 'said', 'one', 'two', 'also'
])

def clean_tokenize(text):
    words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())
    return [w for w in words if w not in STOP_WORDS]

def split_into_sentences(text):
    """Split text into clean sentences."""
    raw_sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = []
    for s in raw_sentences:
        clean_s = s.strip()
        if len(clean_s) > 15:  # Ignore tiny fragments
            sentences.append(clean_s)
    return sentences

def extract_keywords(text, top_n=10):
    words = clean_tokenize(text)
    freq = Counter(words)
    return [{"keyword": word, "count": count} for word, count in freq.most_common(top_n)]

def analyze_sentiment(text):
    positive_words = {'great', 'excellent', 'success', 'growth', 'positive', 'increase', 'profit', 'improvement', 'high', 'effective', 'strong', 'solution', 'advantage', 'key', 'benefit', 'best', 'valuable'}
    negative_words = {'risk', 'decline', 'loss', 'issue', 'problem', 'failure', 'negative', 'decrease', 'concern', 'cost', 'threat', 'challenge', 'difficult', 'delay', 'vulnerable', 'low', 'error'}
    
    words = clean_tokenize(text)
    pos_count = sum(1 for w in words if w in positive_words)
    neg_count = sum(1 for w in words if w in negative_words)
    
    if pos_count > neg_count + 2:
        sentiment = "Positive / Optimistic"
    elif neg_count > pos_count + 2:
        sentiment = "Critical / Problem-Focused"
    elif pos_count > 0 or neg_count > 0:
        sentiment = "Balanced / Analytical"
    else:
        sentiment = "Objective / Informative"
        
    return {
        "sentiment": sentiment,
        "positiveScore": pos_count,
        "negativeScore": neg_count
    }

def summarize_text_offline(text, summary_type="executive", ratio=0.3, focus_keyword=None):
    sentences = split_into_sentences(text)
    if not sentences:
        return {
            "summaryText": text,
            "bulletPoints": [text],
            "keyInsights": ["Document is too short for detailed summarization."]
        }
        
    if len(sentences) <= 3:
        return {
            "summaryText": text,
            "bulletPoints": sentences,
            "keyInsights": ["Short text converted directly into key points."]
        }

    # Calculate word frequency matrix
    all_words = clean_tokenize(text)
    word_freq = Counter(all_words)
    max_freq = max(word_freq.values()) if word_freq else 1
    
    # Normalize frequencies
    norm_word_freq = {w: count / max_freq for w, count in word_freq.items()}
    
    # Score sentences based on word position, frequency, and length
    sentence_scores = []
    num_sentences = len(sentences)
    
    for i, sent in enumerate(sentences):
        words = clean_tokenize(sent)
        if not words:
            sentence_scores.append(0)
            continue
            
        score = sum(norm_word_freq.get(w, 0) for w in words) / (math.log(len(words) + 1))
        
        # Position bias: Give boost to opening & concluding sentences
        if i < min(3, num_sentences):
            score *= 1.4
        elif i >= num_sentences - 2:
            score *= 1.2
            
        # Focus keyword boost if provided
        if focus_keyword and focus_keyword.lower() in sent.lower():
            score *= 2.0
            
        sentence_scores.append(score)

    # Select top sentences based on ratio
    target_count = max(2, min(int(num_sentences * ratio), num_sentences))
    
    if summary_type == "concise":
        target_count = max(2, int(num_sentences * 0.15))
    elif summary_type == "detailed":
        target_count = max(4, int(num_sentences * 0.45))
        
    # Get indices of top scoring sentences
    ranked_indices = sorted(range(len(sentence_scores)), key=lambda k: sentence_scores[k], reverse=True)[:target_count]
    # Re-order by original chronological position
    chronological_indices = sorted(ranked_indices)
    
    selected_sentences = [sentences[i] for i in chronological_indices]
    summary_text = " ".join(selected_sentences)
    
    # Generate Bullet Points
    bullet_points = [f"• {s}" for s in selected_sentences]
    
    # Generate Key Takeaways (Top 3 highest scoring distinct sentences)
    top_3_indices = sorted(ranked_indices[:3])
    key_insights = [sentences[i] for i in top_3_indices]
    
    return {
        "summaryText": summary_text,
        "bulletPoints": bullet_points,
        "keyInsights": key_insights
    }

# --- OpenAI LLM Summarizer (Optional API Fallback) ---
def summarize_with_openai(text, api_key, summary_type="executive", length="standard"):
    if not HAS_OPENAI:
        return None
        
    client = openai.OpenAI(api_key=api_key)
    
    prompt = f"""You are an expert executive document summarizer. 
Analyze the following text and provide:
1. An {summary_type} summary formatted clearly.
2. 4-6 high-impact key bullet points.
3. 3 core key takeaways.

Length requirement: {length}

Text:
{text[:12000]}
"""

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )
    
    content = response.choices[0].message.content
    return content

# --- REST Endpoints ---

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "service": "AI Document Summarizer Backend API",
        "hasPyMuPDF": HAS_PYMUPDF,
        "hasPyPDF": HAS_PYPDF,
        "hasOpenAI": HAS_OPENAI
    }), 200

@app.route('/api/extract-text', methods=['POST'])
def extract_text():
    try:
        raw_text = ""
        filename = "pasted_text.txt"
        
        if 'file' in request.files:
            file_storage = request.files['file']
            filename = file_storage.filename
            raw_text = extract_text_from_file(file_storage)
        elif request.is_json:
            data = request.get_json()
            raw_text = data.get('text', '')
            filename = data.get('filename', 'Direct Input Text')
        else:
            raw_text = request.form.get('text', '')
            
        if not raw_text.strip():
            return jsonify({"success": False, "message": "No text content found to extract."}), 400
            
        words = raw_text.split()
        word_count = len(words)
        char_count = len(raw_text)
        read_time_mins = max(1, math.ceil(word_count / 200)) # ~200 wpm average reading speed
        
        return jsonify({
            "success": True,
            "filename": filename,
            "text": raw_text,
            "wordCount": word_count,
            "charCount": char_count,
            "estimatedReadTimeMins": read_time_mins,
            "preview": raw_text[:300] + ("..." if char_count > 300 else "")
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize():
    try:
        text = ""
        filename = "Document"
        
        # Check if file uploaded or json payload passed
        if 'file' in request.files:
            file_storage = request.files['file']
            filename = file_storage.filename
            text = extract_text_from_file(file_storage)
            summary_type = request.form.get('summary_type', 'executive')
            length = request.form.get('length', 'standard')
            focus_keyword = request.form.get('focus_keyword', None)
            api_key = request.form.get('api_key', None)
        elif request.is_json:
            data = request.get_json()
            text = data.get('text', '')
            filename = data.get('filename', 'Text Document')
            summary_type = data.get('summary_type', 'executive')
            length = data.get('length', 'standard')
            focus_keyword = data.get('focus_keyword', None)
            api_key = data.get('api_key', None)
        else:
            return jsonify({"success": False, "message": "Invalid request format."}), 400

        if not text.strip():
            return jsonify({"success": False, "message": "Text content is empty."}), 400

        orig_words = len(text.split())
        orig_read_time = max(1, math.ceil(orig_words / 200))
        
        # Map length to compression ratio
        ratio_map = {'concise': 0.15, 'standard': 0.30, 'detailed': 0.50}
        ratio = ratio_map.get(length, 0.30)
        
        # Attempt OpenAI if key provided
        openai_result = None
        if api_key and HAS_OPENAI:
            try:
                openai_result = summarize_with_openai(text, api_key, summary_type, length)
            except Exception as err:
                print(f"OpenAI fallback error: {err}")
                
        # Primary NLP Summarization
        res = summarize_text_offline(text, summary_type, ratio, focus_keyword)
        
        sum_words = len(res['summaryText'].split())
        sum_read_time = max(1, math.ceil(sum_words / 200))
        time_saved_percent = round((1 - (sum_words / orig_words if orig_words > 0 else 1)) * 100, 1)
        
        keywords = extract_keywords(text, top_n=10)
        sentiment_data = analyze_sentiment(text)
        
        return jsonify({
            "success": True,
            "filename": filename,
            "summaryType": summary_type,
            "summaryLength": length,
            "summaryText": res['summaryText'],
            "bulletPoints": res['bulletPoints'],
            "keyInsights": res['keyInsights'],
            "keywords": keywords,
            "sentiment": sentiment_data,
            "stats": {
                "originalWordCount": orig_words,
                "summaryWordCount": sum_words,
                "originalReadTimeMins": orig_read_time,
                "summaryReadTimeMins": sum_read_time,
                "timeSavedPercent": max(0, time_saved_percent)
            },
            "usedAI": openai_result is not None
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/export-txt', methods=['POST'])
def export_txt():
    try:
        data = request.get_json()
        filename = data.get('filename', 'Summary')
        summary_text = data.get('summaryText', '')
        bullet_points = data.get('bulletPoints', [])
        key_insights = data.get('keyInsights', [])
        
        export_content = f"===========================================\n"
        export_content += f" AI DOCUMENT SUMMARIZER REPORT\n"
        export_content += f" Document: {filename}\n"
        export_content += f"===========================================\n\n"
        
        export_content += "--- EXECUTIVE SUMMARY ---\n"
        export_content += summary_text + "\n\n"
        
        if bullet_points:
            export_content += "--- KEY BULLET POINTS ---\n"
            for bp in bullet_points:
                export_content += f"{bp}\n"
            export_content += "\n"
            
        if key_insights:
            export_content += "--- CORE TAKEAWAYS ---\n"
            for ki in key_insights:
                export_content += f"• {ki}\n"
            export_content += "\n"
            
        buf = io.BytesIO()
        buf.write(export_content.encode('utf-8'))
        buf.seek(0)
        
        return send_file(
            buf,
            as_attachment=True,
            download_name=f"{filename}_Summary.txt",
            mimetype='text/plain'
        )
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"AI Document Summarizer Backend Server running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
