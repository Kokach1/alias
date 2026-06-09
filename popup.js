// Popup script for Alias Extension

document.addEventListener("DOMContentLoaded", () => {
  // Screen views
  const setupScreen = document.getElementById("setup-screen");
  const dashboardScreen = document.getElementById("dashboard-screen");

  // Onboarding Setup controls
  const setupEmailInput = document.getElementById("setup-email-input");
  const setupSaveBtn = document.getElementById("setup-save-btn");
  const setupError = document.getElementById("setup-error");

  // Dashboard controls
  const settingsBtn = document.getElementById("settings-btn");
  const currentSiteName = document.getElementById("current-site-name");
  const currentSiteUrl = document.getElementById("current-site-url");
  const signupBadge = document.getElementById("signup-badge");
  const aliasDisplayInput = document.getElementById("alias-display-input");
  const regenerateBtn = document.getElementById("regenerate-btn");
  const copyBtn = document.getElementById("copy-btn");
  const copyIcon = document.getElementById("copy-icon");
  const checkIcon = document.getElementById("check-icon");
  const copyText = document.getElementById("copy-text");
  const autofillBtn = document.getElementById("autofill-btn");
  const detectionWarning = document.getElementById("detection-warning");
  const closeWarningBtn = document.getElementById("close-warning");
  const currentEmailFooter = document.getElementById("current-email-footer");

  // State variables
  let userEmail = "";
  let aliasFormat = "{email}+{site}";
  let detectionSensitivity = "medium";
  let activeContexts = [];
  let currentContextIndex = 0;
  let pageDetails = null;

  // Initialize: load settings
  chrome.storage.sync.get(["primaryEmail", "defaultFormat", "sensitivity"], (settings) => {
    userEmail = settings.primaryEmail || "";
    aliasFormat = settings.defaultFormat || "{email}+{site}";
    detectionSensitivity = settings.sensitivity || "medium";

    if (!userEmail) {
      showScreen("setup");
    } else {
      showScreen("dashboard");
      currentEmailFooter.textContent = `Primary: ${userEmail}`;
      initializeDashboard();
    }
  });

  // Setup Save Handler
  setupSaveBtn.addEventListener("click", () => {
    const emailValue = setupEmailInput.value.trim();
    if (validateEmail(emailValue)) {
      chrome.storage.sync.set({ primaryEmail: emailValue }, () => {
        userEmail = emailValue;
        currentEmailFooter.textContent = `Primary: ${userEmail}`;
        showScreen("dashboard");
        initializeDashboard();
        showToast("Email configured successfully!");
      });
    } else {
      setupError.classList.remove("hidden");
    }
  });

  // Settings click
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Regenerate Context Click
  regenerateBtn.addEventListener("click", () => {
    if (activeContexts.length > 1) {
      currentContextIndex = (currentContextIndex + 1) % activeContexts.length;
      updateGeneratedAlias();
      showToast(`Switched context to: ${activeContexts[currentContextIndex]}`);
    } else {
      showToast("Only one context option available for this site.");
    }
  });

  // Format chip clicks
  const chips = document.querySelectorAll(".chip");
  chips.forEach(chip => {
    chip.addEventListener("click", (e) => {
      chips.forEach(c => c.classList.remove("active"));
      e.target.classList.add("active");
      aliasFormat = e.target.getAttribute("data-format");
      updateGeneratedAlias();
    });
  });

  // Copy click
  copyBtn.addEventListener("click", () => {
    const aliasText = aliasDisplayInput.value;
    navigator.clipboard.writeText(aliasText).then(() => {
      // Toggle icons for success indication
      copyIcon.classList.add("hidden");
      checkIcon.classList.remove("hidden");
      copyText.textContent = "Copied";
      showToast("Copied to clipboard!");

      setTimeout(() => {
        copyIcon.classList.remove("hidden");
        checkIcon.classList.add("hidden");
        copyText.textContent = "Copy";
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy text: ", err);
      showToast("Failed to copy alias.");
    });
  });

  // Autofill click
  autofillBtn.addEventListener("click", () => {
    const aliasText = aliasDisplayInput.value;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "autofillEmail", email: aliasText }, (response) => {
          if (chrome.runtime.lastError) {
            showToast("Cannot autofill on this page.");
            return;
          }
          if (response && response.success) {
            showToast("Autofilled email field!");
          } else {
            showToast("No email input fields detected to fill.");
          }
        });
      }
    });
  });

  // Close Warning Alert
  closeWarningBtn.addEventListener("click", () => {
    detectionWarning.classList.add("hidden");
  });

  // Helper: Switch screens
  function showScreen(screenName) {
    if (screenName === "setup") {
      setupScreen.classList.remove("hidden");
      dashboardScreen.classList.add("hidden");
    } else {
      setupScreen.classList.add("hidden");
      dashboardScreen.classList.remove("hidden");
    }
  }

  // Helper: Email validation
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Initialize Dashboard Data
  function initializeDashboard() {
    // Synchronize active chips with selected default format
    chips.forEach(chip => {
      if (chip.getAttribute("data-format") === aliasFormat) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const activeTab = tabs[0];

      // Safe fallback data if content script is unavailable (e.g. settings page, new tab, chrome:// pages)
      let fallbackDomain = "unknown";
      let fallbackHostname = "unknown.com";
      try {
        if (activeTab.url) {
          const urlObj = new URL(activeTab.url);
          fallbackHostname = urlObj.hostname;
          fallbackDomain = fallbackHostname.replace(/^www\./i, "").split(".")[0];
        }
      } catch (e) {
        console.error("URL parse error:", e);
      }

      const fallbackData = {
        hostname: fallbackHostname,
        score: 0,
        isGoogleSheet: false,
        sheetTitle: "",
        signals: { urlMatch: false, inputsMatch: false, buttonMatch: false, headerMatch: false },
        extractedContexts: {
          domainBase: fallbackDomain,
          secondaryDomain: "",
          siteName: activeTab.title ? activeTab.title.split(/[-|]/)[0].trim() : fallbackDomain,
          cleanTitle: activeTab.title || fallbackDomain
        }
      };

      // Query content script
      chrome.tabs.sendMessage(activeTab.id, { action: "analyzePage" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // Content script not responding, use fallback
          console.warn("Alias: Content script did not respond. Using tab fallback.", chrome.runtime.lastError);
          renderDashboard(fallbackData);
        } else {
          renderDashboard(response.data);
        }
      });
    });
  }

  // Render Dashboard Views
  function renderDashboard(data) {
    pageDetails = data;
    currentSiteName.textContent = data.extractedContexts.siteName || data.extractedContexts.domainBase;
    currentSiteUrl.textContent = data.hostname;

    // Set badge status & warning threshold
    let sensitivityThreshold = 45;
    if (detectionSensitivity === "low") sensitivityThreshold = 25;
    if (detectionSensitivity === "high") sensitivityThreshold = 65;

    if (data.isGoogleSheet) {
      signupBadge.textContent = "Google Sheets";
      signupBadge.className = "badge sheets";
      detectionWarning.classList.add("hidden");
    } else if (data.score >= sensitivityThreshold) {
      signupBadge.textContent = "Signup Form";
      signupBadge.className = "badge";
      detectionWarning.classList.add("hidden");
    } else {
      signupBadge.textContent = "General Page";
      signupBadge.className = "badge warning";
      detectionWarning.classList.remove("hidden");
    }

    // Build context list
    activeContexts = getContextOptions(data);
    currentContextIndex = 0;

    // Update displayed alias
    updateGeneratedAlias();
  }

  // Generate context options to cycle through
  function getContextOptions(data) {
    const list = [];
    
    if (data.isGoogleSheet && data.sheetTitle) {
      const sheetName = data.sheetTitle;
      list.push(cleanString(sheetName));
      // Add first two words combined if longer
      const parts = sheetName.split(/\s+/).slice(0, 2).join("");
      if (parts && cleanString(parts) !== cleanString(sheetName)) {
        list.push(cleanString(parts));
      }
    }

    const ex = data.extractedContexts || {};
    if (ex.siteName) list.push(cleanString(ex.siteName));
    if (ex.cleanTitle) list.push(cleanString(ex.cleanTitle));
    if (ex.domainBase) list.push(cleanString(ex.domainBase));
    if (ex.secondaryDomain) list.push(cleanString(ex.secondaryDomain));

    // Deduplicate and filter out empty or single character items
    const unique = [...new Set(list.filter(item => item && item.length > 1))];
    
    if (unique.length === 0) {
      unique.push("site");
    }
    return unique;
  }

  // Clean suffix strings
  function cleanString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Compute and set the generated alias in the input box
  function updateGeneratedAlias() {
    if (!userEmail) return;

    const emailParts = userEmail.split("@");
    const username = emailParts[0];
    const domain = emailParts[1];

    const currentContext = activeContexts[currentContextIndex];
    const currentSite = pageDetails ? cleanString(pageDetails.extractedContexts.domainBase) : "site";
    const currentYear = new Date().getFullYear();

    let suffix = currentContext;
    let siteSuffix = currentSite;

    let alias = "";

    // Support formats: 
    // "{email}+{site}", "{email}+{context}", "{email}+{site}-{year}", "{email}+{context}-{year}"
    if (aliasFormat === "{email}+{site}") {
      alias = `${username}+${siteSuffix}@${domain}`;
    } else if (aliasFormat === "{email}+{context}") {
      alias = `${username}+${suffix}@${domain}`;
    } else if (aliasFormat === "{email}+{site}-{year}") {
      alias = `${username}+${siteSuffix}-${currentYear}@${domain}`;
    } else if (aliasFormat === "{email}+{context}-{year}") {
      alias = `${username}+${suffix}-${currentYear}@${domain}`;
    } else {
      alias = `${username}+${siteSuffix}@${domain}`;
    }

    aliasDisplayInput.value = alias;
    // Make text input fully editable
    aliasDisplayInput.readOnly = false;
  }

  // Toast message utility
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    
    // Trigger animations via adding a class
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 250);
    }, 2000);
  }
});
