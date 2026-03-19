// Background service worker for No AI LinkedIn Feed
// Handles API calls and communication with content scripts.

const OPENAI_RESPONSES_API_BASE = "https://api.openai.com/v1/responses";
const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1/messages";
const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Fetch detection settings from storage.
 * Threshold is a value between 1 and 100, compared directly to the AI score.
 * providerType: "openai" | "anthropic" | "gemini" | "local"
 * @returns {Promise<{
 *   openaiApiKey: string | null,
 *   openaiModel: string,
 *   anthropicApiKey: string | null,
 *   anthropicModel: string,
 *   geminiApiKey: string | null,
 *   geminiModel: string,
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
        openaiModel: "gpt-5-nano",
        anthropicApiKey: null,
        anthropicModel: "claude-sonnet-4-6",
        geminiApiKey: null,
        geminiModel: "gemini-2.5-flash",
        comfortThreshold: 50, // default comfort level (1-100)
        testMode: false,
        providerType: "openai",
        localLlmUrl: "",
        localLlmHeaders: '{\n  "x-api-key": "place your api key here"\n}',
        localLlmBodyTemplate:
          '{\n  "linkedin_post_text" : %post_test%\n}',
        enabled: true
      },
      (items) => {
        resolve({
          openaiApiKey: items.openaiApiKey,
          openaiModel: items.openaiModel || "gpt-5-nano",
          anthropicApiKey: items.anthropicApiKey,
          anthropicModel: items.anthropicModel || "claude-sonnet-4-6",
          geminiApiKey: items.geminiApiKey,
          geminiModel: items.geminiModel || "gemini-2.5-flash",
          threshold: Number(items.comfortThreshold) || 50,
          testMode: Boolean(items.testMode),
          providerType: items.providerType || "openai",
          localLlmUrl: items.localLlmUrl || "",
          localLlmHeaders:
            items.localLlmHeaders ||
            '{\n  "x-api-key": "place your api key here"\n}',
          localLlmBodyTemplate:
            items.localLlmBodyTemplate ||
            '{\n  "linkedin_post_text" : %post_test%\n}',
          enabled: items.enabled !== false
        });
      }
    );
  });
}

function buildScoringPrompt(text) {
  return {
    system:
      "You are an AI content detector. Given the text of a LinkedIn post, output ONLY a single integer between 0 and 100 (no other text), where 0 means you are certain it was written by a human without AI assistance, and 100 means you are certain it was written by or heavily assisted by AI. Use the entire range between 0 and 100 to be as accurate as possible and to express your level of confidence.",
    user: `Post text:\n\n${text}\n\nRemember: reply with only a number between 0 and 100.`
  };
}

function normalizeScore(value) {
  const match = String(value ?? "").match(/(\d{1,3})/);
  if (!match) return null;

  let score = parseInt(match[1], 10);
  if (Number.isNaN(score)) return null;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

async function callOpenAiProvider(text, openaiApiKey, openaiModel, testMode) {
  if (!openaiApiKey) {
    if (testMode) {
      console.warn("[No AI LinkedIn] OpenAI API key not set.");
    }
    return null;
  }

  const prompt = buildScoringPrompt(text);

  const model = openaiModel || "gpt-5-nano";
  const endpoint = OPENAI_RESPONSES_API_BASE;
  const payload = {
    model,
    instructions: prompt.system,
    input: prompt.user
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(payload)
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
    return null;
  }

  const data = await response.json();
  const content = extractOpenAiContentText(data);
  const score = normalizeScore(content);
  if (score === null && testMode) {
    console.warn(
      "[No AI LinkedIn] Could not parse AI score from OpenAI response:",
      content
    );
  }

  return score;
}

function extractOpenAiContentText(data) {
  if (!data || typeof data !== "object") return "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const outputTextFromResponses = (data.output || [])
    .flatMap((item) => item?.content || [])
    .filter((part) => part && part.type === "output_text")
    .map((part) => part.text || "")
    .join(" ");
  if (outputTextFromResponses) {
    return outputTextFromResponses;
  }

  return "";
}

async function callAnthropicProvider(
  text,
  anthropicApiKey,
  anthropicModel,
  testMode
) {
  if (!anthropicApiKey) {
    if (testMode) {
      console.warn("[No AI LinkedIn] Anthropic API key not set.");
    }
    return null;
  }

  const prompt = buildScoringPrompt(text);

  const response = await fetch(ANTHROPIC_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: anthropicModel || "claude-sonnet-4-6",
      max_tokens: 10,
      temperature: 0,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }]
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
        "[No AI LinkedIn] Anthropic API error:",
        response.status,
        errorText
      );
    }
    return null;
  }

  const data = await response.json();
  const contentBlocks = data.content || [];
  const content = contentBlocks
    .filter((block) => block && block.type === "text")
    .map((block) => block.text || "")
    .join(" ");
  const score = normalizeScore(content);

  if (score === null && testMode) {
    console.warn(
      "[No AI LinkedIn] Could not parse AI score from Anthropic response:",
      data
    );
  }

  return score;
}

async function callGeminiProvider(text, geminiApiKey, geminiModel, testMode) {
  if (!geminiApiKey) {
    if (testMode) {
      console.warn("[No AI LinkedIn] Gemini API key not set.");
    }
    return null;
  }

  const prompt = buildScoringPrompt(text);
  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(
    geminiModel || "gemini-2.5-flash"
  )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt.system}\n\n${prompt.user}` }]
        }
      ],
      generationConfig: {
        temperature: 0
      }
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
        "[No AI LinkedIn] Gemini API error:",
        response.status,
        errorText
      );
    }
    return null;
  }

  const data = await response.json();
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join(" ") || "";
  const score = normalizeScore(content);

  if (score === null && testMode) {
    console.warn(
      "[No AI LinkedIn] Could not parse AI score from Gemini response:",
      data
    );
  }

  return score;
}

/**
 * Call the selected provider to get an AI-likelihood score from 0-100.
 * Returns { score, timeoutLocalLlm } where score may be null on error.
 * @param {string} text
 * @param {ReturnType<typeof getSettings>} rawSettingsPromise
 * @returns {Promise<{ score: number | null, timeoutLocalLlm: boolean }>}
 */
async function getAiScore(text, rawSettingsPromise) {
  const settings = await rawSettingsPromise;
  const {
    openaiApiKey,
    openaiModel,
    anthropicApiKey,
    anthropicModel,
    geminiApiKey,
    geminiModel,
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
      bodyString = template.replace(/%post_test%/g, JSON.stringify(text));
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
      const score = normalizeScore(rawScore);
      if (score === null) {
        if (testMode) {
          console.warn(
            "[No AI LinkedIn] Could not parse AI score from local LLM response:",
            data
          );
        }
        return { score: null, timeoutLocalLlm: false };
      }
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

  try {
    if (providerType === "anthropic") {
      const score = await callAnthropicProvider(
        text,
        anthropicApiKey,
        anthropicModel,
        testMode
      );
      return { score, timeoutLocalLlm: false };
    }

    if (providerType === "gemini") {
      const score = await callGeminiProvider(
        text,
        geminiApiKey,
        geminiModel,
        testMode
      );
      return { score, timeoutLocalLlm: false };
    }

    const score = await callOpenAiProvider(
      text,
      openaiApiKey,
      openaiModel,
      testMode
    );
    return { score, timeoutLocalLlm: false };
  } catch (err) {
    if (testMode) {
      console.error("[No AI LinkedIn] Error calling hosted AI provider:", err);
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
