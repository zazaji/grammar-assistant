document.addEventListener("DOMContentLoaded", () => {
  const translateButton = document.getElementById("translate");
  const saveButton = document.getElementById("save");
  const closeButton = document.getElementById("close-modal");
  const apiSelect = document.getElementById("api-select");
  const promptSelect = document.getElementById("prompt-select");

  // 动态加载 API 和 prompt 列表
  chrome.storage.local.get("configData", (data) => {
    const configData = data.configData;

    // 加载 API 选项
    configData.apis.forEach((api, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `API ${index + 1}: ${api.name || api.url}`;
      apiSelect.appendChild(option);
    });

    // 加载 prompt 选项
    configData.prompts.forEach((prompt, index) => {
      const option = document.createElement("option");
      option.value = index;
      const promptLines = configData.prompts[index].split("\n");
      const promptName = promptLines.find((line) => line.trim() !== "");
      option.textContent = `${promptName || "Prompt " + (index + 1)}`;
      promptSelect.appendChild(option);
    });

    // 选择默认 API 和 Prompt
    apiSelect.value = "0"; // 默认选择第一个API
    promptSelect.value = configData.defaultPromptIndex || "0"; // 默认选择指定的Prompt
  });

  translateButton.addEventListener("click", () => {
    const originalText = document.getElementById("original-text").value;
    if (originalText.trim() === "") {
      alert("Please enter text to translate.");
      return;
    }

    chrome.storage.local.get("configData", (data) => {
      const configData = data.configData;
      const selectedApiIndex = apiSelect.value;
      const selectedPromptIndex = promptSelect.value;

      const apiConfig = configData.apis[selectedApiIndex]; // 获取选定的 API 配置
      const promptTemplate = configData.prompts[selectedPromptIndex]; // 获取选定的 Prompt 模板

      const prompt = promptTemplate.replace("{{selectedText}}", originalText);

      apiConfig.top_p = configData.top_p || 0.01;
      apiConfig.max_tokens = configData.max_tokens || 4096;
      const loadingImg = document.createElement("div");

      loadingImg.className = "loading-spinner";
      node = document.getElementById("translated-label");
      node.appendChild(loadingImg);
      fetch(apiConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiConfig.key}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: apiConfig.max_tokens,
          top_p: apiConfig.top_p,
          model: apiConfig.model,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          const translatedText =
            data.choices[0].message.content
              .replaceAll("```html", "")
              .replaceAll("```", "") || "Translation failed.";
          loadingImg.remove();
          document.getElementById("translated-text").value = translatedText;
        })
        .catch((error) => {
          loadingImg.remove();
          console.error("Error translating text:", error);
          alert("Failed to translate text. Please try again.");
        });
    });
  });

  saveButton.addEventListener("click", () => {
    const originalText = document.getElementById("original-text").value;
    const translatedText = document.getElementById("translated-text").value;
    // const category = document.getElementById("category-select").value;
    let category = 0;
    document
      .querySelectorAll('#category-select input[type="radio"]')
      .forEach(function (radio) {
        if (radio.checked) {
          category = radio.value;
        }
      });
    console.log(category);
    const editIndex = document.getElementById("edit-index").value;
    if (originalText.trim() === "" || translatedText.trim() === "") {
      alert("Please enter both original and translated text.");
      return;
    }

    if (editIndex > -1) {
      saveEditedEntry(editIndex, originalText, translatedText, category);
      console.log(editIndex, originalText, translatedText);

      return;
    } else {
      addNewEntry(originalText, translatedText, category);
    }
  });

  closeButton.addEventListener("click", () => {
    closeAddModal();
  });
});

function addNewEntry(originalText, translatedText, category) {
  chrome.storage.local.get({ translationHistory: [] }, (data) => {
    const history = data.translationHistory;
    history.push({
      original: originalText,
      translated: translatedText,
      date: new Date().toLocaleString(),
      category: category,
    });

    chrome.storage.local.set({ translationHistory: history }, () => {
      alert("Translation saved!");
    });
  });
}

function toggleView(type, action) {
  for (type of ["translated"]) {
    //"original",
    const textarea = document.getElementById(`${type}-text`);
    const div = document.getElementById(`${type}-text-div`);

    if (action === "show") {
      // Show div and hide textarea
      div.classList.remove("hidden");
      textarea.classList.add("hidden");
      div.innerHTML = textarea.value;
    } else {
      // Show textarea and hide div
      textarea.classList.remove("hidden");
      div.classList.add("hidden");
    }
  }
}

function handleRadioChange(event) {
  const type = event.target.name.includes("original")
    ? "original"
    : "translated";
  const action = event.target.value;
  toggleView(type, action);
}

// 删除翻译历史记录条目
function deleteTranslationEntry(index) {
  chrome.storage.local.get({ translationHistory: [] }, (data) => {
    const history = data.translationHistory;

    // 删除选定的条目
    history.splice(index, 1);

    // 保存更新后的记录
    chrome.storage.local.set({ translationHistory: history }, () => {
      console.log("Translation entry deleted.");
      // 刷新页面以更新显示
      window.location.reload();
    });
  });
}

function openEditModal(entry, index) {
  const modal = document.getElementById("add-modal");
  modal.style.display = "flex";
  const originalTextarea = document.getElementById("original-text");
  const translatedTextarea = document.getElementById("translated-text");
  // const categorySelect = document.getElementById("category-select");
  // categorySelect.value = entry.category || 1;
  originalTextarea.value = entry.original;
  translatedTextarea.value = entry.translated;

  // 遍历并设置特定值的radio为选中状态
  document
    .querySelectorAll('#category-select input[type="radio"]')
    .forEach(function (radio) {
      if (radio.value == entry.category) {
        radio.checked = true;
      }
    });
  const modalTitle = document.getElementById("add-modal-title");
  modalTitle.innerHTML = "Edit Record";
  const editIndex = document.getElementById("edit-index");
  editIndex.value = index;
}

// 保存编辑后的记录
function saveEditedEntry(index, newOriginal, newTranslated, newCategory) {
  chrome.storage.local.get({ translationHistory: [] }, (data) => {
    const history = data.translationHistory;

    // 更新相应的条目
    history[index].original = newOriginal;
    history[index].translated = newTranslated;
    history[index].category = newCategory;
    history[index].date = new Date().toLocaleString(); // 更新日期为当前保存时间

    // 保存更新后的记录
    chrome.storage.local.set({ translationHistory: history }, () => {
      console.log("Translation entry updated.");
    });
    window.parent.location.reload(); // 刷新页面
  });
}

// 打开新增弹窗
function openAddModal() {
  const modal = document.getElementById("add-modal");
  modal.style.display = "flex";
  const modalTitle = document.getElementById("add-modal-title");
  modalTitle.innerHTMLnnerHTML = "Add Record";
}

// 关闭新增弹窗
function closeAddModal() {
  const modal = document.getElementById("add-modal");
  modal.style.display = "none";
  const modalTitle = document.getElementById("add-modal-title");
  modalTitle.innerHTMLnnerHTML = "";
}

// Set up event listeners for radio buttons
document.querySelectorAll('input[name="view-original"]').forEach((radio) => {
  radio.addEventListener("change", handleRadioChange);
});
document.querySelectorAll('input[name="view-translated"]').forEach((radio) => {
  radio.addEventListener("change", handleRadioChange);
});

function wrapSelectedText(tagName) {
  const textarea = document.getElementById("translated-text");
  const selectedText = textarea.value.substring(
    textarea.selectionStart,
    textarea.selectionEnd,
  );

  if (selectedText) {
    const wrappedText = `<${tagName}>${selectedText}</${tagName}>`;
    textarea.setRangeText(
      wrappedText,
      textarea.selectionStart,
      textarea.selectionEnd,
      "end",
    );
  }
}

// Function to handle click on div elements
function handleDivClick(event) {
  console.log(event.target);
  const tagName = event.target.tagName;
  wrapSelectedText(tagName);
}

// document.addEventListener("DOMContentLoaded", () => {
//   // Add event listeners to dynamically created div elements
//   document.querySelectorAll(".interactive-div").forEach((div) => {
//     div.addEventListener("click", handleDivClick);
//   });
// });
