# Local LLM Server for "No AI LinkedIn" Extension

This document provides instructions for setting up and running the local Flask server that acts as a backend for the "No AI LinkedIn" Chrome extension.

## Table of Contents
1. [Purpose](#purpose)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
   - [1. Install Dependencies](#1-install-dependencies)
   - [2. Download the LLM Model](#2-download-the-llm-model)
4. [Running the Server](#running-the-server)
5. [How It Works](#how-it-works)
   - [The Model](#the-model)
   - [The API Endpoint](#the-api-endpoint)
   - [Console Output](#console-output)
6. [Customization](#customization)

---

### Purpose

The Flask server hosts a local Large Language Model (LLM) to provide AI content detection scores. The Chrome extension sends text from LinkedIn posts to this server, which analyzes the text and returns a score indicating the likelihood of it being AI-generated. This allows for content analysis without sending data to a third-party cloud service like OpenAI.

---

### Prerequisites

- **Python 3.8+**: Ensure you have Python installed on your system.
- **pip**: Python's package installer, which comes standard with Python.
- **Hardware**: A GPU with at least **8GB of VRAM** is recommended for optimal performance. The server can also run on the CPU, but it will be significantly slower.

---

### Setup Instructions

#### 1. Install Dependencies

The required Python packages are listed in the `requirements.txt` file. Navigate to the `llm_server` directory in your terminal and run the following command:

```bash
pip install -r requirements.txt
```
This will install `Flask` for the web server, `ctransformers` to run the quantized LLM, and `requests` for sending HTTP requests (used by the test script).

#### 2. Download the LLM Model

This server is optimized to use a quantized GGUF model, which is a compressed format that runs efficiently on consumer hardware.

1.  **Create a `models` directory**: Inside the `llm_server` directory, create a new folder named `models`.

2.  **Download the model file**: The recommended model is a 4-bit quantized version of Mistral-7B-Instruct.
    -   **Model**: `mistral-7b-instruct-v0.2.Q4_K_M.gguf`
    -   **Download Link**: [TheBloke/Mistral-7B-Instruct-v0.2-GGUF on Hugging Face](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF)
    -   Click the "Files and versions" tab on the Hugging Face page and download the file named `mistral-7b-instruct-v0.2.Q4_K_M.gguf`.

3.  **Place the model**: Move the downloaded `.gguf` file into the `llm_server/models/` directory you created.

The final file path should be `llm_server/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf`.

---

### Running the Server

Once the setup is complete, you can start the server by running the `server.py` script from within the `llm_server` directory:

```bash
python server.py
```

If the model is found and loaded correctly, you will see output indicating that the server is running, typically on `http://localhost:8000`.

```
Loading LLM model... This may take a moment.
LLM model loaded successfully.
 * Running on http://127.0.0.1:8000
 * Running on http://<your-local-ip>:8000
```

### Testing the Server

A utility script `test_server.py` has been provided to easily test the local LLM server's endpoint without needing the Chrome extension.

To run the test script:

1.  **Ensure the Flask server (`server.py`) is running** in a separate terminal.
2.  Open a new terminal, navigate to the `llm_server` directory.
3.  Run the test script:

    ```bash
    python test_server.py
    ```

The script will send a predefined test post to the server and print the server's response, including the parsed AI score.

**Customizing Test Text:**
You can modify the `TEST_POST_TEXT` variable within `test_server.py` to send different LinkedIn post texts to the server for analysis.

---

### How It Works

#### The Model

The server uses `ctransformers` to load `mistral-7b-instruct-v0.2.Q4_K_M.gguf`. This model was chosen because:
- **Performance**: It provides a great balance of text comprehension and instruction-following capabilities.
- **Efficiency**: The 4-bit quantization (`Q4_K_M`) reduces the model's size to ~4.4 GB, allowing it to fit comfortably within 8GB of VRAM while maintaining good accuracy.
- **Instruction-Tuned**: As an "instruct" model, it's fine-tuned to follow commands, making it ideal for the specific task of returning a numerical score.

#### The API Endpoint

The server exposes a single API endpoint that the Chrome extension communicates with.

- **URL**: `http://localhost:8000/score-linkedin-post`
- **Method**: `POST`
- **Request Body**: A JSON object containing the post text.

    ```json
    {
      "linkedin_post_text": "This is an insightful post about the future of AI..."
    }
    ```

- **Response Body**: A JSON object containing the calculated AI score.

    ```json
    {
      "linkedin_post_ai_score": 85
    }
    ```
    The score is an integer between 0 (human-written) and 100 (AI-written).

#### Console Output

The server is designed to be transparent. For every post it analyzes, it will print the following information to the console:
- The full text of the post received for analysis.
- The raw, unprocessed response from the LLM.
- The final integer score that was parsed from the response.
- The JSON object being sent back to the extension.

This is useful for debugging and observing the model's behavior.

#### CORS Configuration
The server has Cross-Origin Resource Sharing (CORS) enabled for all routes. This allows the Chrome extension, running in a different origin (e.g., `linkedin.com`), to make requests to this local server without being blocked by browser security policies.

---

### Customization

- **Changing the Model**: You can use a different GGUF model by downloading it, placing it in the `models` directory, and updating the `MODEL_PATH` variable at the top of `server.py`. Note that different models may require changes to the system prompt for best results.
- **Changing the Port**: To run the server on a different port, modify the last line of `server.py`:
  ```python
  # From:
  app.run(host='0.0.0.0', port=8000)

  # To (for example, port 5000):
  app.run(host='0.0.0.0', port=5000)
  ```
  Remember to also update the "Local LLM API URL" in the Chrome extension's options page if you change the port.
