document.getElementById("viewHistory").addEventListener("click", () => {
  window.location.href = "show.html";
});
let langConfig = {};

document
  .getElementById("configForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const syncUrl = document.getElementById("syncUrl").value;
    const syncToken = document.getElementById("syncToken").value;
    const top_p = parseFloat(document.getElementById("top_p").value);
    const top_k = parseInt(document.getElementById("top_k").value, 10);
    const customCSS = document.getElementById("customCSS").value;
    const language = document.getElementById("language").value;

    const apis = [];
    let defaultApiIndex = null;
    document.querySelectorAll(".apiConfig").forEach((config, index) => {
      apis.push({
        url: config.querySelector(`#apiUrl${index}`).value,
        key: config.querySelector(`#apiKey${index}`).value,
        model: config.querySelector(`#apiModel${index}`).value,
        maxTokens: parseInt(
          config.querySelector(`#apiMaxTokens${index}`).value,
          10,
        ),
      });

      if (config.querySelector(`#defaultApi${index}`).checked) {
        defaultApiIndex = index;
      }
    });

    const prompts = [];
    let defaultPromptIndex = null;
    document.querySelectorAll(".promptConfig").forEach((config, index) => {
      prompts.push(config.querySelector(`#promptText${index}`).value);

      if (config.querySelector(`#defaultPrompt${index}`).checked) {
        defaultPromptIndex = index;
      }
    });

    const configData = {
      syncUrl,
      syncToken,
      top_p,
      top_k,
      apis,
      defaultApiIndex,
      prompts,
      defaultPromptIndex,
      customCSS,
      language,
    };

    chrome.storage.local.set({ configData }, function () {
      document.getElementById("status").textContent = "Configuration saved!";
      setTimeout(() => {
        document.getElementById("status").textContent = "";
      }, 2000);
    });
  });

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get("configData", function (data) {
    if (data.configData) {
      const language = data.configData.language || "en";
      document.getElementById("language").value = language;
      changeLang(language);
      // changeLang(language);
      document.getElementById("syncUrl").value = data.configData.syncUrl || "";
      document.getElementById("syncToken").value =
        data.configData.syncToken || "";
      document.getElementById("top_p").value = data.configData.top_p || 0.1;
      document.getElementById("top_k").value = data.configData.top_k || 1;
      document.getElementById("customCSS").value = data.configData.customCSS;

      const apis = data.configData.apis || [];
      apis.forEach((api, index) => {
        addApiConfig(
          index,
          api.url,
          api.key,
          api.model,
          api.maxTokens,
          index === data.configData.defaultApiIndex,
        );
      });

      const prompts = data.configData.prompts || [];
      prompts.forEach((prompt, index) => {
        addPromptConfig(
          index,
          prompt,
          index === data.configData.defaultPromptIndex,
        );
      });
    }
  });

  document.getElementById("addApi").addEventListener("click", () => {
    const index = document.querySelectorAll(".apiConfig").length;
    addApiConfig(index);
  });

  document.getElementById("addPrompt").addEventListener("click", () => {
    const index = document.querySelectorAll(".promptConfig").length;
    addPromptConfig(index);
  });
});

document.getElementById("OutputConfig").addEventListener("click", () => {
  chrome.storage.local.get("configData", (data) => {
    if (data.configData) {
      const blob = new Blob([JSON.stringify(data.configData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "config.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  });
});

document.getElementById("importConfig").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const configData = JSON.parse(e.target.result);
          chrome.storage.local.set({ configData }, () => {
            // Reload configuration
            document.getElementById("language").value =
              configData.language || "en";
            document.getElementById("syncUrl").value = configData.syncUrl || "";
            document.getElementById("syncToken").value =
              configData.syncToken || "";
            document.getElementById("top_p").value = configData.top_p || 0.1;
            document.getElementById("top_k").value = configData.top_k || 1;
            document.getElementById("customCSS").value = configData.customCSS;

            // Clear existing configs
            document.getElementById("apiConfigs").innerHTML = "";
            document.getElementById("promptConfigs").innerHTML = "";

            const apis = configData.apis || [];
            apis.forEach((api, index) => {
              addApiConfig(
                index,
                api.url,
                api.key,
                api.model,
                api.maxTokens,
                index === configData.defaultApiIndex,
              );
            });

            const prompts = configData.prompts || [];
            prompts.forEach((prompt, index) => {
              addPromptConfig(
                index,
                prompt,
                index === configData.defaultPromptIndex,
              );
            });
            alert("Configuration imported successfully!");
          });
        } catch (error) {
          alert("Failed to import configuration. Invalid JSON.");
          console.error("Import error:", error);
        }
      };
      reader.readAsText(file);
    }
  });
  input.click();
});

function addApiConfig(
  index,
  url = "",
  key = "",
  model = "",
  maxTokens = 100,
  isDefault = false,
) {
  const container = document.createElement("div");
  container.className = "apiConfig mb-3";
  container.innerHTML = `
    <h4>API ${index + 1}</h4>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="defaultApi" id="defaultApi${index}" ${isDefault ? "checked" : ""}>
      <label class="form-check-label" for="defaultApi${index}">
      setDefaultAPI
      </label>
    </div>
    <div class="mb-3">
      <label for="apiUrl${index}" class="form-label">API Url:</label>
      <input type="text" id="apiUrl${index}" name="apiUrl" value="${url}" required class="form-control" />
    </div>
    <div class="row">
      <div class="mb-3 col-md-4">
        <label for="apiKey${index}" class="form-label">API Key:</label>
        <input type="text" id="apiKey${index}" name="apiKey" value="${key}" required class="form-control" />
      </div>
      <div class="mb-3 col-md-4">
        <label for="apiModel${index}" class="form-label">API Model:</label>
        <input type="text" id="apiModel${index}" name="apiModel" value="${model}" required class="form-control" />
      </div>
      <div class="mb-3 col-md-4">
        <label for="apiMaxTokens${index}" class="form-label">Max Tokens:</label>
        <input type="number" id="apiMaxTokens${index}" name="apiMaxTokens" value="${maxTokens}" required class="form-control" />
      </div>
    </div>
  `;
  document.getElementById("apiConfigs").appendChild(container);
}

function addPromptConfig(index, prompt = "", isDefault = false) {
  const container = document.createElement("div");
  container.className = "promptConfig mb-3";
  container.innerHTML = `
    <h4>Prompt ${index + 1}</h4>

    <div class="form-check ">
      <input class="form-check-input" type="radio" name="defaultPrompt" id="defaultPrompt${index}" ${isDefault ? "checked" : ""}>
      <label class="form-check-label" for="defaultPrompt${index}">
      setDefaultPrompt
      </label>
    </div>
    <div class="mb-3">
      <textarea id="promptText${index}" name="promptText" required class="form-control" rows="5">${prompt}</textarea>
    </div>
  `;
  document.getElementById("promptConfigs").appendChild(container);
}
