// Initialize defaults on installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.get(["primaryEmail", "defaultFormat", "sensitivity"], (result) => {
      const updates = {};
      if (result.primaryEmail === undefined) {
        updates.primaryEmail = "";
      }
      if (result.defaultFormat === undefined) {
        updates.defaultFormat = "{email}+{site}";
      }
      if (result.sensitivity === undefined) {
        updates.sensitivity = "medium"; // 'low' (25), 'medium' (45), 'high' (65)
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.sync.set(updates, () => {
          console.log("Alias Extension: Defaults initialized.", updates);
        });
      }
    });
  }
});
