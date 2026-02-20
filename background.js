// Background service worker for No AI LinkedIn Feed
// Handles OpenAI API calls and communication with content scripts.

const OPENAI_API_BASE = "https://api.openai.com/v1/chat/completions";

/**
 * Fetch detection settings from storage.
 * Threshold is a value between 1 and 100, compared directly to the AI score.
 * providerType: "openai" | "local"
 * @returns {Promise<{
 *   apiKey: string | null,
 *   openaiModel: string,
 *   threshold: number,
   *   testMode: boolean,
 *   providerType: string,
 *   localLlmUrl: string,
 *   localLlmHeaders: string,
 *   localLlmBodyTemplate: string,
 *   enabled: boolean
 * }>}
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        openaiApiKey: null,
        openaiModel: "gpt-4o-mini",
        comfortThreshold: 50, // default comfort level (1-100)
        testMode: false,
        providerType: "openai",
        localLlmUrl: "",
        localLlmHeaders: '{"x-api-key": "place your api key here"}',
        localLlmBodyTemplate:
          '{\n  "linkedin_post_text" : %post_test%\n}',
        enabled: true
      },
      (items) => {
        resolve({
          apiKey: items.openaiApiKey,
          openaiModel: items.openaiModel || "gpt-4o-mini",
          threshold: Number(items.comfortThreshold) || 50,
          testMode: Boolean(items.testMode),
          providerType: items.providerType || "openai",
          localLlmUrl: items.localLlmUrl || "",
          localLlmHeaders:
            items.localLlmHeaders ||
            '{"x-api-key": "place your api key here"}',
          localLlmBodyTemplate:
            items.localLlmBodyTemplate ||
            '{\n  "linkedin_post_text" : %post_test%\n}',
          enabled: items.enabled !== false
        });
      }
    );
  });
}

/**
 * Call the selected provider (OpenAI or local LLM) to get an AI-likelihood score from 0–100.
 * Returns { score, timeoutLocalLlm } where score may be null on error.
 * @param {string} text
 * @param {ReturnType<typeof getSettings>} rawSettingsPromise
 * @returns {Promise<{ score: number | null, timeoutLocalLlm: boolean }>}
 */
async function getAiScore(text, rawSettingsPromise) {
  const settings = await rawSettingsPromise;
  const {
    apiKey,
    openaiModel,
    providerType,
    localLlmUrl,
    localLlmHeaders,
    localLlmBodyTemplate,
    testMode
  } = settings;

  if (providerType === "local") {
    if (!localLlmUrl) {
      if (testMode) {
        console.warn("[No AI LinkedIn] Local LLM URL not set.");
      }
      return { score: null, timeoutLocalLlm: false };
    }

    let headerObj = {};
    if (localLlmHeaders) {
      try {
        headerObj = JSON.parse(localLlmHeaders);
      } catch (e) {
        if (testMode) {
          console.warn(
            "[No AI LinkedIn] Invalid local LLM headers JSON, using empty headers.",
            e
          );
        }
        headerObj = {};
      }
    }

    const headers = {
      "Content-Type": "application/json",
      ...headerObj
    };

    const template =
      localLlmBodyTemplate ||
      '{\n  "linkedin_post_text" : %post_test%\n}';

    let bodyString;
    try {
      // Replace placeholder with JSON-encoded text
      bodyString = template.replace(
        /%post_test%/g,
        JSON.stringify(text)
      );
    } catch (e) {
      if (testMode) {
        console.warn(
          "[No AI LinkedIn] Error applying local LLM body template, falling back to default payload.",
          e
        );
      }
      bodyString = JSON.stringify({ linkedin_post_text: text });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(localLlmUrl, {
        method: "POST",
        headers,
        body: bodyString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (testMode) {
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (_) {
            // ignore
          }
          console.error(
            "[No AI LinkedIn] Local LLM API error:",
            response.status,
            errorText
          );
        }
        return { score: null, timeoutLocalLlm: false };
      }

      const data = await response.json();
      const rawScore = data && data.linkedin_post_ai_score;
      let score = parseInt(rawScore, 10);
      if (Number.isNaN(score)) {
        if (testMode) {
          console.warn(
            "[No AI LinkedIn] Could not parse AI score from local LLM response:",
            data
          );
        }
        return { score: null, timeoutLocalLlm: false };
      }
      if (score < 0) score = 0;
      if (score > 100) score = 100;
      return { score, timeoutLocalLlm: false };
    } catch (err) {
      if (err && err.name === "AbortError") {
        if (testMode) {
          console.warn(
            "[No AI LinkedIn] Local LLM request timed out after 5 seconds."
          );
        }
        return { score: null, timeoutLocalLlm: true };
      }
      if (testMode) {
        console.error("[No AI LinkedIn] Error calling local LLM:", err);
      }
      return { score: null, timeoutLocalLlm: false };
    }
  }

  // Default: OpenAI provider
  if (!apiKey) {
    if (testMode) {
      console.warn("[No AI LinkedIn] OpenAI API key not set.");
    }
    return { score: null, timeoutLocalLlm: false };
  }

  const systemPrompt =
    "You are an AI content detector. Given the text of a LinkedIn post, output ONLY a single integer between 0 and 100 (no other text), where 0 means you are certain it was written by a human without AI assistance, and 100 means you are certain it was written by or heavily assisted by AI. Use the entire range between 0 and 100 to be as accurate as possible and to express your level of confidence.";

  try {
    const response = await fetch(OPENAI_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: openaiModel || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Post text:\n\n${text}\n\nRemember: reply with only a number between 0 and 100.`
          }
        ],
        temperature: 0
      })
    });

    if (!response.ok) {
      if (testMode) {
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (_) {
          // ignore
        }
        console.error(
          "[No AI LinkedIn] OpenAI API error:",
          response.status,
          errorText
        );
      }
      return { score: null, timeoutLocalLlm: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/(\d{1,3})/);
    if (!match) {
      if (testMode) {
        console.warn(
          "[No AI LinkedIn] Could not parse AI score from OpenAI response:",
          content
        );
      }
      return { score: null, timeoutLocalLlm: false };
    }
    let score = parseInt(match[1], 10);
    if (Number.isNaN(score)) return { score: null, timeoutLocalLlm: false };
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return { score, timeoutLocalLlm: false };
  } catch (err) {
    if (testMode) {
      console.error("[No AI LinkedIn] Error calling OpenAI:", err);
    }
    return { score: null, timeoutLocalLlm: false };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EVALUATE_POST_TEXT") {
    const { text } = message;
    (async () => {
      const settingsPromise = getSettings();
      const settings = await settingsPromise;
      const { enabled, threshold, testMode } = settings;

      if (!enabled) {
        sendResponse({
          disabled: true,
          score: null,
          threshold,
          testMode,
          timeoutLocalLlm: false
        });
        return;
      }

      const { score, timeoutLocalLlm } = await getAiScore(
        text,
        Promise.resolve(settings)
      );
      sendResponse({
        score,
        threshold,
        testMode,
        timeoutLocalLlm
      });
    })();
    // Keep the message channel open for async response
    return true;
  }
});

// Open options page when clicking the extension icon
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

