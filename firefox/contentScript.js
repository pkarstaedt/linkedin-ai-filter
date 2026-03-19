// Content script for No AI LinkedIn Feed
// Scans LinkedIn posts and asks background script to evaluate AI-likelihood.

const POST_SPAN_SELECTOR = 'span[data-testid="expandable-text-box"]';
const REPLACEMENT_TEXT = "This post was detected as being written with AI.";
const LOCAL_LLM_TIMEOUT_SECONDS = 60;

// Track per-span countdown timers while waiting for local LLM responses.
const countdowns = new WeakMap();

/**
 * Insert or update a small label element before the post span.
 * Used in test mode so we don't break LinkedIn's internal DOM/events.
 * @param {HTMLElement} span
 * @param {string} labelText
 */
function addOrUpdateLabel(span, labelText) {
  const parent = span.parentNode;
  if (!parent || !(parent instanceof HTMLElement)) return;

  let label = span.previousSibling;
  if (!(label instanceof HTMLElement) || !label.classList.contains("no-ai-linkedin-label")) {
    label = document.createElement("div");
    label.className = "no-ai-linkedin-label";
    label.style.fontSize = "12px";
    label.style.color = "#666666";
    label.style.marginBottom = "2px";
    parent.insertBefore(label, span);
  }
  label.textContent = labelText;
}

function startLocalLlmCountdown(span) {
  // Clear any existing countdown for this span
  stopLocalLlmCountdown(span);

  let remaining = LOCAL_LLM_TIMEOUT_SECONDS;
  addOrUpdateLabel(span, `Waiting for local LLM... ${remaining}s`);

  const intervalId = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      addOrUpdateLabel(span, "Waiting for local LLM... 0s");
      stopLocalLlmCountdown(span);
      return;
    }
    addOrUpdateLabel(span, `Waiting for local LLM... ${remaining}s`);
  }, 1000);

  countdowns.set(span, intervalId);
}

function stopLocalLlmCountdown(span) {
  const intervalId = countdowns.get(span);
  if (intervalId != null) {
    clearInterval(intervalId);
    countdowns.delete(span);
  }
}

/**
 * Check a single span element, query background for AI score,
 * and replace/annotate contents based on user settings.
 * @param {HTMLSpanElement} span
 */
function evaluateAndMaybeReplace(span) {
  if (!span || span.dataset.noAiLinkedinProcessed === "1") return;

  const text = span.innerText?.trim();
  if (!text) {
    span.dataset.noAiLinkedinProcessed = "1";
    return;
  }

  span.dataset.noAiLinkedinProcessed = "1";

  // For local LLM in test mode, show a countdown while we wait.
  chrome.storage.sync.get(
    {
      providerType: "openai",
      testMode: false
    },
    (settings) => {
      const providerType = settings.providerType || "openai";
      const testModeFromStorage = Boolean(settings.testMode);

      if (providerType === "local" && testModeFromStorage) {
        startLocalLlmCountdown(span);
      }

      chrome.runtime.sendMessage(
        {
          type: "EVALUATE_POST_TEXT",
          text
        },
        (response) => {
          if (!response) {
            stopLocalLlmCountdown(span);
            return;
          }

          stopLocalLlmCountdown(span);

          const { score, threshold, testMode, timeoutLocalLlm, disabled } =
            response;

          if (disabled) {
            // Extension is globally disabled: do nothing to the post.
            return;
          }

          if (timeoutLocalLlm || typeof score !== "number") {
            // Any error in getting an AI score: keep the post as-is,
            // but prepend a short message for visibility.
            addOrUpdateLabel(span, "(AI Score: no answer)");
            return;
          }

          // Threshold is 1–100 and is compared directly to the AI score.
          const cutoff = Math.min(Math.max(threshold, 1), 100);
          const isAboveThreshold = score >= cutoff;

          if (testMode) {
            if (isAboveThreshold) {
              // Above threshold in test mode: show detection message + score,
              // but keep original DOM so "... more" etc. still work.
              addOrUpdateLabel(
                span,
                `${REPLACEMENT_TEXT} (score: ${score}/100)`
              );
            } else {
              // Below threshold in test mode: just show the score before the original text.
              addOrUpdateLabel(span, `(AI score: ${score})`);
            }
          } else if (isAboveThreshold) {
            // Non-test mode: fully replace text when above threshold,
            // but also show the numeric AI score.
            span.textContent = `${REPLACEMENT_TEXT} (score: ${score}/100)`;
          }
        }
      );
    }
  );
}

/**
 * Scan the DOM for all relevant span elements.
 */
function scanExistingPosts() {
  const spans = document.querySelectorAll(POST_SPAN_SELECTOR);
  spans.forEach((span) => {
    evaluateAndMaybeReplace(span);
  });
}

/**
 * Observe DOM mutations to catch new posts as the user scrolls.
 */
function watchForNewPosts() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches && node.matches(POST_SPAN_SELECTOR)) {
            evaluateAndMaybeReplace(node);
          }
          const innerSpans = node.querySelectorAll
            ? node.querySelectorAll(POST_SPAN_SELECTOR)
            : [];
          innerSpans.forEach((span) => evaluateAndMaybeReplace(span));
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initial run and observer setup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    scanExistingPosts();
    watchForNewPosts();
  });
} else {
  scanExistingPosts();
  watchForNewPosts();
}

