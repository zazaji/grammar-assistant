document.addEventListener("DOMContentLoaded", () => {
  // 加载并应用自定义 CSS
  let syncUrl = "";
  let syncToken = "";
  let customCSS = "";

  chrome.storage.local.get("configData", (data) => {
    console.log(data);
    syncUrl = data.configData.syncUrl || "http://127.0.0.1:8000/translations";
    syncToken = data.configData.syncToken || "";
    customCSS = data.configData.customCSS || "";
    injectCSS(customCSS);
    const translatedLabel = document.getElementById("translated-label");
    translatedLabel.innerHTML += extractAndGenerateDivs(customCSS);
    document.querySelectorAll(".interactive-div").forEach((div) => {
      div.addEventListener("click", handleDivClick);
    });
  });

  function extractAndGenerateDivs(css) {
    // 提取不含 `-`、`.` 和 `#` 的属性名
    const regex = /([a-z]+[0-9]),[\sa-zA-Z0-9]+\s\*\s*{/g;
    let match;
    const properties = new Set();
    console.log("haskdlhjfalds");
    console.log(css);

    while ((match = regex.exec(css)) !== null) {
      const property = match[1];
      properties.add(property);
    }

    // 生成 HTML <div> 集合
    let divsHtml = "";
    properties.forEach((property) => {
      console.log(property);
      divsHtml += `<div class='interactive-div' tag='${property}'><${property}>${property}</${property}></div>\n`;
    });
    return divsHtml;
  }

  const importCsvButton = document.getElementById("importCsv");
  const csvFileInput = document.getElementById("csvFileInput");

  // 点击 "Import CSV" 按钮时，触发文件选择
  importCsvButton.addEventListener("click", () => {
    csvFileInput.click();
  });

  // 当选择了文件时，处理CSV文件
  csvFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const csvContent = e.target.result;
        parseAndImportCsv(csvContent);
      };
      reader.readAsText(file);
    }
  });

  function parseAndImportCsv(csvContent) {
    const rows = csvContent.split("\n");
    const newEntries = [];

    rows.forEach((row) => {
      const columns = row.split(",");
      if (columns.length >= 2) {
        // 假设CSV格式是：original, translated, timestamp
        const original = columns[0].trim();
        const translated = columns[1].trim();
        const date =
          columns.length >= 3
            ? new Date(columns[2].trim()).toLocaleString()
            : new Date().toLocaleString();
        if (original.length === 0 || translated.length === 0) {
          console.log("original or translated is empty");
          return;
        }
        newEntries.push({
          original: original,
          translated: translated,
          date: date,
        });
      }
    });

    // 从storage中获取当前历史记录
    chrome.storage.local.get({ translationHistory: [] }, (data) => {
      const history = data.translationHistory.concat(newEntries);

      // 保存合并后的历史记录
      chrome.storage.local.set({ translationHistory: history }, () => {
        // 重新渲染页面
        renderHistory();
      });
    });
  }

  renderHistory();

  function renderHistory() {
    const historyTableBody = document.getElementById("history-tbody");

    chrome.storage.local.get({ translationHistory: [] }, (data) => {
      const history = data.translationHistory;

      if (history.length === 0) {
        historyTableBody.innerHTML =
          "<tr><td colspan='2'>No history found.</td></tr>";
      } else {
        historyTableBody.innerHTML = ""; // 清空之前的内容
        history.forEach((entry, index) => {
          // 创建原文行
          const originalRow = document.createElement("tr");
          // 原文列
          const originalCell = document.createElement("td");
          originalCell.innerHTML = `&#x2691 ${entry.original}`;
          originalRow.appendChild(originalCell);

          // 日期时间列
          const timeCell = document.createElement("td");
          timeCell.className = "timestamp  hide-on-mobile";
          timeCell.textContent = entry.date;
          // timeCell.rowSpan = 2; // 跨两行
          originalRow.appendChild(timeCell);

          // 将原文行添加到表格主体
          historyTableBody.appendChild(originalRow);

          // 创建翻译内容行
          const translatedRow = document.createElement("tr");

          // 翻译文本列
          const translatedCell = document.createElement("td");
          translatedCell.innerHTML = `&#9743 ${entry.translated}`;
          translatedRow.appendChild(translatedCell);

          // 操作按钮列
          const actionCell = document.createElement("td");
          const actionContent = document.createElement("div");
          actionContent.className =
            "d-flex justify-content-between align-items-center";
          actionCell.className = "center hide-on-mobile";

          // 编辑按钮
          const editButton = document.createElement("button");
          editButton.textContent = "Edit";
          editButton.className = "edit-button btn btn-warning btn-sm";
          editButton.addEventListener("click", () => {
            openEditModal(entry, index); // 打开编辑弹出窗口
          });

          // 删除按钮
          const deleteButton = document.createElement("button");
          deleteButton.textContent = "Delete";
          deleteButton.className = "delete-button btn btn-danger btn-sm";
          deleteButton.addEventListener("click", () => {
            deleteTranslationEntry(index);
          });

          // 添加按钮到操作列
          actionContent.appendChild(editButton);
          actionContent.appendChild(deleteButton);
          actionCell.appendChild(actionContent);
          translatedRow.appendChild(actionCell);

          // 将翻译内容行添加到表格主体
          historyTableBody.appendChild(translatedRow);
        });
      }
    });
  }

  //同步函数
  function syncTranslations() {
    chrome.storage.local.get({ translationHistory: [] }, async (data) => {
      const history = data.translationHistory;

      try {
        const response = await fetch(syncUrl + "sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${syncToken}`,
          },
          body: JSON.stringify(history),
        });

        const result = await response.json();

        if (result.status === "success") {
          // 合并本地历史记录和服务器返回的缺失记录
          const updatedHistory = history.concat(result.missing_records);

          // 保存更新后的历史记录
          chrome.storage.local.set(
            { translationHistory: updatedHistory },
            () => {
              // 重新渲染页面
              renderHistory();
              alert("Sync successful!");
            },
          );
        } else {
          alert("Sync failed!");
        }
      } catch (error) {
        console.error("Sync error:", error);
        alert("An error occurred during sync.");
      }
    });
  }

  async function cleanCloudHistory() {
    try {
      // 发送请求到服务器以清除数据库内容
      const response = await fetch(syncUrl + "delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Success:", result);
      alert("Database cleared successfully!");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to clear database. Check console for details.");
    }
  }

  document
    .getElementById("syncButton")
    .addEventListener("click", syncTranslations);

  document
    .getElementById("cleanCloudDatabase")
    .addEventListener("click", cleanCloudHistory);

  document.getElementById("goToOptions").addEventListener("click", () => {
    window.location.href = "options.html";
  });
  document.getElementById("exportCsv").addEventListener("click", exportToCSV);
  document.getElementById("addEntry").addEventListener("click", openAddModal);
});

// 注入自定义 CSS
function injectCSS(customCSS) {
  console.log("injectCSS");
  // 检查是否已经存在相同的样式
  if (!document.getElementById("translated-text-style")) {
    const style = document.createElement("style");
    style.id = "translated-text-style";
    style.innerHTML =
      customCSS ||
      `
      .translated-text {
        color: #444444;
      }
      .hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
}

// 导出翻译历史记录为 CSV 文件
function exportToCSV() {
  chrome.storage.local.get({ translationHistory: [] }, (data) => {
    const history = data.translationHistory;
    if (history.length === 0) {
      alert("No translation history to export.");
      return;
    }

    // 创建 CSV 内容
    const csvRows = [];
    // 添加表头
    csvRows.push("Original,Translated,Date");

    // 添加数据行
    history.forEach((entry) => {
      const original = entry.original.replace(/,/g, ""); // 防止 CSV 列分隔符问题
      const translated = entry.translated.replace(/,/g, ""); // 防止 CSV 列分隔符问题
      const date = new Date(entry.date).toLocaleString();
      csvRows.push(`"${original}","${translated}","${date}"`);
    });

    // 生成 CSV 文件
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}
