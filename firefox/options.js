// Options page logic for No AI LinkedIn Feed
const ANTHROPIC_MODELS = [
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-opus-4-6"
];

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite"
];

function updateCustomModelFieldVisibility(selectId, fieldId) {
  const select = document.getElementById(selectId);
  const field = document.getElementById(fieldId);
  field.style.display = select.value === "custom" ? "block" : "none";
}

function getSelectedModel(selectId, customInputId, fallbackModel) {
  const selected = document.getElementById(selectId).value.trim();
  if (selected !== "custom") {
    return selected || fallbackModel;
  }

  const customModel = document.getElementById(customInputId).value.trim();
  return customModel || fallbackModel;
}

function restoreModelSelection(
  selectId,
  customInputId,
  customFieldId,
  knownModels,
  restoredModel,
  fallbackModel
) {
  const model = restoredModel || fallbackModel;
  const select = document.getElementById(selectId);
  const customInput = document.getElementById(customInputId);

  if (knownModels.includes(model)) {
    select.value = model;
    customInput.value = "";
  } else {
    select.value = "custom";
    customInput.value = model;
  }

  updateCustomModelFieldVisibility(selectId, customFieldId);
}

function saveOptions() {
  const providerType =
    document.getElementById("providerType").value || "openai";
  const openaiApiKey = document.getElementById("apiKey").value.trim();
  const openaiModel =
    document.getElementById("openaiModel").value.trim() || "gpt-5-nano";
  const anthropicApiKey =
    document.getElementById("anthropicApiKey").value.trim();
  const anthropicModel = getSelectedModel(
    "anthropicModel",
    "anthropicCustomModel",
    "claude-sonnet-4-6"
  );
  const geminiApiKey =
    document.getElementById("geminiApiKey").value.trim();
  const geminiModel = getSelectedModel(
    "geminiModel",
    "geminiCustomModel",
    "gemini-2.5-flash"
  );
  let comfortThreshold = parseInt(
    document.getElementById("comfortThreshold").value,
    10
  );
  const testMode = document.getElementById("testMode").checked;
  const enabled = document.getElementById("enabledToggle").checked;
  const localLlmUrl = document.getElementById("localLlmUrl").value.trim();
  const localLlmHeaders =
    document.getElementById("localLlmHeaders").value.trim() ||
    '{"x-api-key": "place your api key here"}';
  const localLlmBodyTemplate =
    document.getElementById("localLlmBody").value.trim() ||
    '{\n  "linkedin_post_text" : %post_test%\n}';

  if (Number.isNaN(comfortThreshold)) {
    comfortThreshold = 50;
  }
  comfortThreshold = Math.min(Math.max(comfortThreshold, 1), 100);

  chrome.storage.sync.set(
    {
      openaiApiKey: openaiApiKey || null,
      openaiModel,
      anthropicApiKey: anthropicApiKey || null,
      anthropicModel,
      geminiApiKey: geminiApiKey || null,
      geminiModel,
      comfortThreshold,
      testMode,
      enabled,
      providerType,
      localLlmUrl,
      localLlmHeaders,
      localLlmBodyTemplate
    },
    () => {
      const status = document.getElementById("status");
      status.textContent = "Settings saved.";
      setTimeout(() => {
        status.textContent = "";
      }, 2500);
    }
  );
}

function restoreOptions() {
  chrome.storage.sync.get(
    {
      openaiApiKey: "",
      openaiModel: "gpt-5-nano",
      anthropicApiKey: "",
      anthropicModel: "claude-sonnet-4-6",
      geminiApiKey: "",
      geminiModel: "gemini-2.5-flash",
      comfortThreshold: 50,
      testMode: false,
      enabled: true,
      providerType: "openai",
      localLlmUrl: "",
      localLlmHeaders: '{"x-api-key": "place your api key here"}',
      localLlmBodyTemplate: '{\n  "linkedin_post_text" : %post_test%\n}'
    },
    (items) => {
      document.getElementById("providerType").value =
        items.providerType || "openai";
      document.getElementById("apiKey").value = items.openaiApiKey || "";
      document.getElementById("openaiModel").value =
        items.openaiModel || "gpt-5-nano";
      document.getElementById("anthropicApiKey").value =
        items.anthropicApiKey || "";
      document.getElementById("geminiApiKey").value =
        items.geminiApiKey || "";
      restoreModelSelection(
        "anthropicModel",
        "anthropicCustomModel",
        "anthropicCustomModelField",
        ANTHROPIC_MODELS,
        items.anthropicModel,
        "claude-sonnet-4-6"
      );
      restoreModelSelection(
        "geminiModel",
        "geminiCustomModel",
        "geminiCustomModelField",
        GEMINI_MODELS,
        items.geminiModel,
        "gemini-2.5-flash"
      );
      document.getElementById("comfortThreshold").value =
        Number(items.comfortThreshold) || 50;
      document.getElementById("testMode").checked = Boolean(items.testMode);
      document.getElementById("enabledToggle").checked =
        items.enabled !== false;
      document.getElementById("localLlmUrl").value = items.localLlmUrl || "";
      document.getElementById("localLlmHeaders").value =
        items.localLlmHeaders ||
        '{"x-api-key": "place your api key here"}';
      document.getElementById("localLlmBody").value =
        items.localLlmBodyTemplate ||
        '{\n  "linkedin_post_text" : %post_test%\n}';

      updateProviderVisibility();
    }
  );
}

function updateProviderVisibility() {
  const providerType =
    document.getElementById("providerType").value || "openai";
  const openaiSettings = document.getElementById("openaiSettings");
  const anthropicSettings = document.getElementById("anthropicSettings");
  const geminiSettings = document.getElementById("geminiSettings");
  const localSettings = document.getElementById("localSettings");

  openaiSettings.style.display = providerType === "openai" ? "block" : "none";
  anthropicSettings.style.display =
    providerType === "anthropic" ? "block" : "none";
  geminiSettings.style.display = providerType === "gemini" ? "block" : "none";
  localSettings.style.display = providerType === "local" ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  restoreOptions();
  document
    .getElementById("providerType")
    .addEventListener("change", updateProviderVisibility);
  document
    .getElementById("anthropicModel")
    .addEventListener("change", () =>
      updateCustomModelFieldVisibility(
        "anthropicModel",
        "anthropicCustomModelField"
      )
    );
  document
    .getElementById("geminiModel")
    .addEventListener("change", () =>
      updateCustomModelFieldVisibility("geminiModel", "geminiCustomModelField")
    );
});
document.getElementById("save").addEventListener("click", saveOptions);

