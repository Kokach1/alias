// Options script for Alias Extension

document.addEventListener("DOMContentLoaded", () => {
  // Input fields & buttons
  const primaryEmailInput = document.getElementById("primary-email");
  const emailError = document.getElementById("email-error");
  const sensitivitySlider = document.getElementById("sensitivity-slider");
  const saveBtn = document.getElementById("save-btn");
  const saveStatus = document.getElementById("save-status");
  const formatRadios = document.getElementsByName("format");
  const sensLabels = document.querySelectorAll(".sens-opt");

  // Sensitivity maps
  const sensitivityIndexMap = { "low": 1, "medium": 2, "high": 3 };
  const sensitivityValueMap = { 1: "low", 2: "medium", 3: "high" };

  // Load existing settings
  chrome.storage.sync.get(["primaryEmail", "defaultFormat", "sensitivity"], (settings) => {
    // 1. Primary email
    primaryEmailInput.value = settings.primaryEmail || "";

    // 2. Default format radio options
    const defaultFormat = settings.defaultFormat || "{email}+{site}";
    for (const radio of formatRadios) {
      if (radio.value === defaultFormat) {
        radio.checked = true;
        break;
      }
    }

    // 3. Sensitivity slider & label highlight
    const sensitivity = settings.sensitivity || "medium";
    const sliderVal = sensitivityIndexMap[sensitivity] || 2;
    sensitivitySlider.value = sliderVal;
    updateSensitivityHighlight(sliderVal);
  });

  // Slider change handler
  sensitivitySlider.addEventListener("input", (e) => {
    updateSensitivityHighlight(parseInt(e.target.value, 10));
  });

  // Save button click
  saveBtn.addEventListener("click", () => {
    // 1. Validate email
    const emailVal = primaryEmailInput.value.trim();
    if (emailVal !== "" && !validateEmail(emailVal)) {
      emailError.classList.remove("hidden");
      return;
    }
    emailError.classList.add("hidden");

    // 2. Get active format radio
    let formatVal = "{email}+{site}";
    for (const radio of formatRadios) {
      if (radio.checked) {
        formatVal = radio.value;
        break;
      }
    }

    // 3. Get active sensitivity level
    const sensLevel = sensitivityValueMap[parseInt(sensitivitySlider.value, 10)] || "medium";

    // 4. Save to sync storage
    chrome.storage.sync.set({
      primaryEmail: emailVal,
      defaultFormat: formatVal,
      sensitivity: sensLevel
    }, () => {
      // Show save confirmation badge
      saveStatus.classList.remove("hidden");
      setTimeout(() => {
        saveStatus.classList.add("hidden");
      }, 2500);
    });
  });

  // Helper: Update active class on sensitivity labels
  function updateSensitivityHighlight(value) {
    sensLabels.forEach((label) => {
      const idx = sensitivityIndexMap[label.getAttribute("data-level")];
      if (idx === value) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    });
  }

  // Helper: Regex validate email format
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
});
