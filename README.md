## No AI LinkedIn Feed – Chrome Extension

Detect and hide AI-generated posts in your LinkedIn feed using OpenAI, Anthropic, Gemini, or a locally hosted LLM, with full control over sensitivity and debug/test behavior.

---

### Features

- **Automatic detection on LinkedIn feed**
  - Scans posts inside `span[data-testid="expandable-text-box"]`.
  - Sends the post text to a detection backend (OpenAI, Anthropic, Gemini, or local LLM).
  - Receives an AI score between 0–100.

- **Configurable threshold (1–100)**
  - Only posts with `AI score ≥ threshold` are treated as “AI-written”.

- **Four detection providers**
  - **OpenAI API** – use OpenAI’s hosted model (default).
  - **Anthropic API** – use Claude models with your Anthropic key.
  - **Google Gemini API** – use Gemini models with your Google AI key.
  - **Local LLM (REST API)** – send posts to your own local/self‑hosted model. For a quick example implementation, check `llm_server` and the `server.md` within.

- **Test mode**
  - Shows AI scores for all posts.
  - Keeps the original LinkedIn DOM intact (including “… more” expansion).
  - Great for tuning your threshold and testing model behavior.

- **Graceful local LLM failure handling**
  - If the local endpoint doesn’t respond within **5 seconds**, the post remains untouched and a small label says:
    `Local LLM not reachable`.

---

## Repo structure

Key files in this repo:

- `manifest.json` – Chrome Manifest V3, wires everything together.
- `background.js` – service worker:
  - Loads settings from `chrome.storage.sync`.
  - Calls OpenAI, Anthropic, Gemini, **or** your local LLM.
  - Returns the AI score (0–100), threshold, test mode, and local LLM timeout flag.
- `contentScript.js` – runs on `linkedin.com`:
  - Finds post spans.
  - Asks the background script for a score.
  - Applies hiding/labeling logic based on your settings.
- `options.html` + `options.js` – options page:
  - Choose provider (OpenAI / Anthropic / Gemini / Local LLM).
  - Configure provider API key/model (including custom model IDs for Anthropic and Gemini) or local endpoint.
  - Set threshold and test mode.

---

## Installing the extension (Chrome)

1. **Clone the repo**

   ```bash
   git clone https://github.com/pkarstaedt/linkedin-ai-filter.git
   cd linkedin-ai-filter
   ```

2. **Open Chrome extensions page**

   - Go to `chrome://extensions` in the address bar.
   - Turn on **Developer mode** (top-right toggle).

3. **Load the unpacked extension**

   - Click **“Load unpacked”**.
   - Select the folder containing this repo (e.g. `linkedin-ai-filter`).

4. **Verify installation**

   - You should see “No AI LinkedIn Feed” in the list of extensions.
   - Click **Details** → ensure “Allow in incognito” / “Site access” are set as you prefer.

---

## Configuration

### 1. Open the options page

From `chrome://extensions`:

- Find **No AI LinkedIn Feed** → click **Details**.
- Click **Extension options**.

You’ll see:

- **Detection provider** (dropdown)
- **OpenAI, Anthropic, Gemini, or Local LLM settings**
- **Comfort threshold (1–100)**
- **Test mode** (checkbox)

---

### 2. Detection provider

#### Option A – OpenAI API

1. **Select provider**

   - Set **Detection provider** to **OpenAI API**.
   - The OpenAI section will be visible; Local LLM config will be hidden.

2. **OpenAI API key**

   - Enter your OpenAI API key into the **OpenAI API key** field (`sk-...`).
   - This key is stored only in your browser’s extension storage and used solely for scoring LinkedIn posts.

3. **Model and scoring**

   - `background.js` uses `gpt-4o-mini` with a system prompt that instructs the model to:
     - Return **only** an integer between 0 and 100.
     - Use 0 for “definitely human”, 100 for “definitely AI-assisted”.

> Once saved, every LinkedIn post will be sent to OpenAI for a score when needed.

---

#### Option B – Local LLM (custom REST API)

1. **Select provider**

   - Set **Detection provider** to **Local LLM (custom REST API)**.
   - The OpenAI section will hide, and the **Local LLM** section will show.

2. **Local LLM API URL**

   - Set **Local LLM API URL**, for example:

   ```text
   http://localhost:8000/score-linkedin-post
   ```

3. **Request headers (JSON)**

   - Provide a JSON object of headers, e.g.:

   ```json
   {"x-api-key": "place your api key here"}
   ```

   - This is parsed as JSON in `background.js` and merged with `Content-Type: application/json`.

4. **Request body template (JSON)**

   - Default template:

   ```json
   {
     "linkedin_post_text" : %post_test%
   }
   ```

   - `%post_test%` is replaced with the **JSON-encoded post text** when sending the request.
   - Example actual request body:

   ```json
   {
     "linkedin_post_text": "This is the content of a LinkedIn post..."
   }
   ```

5. **HTTP method and response contract**

   - The extension sends a **POST** request to your `Local LLM API URL`:
     - Method: `POST`
     - Headers: `Content-Type: application/json` plus any custom headers you configured.
     - Body: the JSON built from your body template (with `%post_test%` substituted).
   - Your local endpoint must reply with JSON:

   ```json
   {
     "linkedin_post_ai_score": 73
   }
   ```

   - `linkedin_post_ai_score` must be an integer from **0 to 100**.
   - The extension clamps values to `[0, 100]`.

6. **Timeout behavior (5 seconds)**

   - For local LLM calls, the extension uses a 5-second timeout.
   - If the request times out or the endpoint isn’t reachable in time:
     - The post is **not hidden**.
     - A small label appears above the post:  
       `Local LLM not reachable`.

---

### 3. Comfort threshold (1–100)

- Field: **Comfort threshold (1–100)**.
- Semantics:
  - Let `T` be your threshold, `S` be the AI score for a post.
  - If `S ≥ T`, the post is considered “AI-written / AI-assisted”.

Examples:

- `T = 30`: very sensitive – many posts will be flagged.
- `T = 80`: strict – only highly likely AI posts get flagged.

---

### 4. Test mode

- Field: **Test mode** (checkbox).
- Behavior:

**When Test mode is ON:**

- For posts where `score ≥ threshold`:
  - A small label is inserted **above** the post:
    - `This post was detected as being written with AI. (score: XX/100)`
  - The actual LinkedIn post text and “… more” are **preserved and fully interactive**.

- For posts where `score < threshold`:
  - A label is shown above the post:
    - `(AI score: XX)`

- For local LLM timeouts:
  - A label is shown above the post:
    - `Local LLM not reachable`
  - The post itself is not modified.

**When Test mode is OFF:**

- For `score ≥ threshold`:
  - The extension **replaces the span text** with:
    - `This post was detected as being written with AI. (score: XX/100)`
- For `score < threshold`:
  - The post is left unchanged.
- For local LLM timeouts:
  - Same as in test mode: only the label `Local LLM not reachable` is added; post content is preserved.

---

## How it works under the hood

1. **Content script (`contentScript.js`)**
   - Runs on `https://www.linkedin.com/*` as defined in `manifest.json`.
   - Watches the DOM using a `MutationObserver`.
   - For each `span[data-testid="expandable-text-box"]`:
     - Reads the text.
     - Sends `{ type: "EVALUATE_POST_TEXT", text }` to the background script.

2. **Background script (`background.js`)**
   - Reads settings via `getSettings()`:
     - Provider type (`openai` or `local`).
     - OpenAI API key, or local LLM URL/headers/body template.
     - Threshold and test mode.
   - Calls `getAiScore()` to:
     - Either call OpenAI’s Chat Completions API.
     - Or call your local LLM REST endpoint with the templated JSON body via `POST`.
   - Returns:
     - `score` (0–100, or `null` on failure).
     - `threshold`.
     - `testMode`.
     - `timeoutLocalLlm` flag.

3. **Content script decision**
   - Uses the returned `score`, `threshold`, `testMode`, and `timeoutLocalLlm` to:
     - Insert labels above posts (test mode, scores, local LLM not reachable).
     - Or replace the post’s span text entirely (non-test mode, above threshold).
   - Uses a small helper `addOrUpdateLabel()` to avoid breaking LinkedIn’s internal event handlers.

---

## Activating and using on LinkedIn

1. Ensure the extension is **loaded** and **enabled** in `chrome://extensions`.
2. Configure options as described above.
3. Open or refresh a `https://www.linkedin.com/` tab.
4. Scroll your feed:
   - With OpenAI or a responsive local LLM:
     - Posts will gradually get annotated/scored and, when applicable, hidden/re-labeled.
   - With local LLM unreachable:
     - You’ll see `Local LLM not reachable` labels, but posts stay visible.

---

## Notes & limitations

- The extension relies on LinkedIn’s current DOM structure (`span[data-testid="expandable-text-box"]`); if LinkedIn changes this, selectors may need to be updated.
- Local LLM calls are made with a **POST** request carrying a JSON body. Ensure your server expects JSON POST requests at the configured URL.
- OpenAI usage will incur API costs based on your account and usage.

