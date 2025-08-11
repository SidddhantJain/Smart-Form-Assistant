# Smart Form Assistant
<p>
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome%20Extension-Yes-4285F4?logo=google-chrome&logoColor=white" />
  <img alt="Manifest" src="https://img.shields.io/badge/Manifest-V3-34A853" />
  <img alt="Matching" src="https://img.shields.io/badge/Semantic%20Matching-Lightweight-9C27B0" />
  <img alt="Review Mode" src="https://img.shields.io/badge/Review%20Mode-Available-3B82F6" />
  <img alt="Self-Learning" src="https://img.shields.io/badge/Self--Learning-On-10B981" />
  <img alt="Privacy" src="https://img.shields.io/badge/Privacy-Local%20Only-111827" />
  <img alt="Offline" src="https://img.shields.io/badge/Offline-First-6B7280" />
</p>

AI-powered Google Form autofill extension with semantic matching, review mode, and self-learning memory.

## Overview
Smart Form Assistant helps you fill Google Forms faster by matching questions to your saved answers based on meaning, not just exact words. It can also learn new Q&A pairs from the forms you fill and reuse them later across differently phrased forms.

Key capabilities:
- Meaning-aware matching using a lightweight scorer (tokens + synonyms + Jaccard + Levenshtein + type hints)
- Profiles: save multiple answer sets (e.g., Personal, Work)
- Review mode: preview suggested answers without filling
- Self-learning memory: remember Q&A pairs you accept and reuse them later
- Works fully offline; data stays in your browser

## Features
- Smart matching: robust to phrasing changes (e.g., “What is your full name?” ≈ “Enter your complete name”).
- Multiple input types: fills text, textarea, radios, checkboxes, and best-effort dropdowns.
- Settings in popup:
  - Review mode (preview-only)
  - Auto-learn from current form
  - Match threshold slider
- Local storage of:
  - Profiles: chrome.storage.local.profiles
  - Learned memory: chrome.storage.local.learned

## How it works
- The content script extracts each question’s text and computes a similarity score against:
  1) previously learned questions
  2) your selected profile keys
- The highest score above the threshold wins, and the corresponding answer is applied.
- Matching algorithm (in `content/matcher.js`):
  - Normalize + tokenize (stopwords removed, light stemming)
  - Add synonyms for common fields (name, email, phone, etc.)
  - Compute Jaccard similarity (token overlap)
  - Compute normalized Levenshtein similarity (string edit distance)
  - Substring and type-hint bonuses (email/phone/date/github/linkedin/url/postal)
  - Weighted combination → final score

## Project structure
```
Smart Form Assistant/
├── manifest.json
├── background.js
├── README.md
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   ├── content.js
│   └── matcher.js
├── models/
│   └── minilm-model/   (placeholder, not required for current build)
└── storage/
    └── storage.js      (placeholder)
```

## Install (Chrome/Brave)
1. Open `chrome://extensions` or `brave://extensions`
2. Enable “Developer mode” (top right)
3. Click “Load unpacked”
4. Select the folder
   `d:\Siddhant\projects\Smart Form Assistant`

## Usage
1. Open a Google Form: `https://docs.google.com/forms/...`
2. Click the extension icon to open the popup
3. Create or load a Profile
   - Add key → answer pairs (e.g., “Full Name” → “John Doe”, “Email” → “john@site.com”)
   - Click Save Profile
4. Optional Settings in popup
   - Review mode: preview suggestions without filling
   - Auto-learn: remember Q&A when autofill runs
   - Threshold: lower = more matches, higher = stricter
5. Click “Fill Form”

Tips:
- If you see only highlights (no filling), you likely have Review mode ON. Turn it off and click “Fill Form” again to apply values.
- Try a threshold around 0.50–0.60 to start.

## Self-learning memory
- When Auto-learn is enabled and the extension autofills an answer, it stores `{ q: question, a: answer, ts }` to `chrome.storage.local.learned`.
- On future forms, it first compares new questions against the learned set and uses the best match above the threshold.
- Learned entries are generic and work across different forms.

## Troubleshooting
- Nothing fills
  - Ensure Review mode is OFF (so it writes values).
  - Lower the threshold (e.g., 0.50) for easier matching.
  - Make sure the page is a direct Google Form, not an embedded iframe.
  - Open DevTools on the form (F12) and check the Console for `[SFA]` logs and any warnings.
- Radios/checkboxes don’t select
  - Confirm the answer text matches or contains the visible option label.
- Dropdowns don’t pick
  - Labels must match; some forms require extra interaction—best effort is implemented.

## Development
- Content scripts are loaded via `manifest.json`:
  - `content/matcher.js` (lightweight scorer)
  - `content/content.js` (DOM parsing and filling)
- Popup uses `popup.html/js` to manage profiles, settings, and to trigger filling via `chrome.tabs.sendMessage`.
- Background service worker is present but not used yet.

Common code entry points:
- `content/content.js`
  - `handleFill(profile, settings)` orchestrates matching and filling
  - `fillField(node, answer)` applies the value to inputs/options
- `content/matcher.js`
  - `matchQuestionToAnswer(question, profile, { threshold })`
  - `bestMatchFromList(question, candidates)` for learned memory

## Permissions
- `activeTab`: to interact with the current tab when you click Fill
- `scripting` (via MV3 content scripts): to run on Google Forms pages
- `storage`: to save profiles and learned memory locally

## Privacy
- All data stays local in your browser (chrome.storage.local).
- No network requests or external services are used in this build.

## Roadmap (next steps)
- Mappings tab in popup to view/edit learned pairs and per-form overrides
- Export/Import profiles and learned memory (JSON)
- Optional encryption of stored data with a user password
- Embedding-based matcher (TF.js MiniLM/USE) as an opt-in for higher accuracy
- Better dropdown handling and date/phone normalization

## Tags
- chrome-extension
- manifest-v3
- google-forms
- autofill
- semantic-matching
- self-learning
- review-mode
- offline-first
- privacy
- javascript
- tailwindcss

---

Questions or ideas? Open the popup, tune the threshold, and try Review mode to preview suggestions before applying.
