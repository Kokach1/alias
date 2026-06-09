# <img src="icon-32.png" align="center" width="30"/> Alias - Contextual Email Generator

Alias is a premium, privacy-first Google Chrome Extension (Manifest V3) designed to automatically detect signup pages and generate context-aware Gmail plus-aliases based on the website, page metadata, or custom formatting configurations.

<p align="left">
  <a href="https://github.com/Kokach1/alias">
    <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  </a>
  <img src="https://img.shields.io/badge/Manifest-V3-00bb00?style=for-the-badge" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Privacy-Local--Only-e8c100?style=for-the-badge&logo=shield" alt="Privacy Local-Only" />
</p>

---

## Key Features

* **Smart Onboarding**: Detects if your base email is missing on startup and guides you through configuring it with format checks.
* **Form Detection Engine**: Utilizes a client-side scoring model (evaluating URL syntax, input fields, header phrases, and CTA text) to distinguish registration screens from normal pages.
* **Style-Isolated In-Page Card**: Automatically injects a floating autofill card inside a **Shadow DOM** so it renders cleanly without inheriting page styling.
* **Google Sheets Integration**: Automatically detects spreadsheet tabs and extracts title components to generate sheet-specific emails (e.g. `example+sheetname@gmail.com`).
* **Editable Suffix Cycling**: Supports cycling through multiple extracted page variables (sub-domains, brands, clean page titles) and lets you edit the text directly before autofilling.

---

## Setup & Installation Guide

Follow these steps to run the extension locally:

### Step 1: Load the Extension in Developer Mode
1. Download or clone this repository to your local machine.
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. In the upper-right corner of the Extensions dashboard, toggle on **Developer mode**.
4. In the upper-left corner, click the **Load unpacked** button.
5. Select the `Alias` project root folder.
6. The extension is now loaded! Click the puzzle piece menu in the Chrome toolbar and **pin** Alias.

### Step 2: Configure Your Base Email
1. Click the **Alias** logo icon in your Chrome toolbar.
2. The popup will automatically display the onboarding screen.
3. Input your primary email address (e.g. `example@gmail.com`) and click **Get Started**.
4. *Optional*: If you ever need to change your email, default format patterns, or form sensitivity thresholds, click the gear icon in the top right to open the full-page **Settings Panel**.

### Step 3: Run local Manual Tests
To test all features without deploying:
1. Open the [mock_signup.html](mock_signup.html) file included in this repository in a Chrome tab.
2. Notice the glassmorphic card slide into the bottom-right corner of the screen.
3. Click **Autofill Alias** to populate the form fields.
4. Open the extension popup from the toolbar. Note that the badge displays **Signup Form** and you can cycle through alternate suffixes using the regenerate (cycle) button.

---

## Technology Stack & Privacy

* **Core**: Vanilla HTML5, CSS3, and JavaScript.
* **Style Isolation**: Shadow DOM encapsulation.
* **Local Storage**: `chrome.storage.sync`.
* **Zero Networking**: 100% local operation. No external APIs, no backend database dependencies, and no telemetry trackers.
