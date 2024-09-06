// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   chrome.tabs.get(tabId, (tabDetails) => {
//     console.log("inject update first", tabDetails, tab);
//   });

//   // Ensure the tab has a valid URL and is not a chrome:// or extension page
//   if (
//     tab.url &&
//     !tab.url.startsWith("vivaldi://") &&
//     !tab.url.startsWith("chrome://") &&
//     !tab.url.startsWith("chrome-extension://")
//   ) {
//     console.log("inject update", tab.url);

//     chrome.storage.local.get("configData", (data) => {
//       console.log("get data", tab.url);

//       // Inject CSS as soon as possible, without waiting for the "complete" status
//       chrome.scripting
//         .insertCSS({
//           target: { tabId: tabId },
//           css:
//             data.configData?.customCSS ||
//             `
//             ._1vKLg,
//             ._1Kia5,
//             .gp2k11k,
//             .FYB_RD,
//             .s-mancacrd-main {
//               display: none;
//               background-color: #ffcccc;
//             }
//             .translated-text {
//               color: #444444;
//             }`,
//         })
//         .then(() => {
//           console.log("CSS injected successfully.", tab.url);
//         })
//         .catch((error) => {
//           console.error("Error injecting CSS:", tab.url, error);
//         });
//     });
//   }
// });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    tab.url &&
    !tab.url.startsWith("vivaldi://") &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    if (changeInfo.status === "complete") {
      chrome.storage.local.get("configData", (data) => {
        // console.log("get data", tab.url);

        chrome.scripting
          .insertCSS({
            target: { tabId: tabId },
            css:
              data.configData.customCSS ||
              `
            ._1vKLg,
            ._1Kia5,
      .gp2k11k,
      .FYB_RD,
      .s-mancacrd-main{
        display: none;
        background-color: #ffcccc;
      }
      .translated-text {
        color: #444444;
      }`,
          })
          .then(() => {
            console.log("CSS injected successfully.", tab.url);
          })
          .catch((error) => {
            console.error("Error injecting CSS1:", tab.url, error);
          });
      });
    }
  }
});
// 监听命令执行，进行翻译
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;

    chrome.storage.local.get("configData", (data) => {
      const configData = data.configData;
      let apiConfig = null;

      // 判断命令，选择对应的API配置
      if (command === "translate_with_api") {
        apiConfig = configData.apis[configData.defaultApiIndex || 0]; // 使用默认的API
      }

      if (apiConfig) {
        apiConfig.top_p = configData.top_p;
        apiConfig.top_k = configData.top_k;

        // 使用默认的Prompt配置
        const defaultPrompt =
          configData.prompts[configData.defaultPromptIndex || 0];

        if (tabId !== undefined) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: translateOrToggleTranslation,
            args: [apiConfig, defaultPrompt],
          });
        } else {
          console.error("Invalid tabId:", tabId);
        }
      } else {
        console.error("API configuration not found for command:", command);
      }
    });
  });
});

// 执行翻译或切换翻译结果的显示
function translateOrToggleTranslation(config, promptTemplate) {
  let selectedText = window.getSelection().toString().trim();
  let node = null;

  if (selectedText === "") {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      node = range.startContainer;
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode;
      }
    }

    if (node) {
      selectedText = node.innerHTML.trim();
    } else {
      console.error("No suitable container node found.");
      return;
    }
  }

  if (selectedText !== "") {
    chrome.storage.local.get({ translationHistory: [] }, (result) => {
      const history = result.translationHistory;
      const cachedEntry = history.find(
        (entry) => entry.original === selectedText,
      );

      if (cachedEntry) {
        // If cached, show the cached translation
        if (node) {
          node.setAttribute("data-translated", "true");
          node.innerHTML += `<p class="translated-text">${cachedEntry.translated}</p>`;
        }
        return; // No need to make a request
      } else {
        if (node && node.hasAttribute("data-translated")) {
          const translatedElement = node.querySelector(".translated-text");
          if (translatedElement) {
            translatedElement.classList.toggle("hidden");
          }
        } else {
          const loadingImg = document.createElement("div");

          loadingImg.className = "loading-spinner";
          node.appendChild(loadingImg);

          const prompt = promptTemplate.replace(
            "{{selectedText}}",
            selectedText,
          );
          fetch(config.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.key}`,
            },
            body: JSON.stringify({
              messages: [{ role: "user", content: prompt }],
              max_tokens: config.maxTokens || 4096,
              top_p: config.top_p || 0.01,
              model: config.model,
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              const translatedText =
                data.choices[0].message.content
                  .replaceAll("```html", "")
                  .replaceAll("```", "") || "Translation failed.";
              loadingImg.remove();

              if (node) {
                node.setAttribute("data-translated", "true");
                node.innerHTML += `<p class="translated-text">${translatedText}</p>`;

                chrome.runtime.sendMessage({
                  type: "saveTranslation",
                  originalText: selectedText,
                  translatedText: translatedText,
                });
              } else {
                console.error("No container node found to replace text.");
              }
            })
            .catch((error) => {
              console.error("Error:", error);
              loadingImg.remove();
              if (node) {
                node.innerHTML += `<p class="translated-text">Translation failed.</p>`;
              }
            });
        }
      }
    });
  }
}

function saveTranslationResult(originalText, translatedText) {
  chrome.storage.local.get({ translationHistory: [] }, (result) => {
    const history = result.translationHistory;
    history.push({
      original: originalText,
      translated: translatedText,
      date: new Date().toLocaleString(),
    });
    chrome.storage.local.set({ translationHistory: history }, () => {
      console.log("Translation result saved.");
    });
  });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "saveTranslation") {
    saveTranslationResult(message.originalText, message.translatedText);
  }
});
