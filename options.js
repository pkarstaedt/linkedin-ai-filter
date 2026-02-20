// Options page logic for No AI LinkedIn Feed

function saveOptions() {
  const providerType =
    document.getElementById("providerType").value || "openai";
  const apiKey = document.getElementById("apiKey").value.trim();
  const openaiModel =
    document.getElementById("openaiModel").value.trim() || "gpt-4o-mini";
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
      openaiApiKey: apiKey || null,
      openaiModel,
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
      openaiModel: "gpt-4o-mini",
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
        items.openaiModel || "gpt-4o-mini";
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
  const localSettings = document.getElementById("localSettings");

  if (providerType === "local") {
    openaiSettings.style.display = "none";
    localSettings.style.display = "block";
  } else {
    openaiSettings.style.display = "block";
    localSettings.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restoreOptions();
  document
    .getElementById("providerType")
    .addEventListener("change", updateProviderVisibility);
});
document.getElementById("save").addEventListener("click", saveOptions);

