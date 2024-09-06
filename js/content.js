
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "t") {  // 例如 Ctrl + T 触发翻译
    chrome.runtime.sendMessage({action: "translate_paragraph"});
  }
});

