// Content script for Alias Extension

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzePage") {
    try {
      const pageInfo = analyzePage();
      sendResponse({ success: true, data: pageInfo });
    } catch (error) {
      console.error("Alias analysis error:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === "autofillEmail") {
    try {
      const success = autofill(request.email);
      sendResponse({ success: success });
    } catch (error) {
      console.error("Alias autofill error:", error);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true; // Keep the message channel open for asynchronous responses
});

/**
 * Analyzes the current page to detect signup forms and extract page contexts.
 */
function analyzePage() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const title = document.title;

  // 1. Detect Google Sheets
  const isGoogleSheet = hostname === "docs.google.com" && pathname.startsWith("/spreadsheets");
  let sheetTitle = "";
  if (isGoogleSheet) {
    // Google Sheets titles are structured as "Title - Google Sheets"
    sheetTitle = title.replace(/\s*-\s*Google Sheets/gi, "").trim();
  }

  // 2. Signup Page Detection Scoring
  let score = 0;
  const signals = {
    urlMatch: false,
    inputsMatch: false,
    buttonMatch: false,
    headerMatch: false
  };

  // URL Pathname Analysis (+35 pts)
  const signupPathKeywords = [/signup/i, /sign-up/i, /register/i, /create-account/i, /createaccount/i, /join/i, /get-started/i, /getstarted/i];
  const matchesUrl = signupPathKeywords.some(keyword => keyword.test(pathname));
  if (matchesUrl) {
    score += 35;
    signals.urlMatch = true;
  }

  // Form Field Analysis (+15 pts per field, +10 bonus for full set)
  const inputs = Array.from(document.querySelectorAll("input"));
  let hasEmailField = false;
  let hasPasswordField = false;
  let hasConfirmPasswordField = false;

  inputs.forEach(input => {
    const type = (input.getAttribute("type") || "").toLowerCase();
    const name = (input.getAttribute("name") || "").toLowerCase();
    const id = (input.getAttribute("id") || "").toLowerCase();
    const placeholder = (input.getAttribute("placeholder") || "").toLowerCase();
    const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();

    // Detect Email Field
    if (type === "email" || name.includes("email") || id.includes("email") || placeholder.includes("email") || autocomplete.includes("email")) {
      hasEmailField = true;
    }
    // Detect Password Field
    if (type === "password") {
      // Check if it's a confirmation field
      const isConfirm = name.includes("confirm") || id.includes("confirm") || placeholder.includes("confirm") ||
                        name.includes("repeat") || id.includes("repeat") || placeholder.includes("repeat") ||
                        name.includes("reenter") || id.includes("reenter") || name.includes("re-enter");
      if (isConfirm) {
        hasConfirmPasswordField = true;
      } else {
        hasPasswordField = true;
      }
    }
  });

  if (hasEmailField) score += 15;
  if (hasPasswordField) score += 15;
  if (hasConfirmPasswordField) score += 15;

  if (hasEmailField && hasPasswordField && hasConfirmPasswordField) {
    score += 10; // Bonus for complete sign up signature
    signals.inputsMatch = true;
  } else if (hasEmailField && hasPasswordField) {
    signals.inputsMatch = true; // Minimum setup detected
  }

  // Button Text Analysis (+20 pts)
  const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], a.btn, a.button"));
  const buttonKeywords = ["sign up", "signup", "register", "create account", "create your account", "join now", "get started", "join"];
  const matchesButton = buttons.some(btn => {
    const text = (btn.innerText || btn.value || "").toLowerCase().trim();
    return buttonKeywords.some(kw => text.includes(kw));
  });
  if (matchesButton) {
    score += 20;
    signals.buttonMatch = true;
  }

  // Heading Text Analysis (+15 pts)
  const headings = Array.from(document.querySelectorAll("h1, h2"));
  const headingKeywords = ["sign up", "signup", "register", "create account", "create your account", "join us", "get started"];
  const matchesHeading = headings.some(h => {
    const text = h.innerText.toLowerCase().trim();
    return headingKeywords.some(kw => text.includes(kw));
  });
  if (matchesHeading) {
    score += 15;
    signals.headerMatch = true;
  }

  // 3. Context & Brand Extraction
  // Extract clean site base name from domain (e.g. aws.amazon.com -> aws, amazon)
  const domainParts = hostname.replace(/^www\./i, "").split(".");
  let domainBase = domainParts[0];
  let secondaryDomain = "";

  if (domainParts.length > 2) {
    // Subdomains present: e.g. aws.amazon.com -> domainBase = aws, secondaryDomain = amazon
    domainBase = domainParts[0];
    secondaryDomain = domainParts[1];
  } else if (domainParts.length === 2) {
    domainBase = domainParts[0];
  }

  // Get Meta Site Name
  let siteName = "";
  const ogSiteNameMeta = document.querySelector("meta[property='og:site_name']");
  const appNameMeta = document.querySelector("meta[name='application-name']");
  if (ogSiteNameMeta && ogSiteNameMeta.getAttribute("content")) {
    siteName = ogSiteNameMeta.getAttribute("content").trim();
  } else if (appNameMeta && appNameMeta.getAttribute("content")) {
    siteName = appNameMeta.getAttribute("content").trim();
  }

  // Clean Title Context
  // e.g. "Create your account | GitHub" -> "Create your account" or "GitHub"
  // Let's strip the common site branding delimiters
  let cleanTitle = title;
  const delimiters = [" - ", " | ", " : ", " · ", " • "];
  let titleParts = [title];
  for (const delimiter of delimiters) {
    if (title.includes(delimiter)) {
      titleParts = title.split(delimiter);
      break;
    }
  }

  // Exclude common noise phrases from title parts to get a clean context
  const noiseRegex = /signup|sign-up|register|registration|create account|login|sign in|join|welcome/gi;
  let contextTitleCandidate = "";

  // Look for the part of the title that is NOT a common action keyword and NOT the base domain
  for (let part of titleParts) {
    part = part.trim();
    if (!noiseRegex.test(part) && part.length > 2) {
      contextTitleCandidate = part;
      break;
    }
  }

  // Fallback to the first title part if no candidate matches
  if (!contextTitleCandidate && titleParts.length > 0) {
    contextTitleCandidate = titleParts[0].replace(noiseRegex, "").trim();
  }

  return {
    hostname: hostname,
    score: score,
    signals: signals,
    isGoogleSheet: isGoogleSheet,
    sheetTitle: sheetTitle,
    extractedContexts: {
      domainBase: domainBase,
      secondaryDomain: secondaryDomain,
      siteName: siteName,
      cleanTitle: contextTitleCandidate || title
    }
  };
}

/**
 * Fills the email field on the page.
 * Prioritizes:
 * 1. Currently focused element (if it is an input)
 * 2. First input[type="email"]
 * 3. First input matching email name/id
 * 4. First visible text input as final fallback
 */
function autofill(email) {
  let targetInput = null;

  // 1. Check focused element
  if (document.activeElement && document.activeElement.tagName === "INPUT") {
    targetInput = document.activeElement;
  }

  // 2. Query for email input fields
  if (!targetInput) {
    targetInput = document.querySelector("input[type='email']");
  }

  // 3. Search inputs by name or id attributes containing 'email'
  if (!targetInput) {
    const inputs = Array.from(document.querySelectorAll("input"));
    targetInput = inputs.find(input => {
      const name = (input.getAttribute("name") || "").toLowerCase();
      const id = (input.getAttribute("id") || "").toLowerCase();
      const placeholder = (input.getAttribute("placeholder") || "").toLowerCase();
      const type = (input.getAttribute("type") || "").toLowerCase();
      return (type === "text" && (name.includes("email") || id.includes("email") || placeholder.includes("email")));
    });
  }

  // 4. Fallback to first text input
  if (!targetInput) {
    targetInput = document.querySelector("input[type='text']");
  }

  if (targetInput) {
    // Focus the element
    targetInput.focus();
    
    // Set value
    targetInput.value = email;

    // Trigger standard input/change events for UI libraries (React/Vue/etc.)
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    targetInput.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  return false;
}

/**
 * Helper to generate an email alias based on format and page data.
 */
function generateAlias(email, format, data) {
  const parts = email.split("@");
  const username = parts[0];
  const domain = parts[1];

  let currentContext = "site";
  if (data.isGoogleSheet && data.sheetTitle) {
    currentContext = data.sheetTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  } else if (data.extractedContexts) {
    const ex = data.extractedContexts;
    currentContext = (ex.siteName || ex.cleanTitle || ex.domainBase || "site")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }
  const siteSuffix = (data.extractedContexts.domainBase || "site").toLowerCase().replace(/[^a-z0-9]/g, "");
  const currentYear = new Date().getFullYear();

  if (format === "{email}+{site}") {
    return `${username}+${siteSuffix}@${domain}`;
  } else if (format === "{email}+{context}") {
    return `${username}+${currentContext}@${domain}`;
  } else if (format === "{email}+{site}-{year}") {
    return `${username}+${siteSuffix}-${currentYear}@${domain}`;
  } else if (format === "{email}+{context}-{year}") {
    return `${username}+${currentContext}-${currentYear}@${domain}`;
  }
  return `${username}+${siteSuffix}@${domain}`;
}

/**
 * Creates and inserts the in-page overlay popup using Shadow DOM isolation.
 */
function showInPagePopup(analysis, email, format) {
  if (document.getElementById("alias-shadow-host")) return;

  const generatedEmail = generateAlias(email, format, analysis);

  // Create shadow host container
  const host = document.createElement("div");
  host.id = "alias-shadow-host";
  host.style.position = "fixed";
  host.style.bottom = "24px";
  host.style.right = "24px";
  host.style.zIndex = "2147483647";
  host.style.all = "initial"; // Reset styles from parent page

  const shadowRoot = host.attachShadow({ mode: "open" });

  // Add styles
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .alias-card {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
      width: 290px;
      background: #090d16;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: #f3f4f6;
      opacity: 0;
      transform: translateY(20px);
    }
    .alias-card * {
      box-sizing: border-box;
    }
    
    .animate-slide-in {
      animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-slide-out {
      animation: slideOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    @keyframes slideIn {
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(20px); }
    }

    .alias-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #f3f4f6;
    }
    .logo-icon, .logo-img {
      width: 16px;
      height: 16px;
      object-fit: contain;
    }
    .logo-icon {
      color: #8b5cf6;
      filter: drop-shadow(0 0 3px rgba(139, 92, 246, 0.4));
    }
    .logo-text {
      font-weight: 700;
      font-size: 0.95rem;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      transition: color 0.15s ease;
    }
    .close-btn:hover {
      color: #fff;
    }

    .alias-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .alias-desc {
      font-size: 0.75rem;
      color: #9ca3af;
      line-height: 1.35;
    }
    
    .alias-preview {
      background: rgba(31, 41, 55, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 8px 10px;
      color: #a5b4fc;
      font-family: monospace;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }

    .primary-btn {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-weight: 600;
      font-size: 0.825rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
    }
    .primary-btn:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
      transform: translateY(-1px);
    }
    .primary-btn:active {
      transform: translateY(0);
    }
  `;

  const card = document.createElement("div");
  card.className = "alias-card animate-slide-in";
  card.innerHTML = `
    <div class="alias-header">
      <div class="logo-area">
        <img src="\${chrome.runtime.getURL("icon-32.png")}" class="logo-img" alt="Alias Logo" />
        <span class="logo-text">Alias.</span>
      </div>
      <button class="close-btn" id="dismiss-widget" title="Dismiss Widget">&times;</button>
    </div>
    <div class="alias-body">
      <div class="alias-desc">${analysis.isGoogleSheet ? "Google Sheets detected. Generate sheets alias?" : "Signup page detected. Autofill with alias email?"}</div>
      <div class="alias-preview" title="${generatedEmail}">${generatedEmail}</div>
      <button class="primary-btn" id="fill-widget">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
        <span>Autofill Alias</span>
      </button>
    </div>
  `;

  shadowRoot.appendChild(styleEl);
  shadowRoot.appendChild(card);
  document.body.appendChild(host);

  // Close widget event
  shadowRoot.getElementById("dismiss-widget").addEventListener("click", () => {
    dismissWidget(card, host);
  });

  // Autofill and close event
  shadowRoot.getElementById("fill-widget").addEventListener("click", () => {
    autofill(generatedEmail);
    dismissWidget(card, host);
  });
}

/**
 * Triggers slide-out animation and cleans up host DOM container.
 */
function dismissWidget(cardElement, hostElement) {
  cardElement.classList.remove("animate-slide-in");
  cardElement.classList.add("animate-slide-out");
  setTimeout(() => {
    if (hostElement.parentNode) {
      hostElement.parentNode.removeChild(hostElement);
    }
  }, 250);
}

// Check sync storage and automatically render the in-page popup overlay if page qualifies
chrome.storage.sync.get(["primaryEmail", "defaultFormat", "sensitivity"], (settings) => {
  const email = settings.primaryEmail;
  if (!email) return;

  const format = settings.defaultFormat || "{email}+{site}";
  const sensitivity = settings.sensitivity || "medium";

  let threshold = 45;
  if (sensitivity === "low") threshold = 25;
  if (sensitivity === "high") threshold = 65;

  const analysis = analyzePage();
  if (analysis.score >= threshold || analysis.isGoogleSheet) {
    // Brief delay to ensure initial layout is painted and visible
    setTimeout(() => {
      showInPagePopup(analysis, email, format);
    }, 850);
  }
});
