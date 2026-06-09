# Alias - Contextual Email Generator

A Manifest V3 Chrome Extension that automatically detects signup pages and generates contextual, Gmail-compatible plus-aliases based on the website name, page content, or user-defined rules. All processing and storage are conducted entirely on your local browser, ensuring 100% privacy.

---

## Features

1. **Email Setup & Validation**: Onboarding setup for your primary email, utilizing regex checks before saving configuration parameters locally in `chrome.storage.sync`.
2. **Signup Detection**: An advanced client scoring algorithm analyzing:
   * URL pathname keywords (`/signup`, `/register`, etc.).
   * Input forms matching email and password confirmation structures.
   * Buttons and header tags matching registration text.
3. **In-Page Overlay Popup**: A fully style-isolated **Shadow DOM** widget that automatically slides in from the bottom right when a signup page is loaded, allowing one-click autofill.
4. **Google Sheets Support**: Automatically parses sheet names to generate spreadsheet-specific aliases (e.g. `example+sheetname@gmail.com`).
5. **Context Generation**: Cycles through base domains, subdomain structures, OG site name tags, and cleaned page titles to offer custom options.

---

## Installation

1. Clone or download this repository.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory containing this codebase.
