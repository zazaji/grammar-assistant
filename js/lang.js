function changeLang(selectedLanguage) {
  let langConfig = {};
  fetch(`lang/${selectedLanguage}.json`)
    .then((response) => response.json())
    .then((translations) => {
      // langConfig = translations;
      // 遍历 translations 对象的键值对
      for (const [key, value] of Object.entries(translations)) {
        const element = document.getElementById(key); // 根据键查找元素
        if (element) {
          // langConfig[key] = value;
          // 如果元素存在，替换文本内容
          element.textContent = value;
        }
      }
      // console.log(translations);
      // return translations;
    });
  // console.log(langConfig);
  // return langConfig;
}
