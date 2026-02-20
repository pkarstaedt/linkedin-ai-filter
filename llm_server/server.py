# Flask server to host a local LLM for the 'No AI LinkedIn' Chrome extension.
#
# This server loads a quantized GGUF model and provides an endpoint to score
# LinkedIn posts for AI-generated content.
#
# --- SETUP ---
# 1. Install dependencies:
#    pip install -r requirements.txt
#
# 2. Download the LLM model:
#    This server is designed to run with a 4-bit quantized model to fit within 8GB of VRAM.
#    We recommend 'The Bloke/Mistral-7B-Instruct-v0.2-GGUF'.
#
#    - Go to: https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF
#    - Download the 'mistral-7b-instruct-v0.2.Q4_K_M.gguf' file.
#    - Create a 'models' folder inside this 'llm_server' directory.
#    - Place the downloaded .gguf file into the 'llm_server/models/' directory.
#    - The final path should be: 'llm_server/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf'
#
# 3. Run the server:
#    python server.py
#
# The server will start on http://localhost:8000.
# -----------------------------------------------------------------------------

import os
import re
from flask import Flask, request, jsonify
from ctransformers import AutoModelForCausalLM
from flask_cors import CORS

# --- Configuration ---
# Path to the GGUF model file.
# Make sure this path is correct based on the setup instructions above.
MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "models", "mistral-7b-instruct-v0.2.Q4_K_M.gguf"
)

# System prompt for the AI content detector.
# This instructs the model on how to behave.
SYSTEM_PROMPT = "You are an AI content detector. Given the text of a LinkedIn post, output ONLY a single integer between 0 and 100 (no other text), where 0 means you are certain it was written by a human without AI assistance, and 100 means you are certain it was written by or heavily assisted by AI. Use the entire range between 0 and 100 to be as accurate as possible and to express your level of confidence."

# --- Flask App Initialization ---
app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- LLM Loading ---
# Load the model into memory.
# This can take a few minutes and will consume VRAM/RAM.
if not os.path.exists(MODEL_PATH):
    print("-" * 80)
    print("!!! MODEL FILE NOT FOUND !!!")
    print(f"Error: Model not found at path: {MODEL_PATH}")
    print("Please follow the setup instructions in the 'server.py' file to download it.")
    print("-" * 80)
    llm = None
else:
    print("Loading LLM model... This may take a moment.")
    # Load the model using ctransformers.
    # gpu_layers=50 means it will try to offload all layers to the GPU.
    llm = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        model_type="mistral",
        gpu_layers=50,
        context_length=2048
    )
    print("LLM model loaded successfully.")

# --- Flask Routes ---
@app.route('/score-linkedin-post', methods=['POST'])
def score_post():
    """
    Endpoint to receive post text and return an AI score.
    """
    if llm is None:
        return jsonify({"error": "LLM model not loaded. Please check server setup."}), 500

    # Get data from the request
    data = request.get_json()
    if not data or 'linkedin_post_text' not in data:
        return jsonify({"error": "Request body must be JSON with 'linkedin_post_text' key."}), 400

    post_text = data['linkedin_post_text']
    if not post_text.strip():
        return jsonify({"linkedin_post_ai_score": 0})

    print("-" * 80)
    print("Received post for analysis:")
    print(post_text)
    print("-" * 80)

    # Prepare the prompt for the LLM
    # The [INST] and [/INST] tags are specific to Mistral Instruct models.
    prompt = f"[INST] {SYSTEM_PROMPT}\n\nPost text:\n\n{post_text}\n\nRemember: reply with only a number between 0 and 100. [/INST]"

    # Call the LLM
    raw_response = llm(
        prompt,
        max_new_tokens=100,  # A number between 0-100 is short
        temperature=0.7 # We want deterministic output
        #temperature=0.0 # We want deterministic output
    )

    print(f"LLM raw response: '{raw_response}'")

    # --- Parse the LLM's response ---
    # The model should return just a number, but we'll be robust.
    # Find the first integer in the response string.
    score = 0
    match = re.search(r'\d+', raw_response)
    if match:
        score = int(match.group(0))
        # Clamp the score to the 0-100 range.
        if score < 0:
            score = 0
        if score > 100:
            score = 100
        print(f"Parsed score: {score}")
    else:
        print("Warning: Could not parse a number from LLM response. Defaulting to score 0.")

    # Prepare and send the JSON response
    response_data = {"linkedin_post_ai_score": score}
    print("Sending response:", response_data)
    print("-" * 80)

    return jsonify(response_data)

@app.route('/', methods=['GET'])
def health_check():
    """
    A simple health check endpoint to verify the server is running.
    """
    if llm:
        return "LLM server is running."
    else:
        return "LLM server is starting, but the model is not loaded. Check logs for errors.", 503


# --- Main Execution ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make the server accessible from the local network.
    # The Chrome extension will call this from localhost.
    app.run(host='0.0.0.0', port=8000)

