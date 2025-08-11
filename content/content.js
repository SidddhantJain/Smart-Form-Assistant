// This content script is injected into the Google Form page.
// It handles the form parsing and filling logic.

const HIGHLIGHT_CLASS = 'sfa-suggestion';

const ensureStyles = () => {
    if (document.getElementById('sfa-style')) return;
    const style = document.createElement('style');
    style.id = 'sfa-style';
    style.textContent = `
        .${HIGHLIGHT_CLASS} {
            outline: 2px dashed #3b82f6 !important;
            background: rgba(59,130,246,0.08) !important;
            transition: background 0.2s ease;
        }
        .sfa-pill { 
            display:inline-block; font-size:12px; 
            background:#e0e7ff; color:#1e3a8a; 
            border-radius:9999px; padding:2px 8px; margin-left:6px;
        }
    `;
    document.head.appendChild(style);
};

const QUESTION_ROOT_SELECTORS = [
    '.freebirdFormviewerComponentsQuestionBaseRoot',
    'div[role="listitem"]'
];
const TITLE_SELECTORS = [
    '.freebirdFormviewerComponentsQuestionBaseTitle',
    '.M7eMe',
    'div[role="heading"]'
];

const queryAny = (root, selectors) => {
    for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
    }
    return null;
};

const waitForQuestions = async (timeoutMs = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        for (const sel of QUESTION_ROOT_SELECTORS) {
            const nodes = document.querySelectorAll(sel);
            if (nodes && nodes.length) {
                return Array.from(nodes);
            }
        }
        await new Promise(r => setTimeout(r, 200));
    }
    // return empty if none found
    return [];
};

const getQuestionNodes = () => {
    for (const sel of QUESTION_ROOT_SELECTORS) {
        const n = document.querySelectorAll(sel);
        if (n && n.length) return Array.from(n);
    }
    return [];
};

const getQuestionText = (node) => {
    const title = queryAny(node, TITLE_SELECTORS);
    return title?.innerText?.trim() || '';
};

const learnPair = (questionText, answer) => new Promise((resolve) => {
    if (!questionText || !answer) return resolve();
    chrome.storage.local.get('learned', (data) => {
        const learned = data.learned || [];
        learned.push({ q: questionText, a: answer, ts: Date.now() });
        chrome.storage.local.set({ learned }, resolve);
    });
});

const findFromLearned = async (questionText, threshold, matcher) => new Promise((resolve) => {
    chrome.storage.local.get('learned', (data) => {
        const learned = data.learned || [];
        if (!learned.length) return resolve(null);
        const candidates = learned.map(x => x.q);
        const best = matcher.bestMatchFromList(questionText, candidates);
        if (best.score >= threshold) return resolve(learned[best.index].a);
        resolve(null);
    });
});

const handleFill = async (profile, settings = { reviewMode: false, learningEnabled: false, threshold: 0.55 }) => {
    // Wait for the matcher to be ready
    const waitForMatcher = async () => {
        const start = Date.now();
        while (!window.smartFormMatcher || !window.smartFormMatcher.isReady) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (Date.now() - start > 30000) throw new Error('Matcher not ready (timeout).');
        }
    };

    try {
        await waitForMatcher();
    } catch (e) {
        console.error(e);
        return;
    }

    ensureStyles();

    const threshold = typeof settings.threshold === 'number' ? settings.threshold : 0.55;
    const reviewMode = !!settings.reviewMode;
    const learningEnabled = !!settings.learningEnabled;

    // Wait for questions to appear if not yet present
    let questions = getQuestionNodes();
    if (!questions.length) {
        questions = await waitForQuestions(12000);
    }

    console.log(`[SFA] Detected ${questions.length} question nodes.`);
    if (!questions.length) {
        console.warn('[SFA] No questions detected. The page structure may have changed.');
        return;
    }

    if (!reviewMode) {
        // Clear previous highlights/pills if any (from earlier review runs)
        document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(n => n.classList.remove(HIGHLIGHT_CLASS));
        document.querySelectorAll('.sfa-pill').forEach(p => p.remove());
    }

    for (const q of questions) {
        const questionText = getQuestionText(q);
        if (!questionText) continue;

        // 1) Try learned memory first
        let matchedAnswer = await findFromLearned(questionText, threshold, window.smartFormMatcher);

        // 2) Then try profile
        if (!matchedAnswer && profile) {
            try {
                matchedAnswer = await window.smartFormMatcher.matchQuestionToAnswer(questionText, profile, { threshold });
            } catch (err) {
                console.warn('Semantic match failed, falling back to simple include match:', err);
                const lowerQ = questionText.toLowerCase();
                for (const key in profile) {
                    if (lowerQ.includes((key || '').toLowerCase())) {
                        matchedAnswer = profile[key];
                        break;
                    }
                }
            }
        }

        if (!matchedAnswer) continue;

        if (reviewMode) {
            // Highlight and attach a small pill for user review
            q.classList.add(HIGHLIGHT_CLASS);
            const titleEl = queryAny(q, TITLE_SELECTORS);
            if (titleEl && !titleEl.querySelector('.sfa-pill')) {
                const pill = document.createElement('span');
                pill.className = 'sfa-pill';
                pill.textContent = `Suggested: ${matchedAnswer}`;
                titleEl.appendChild(pill);
            }
            continue; // Only preview in review mode
        }

        // Autofill
        fillField(q, matchedAnswer);

        // Learn what we filled (if enabled)
        if (learningEnabled) {
            await learnPair(questionText, matchedAnswer);
        }
    }
};

// Support messages from popup via tabs.sendMessage
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'FILL_FORM' && message.profile) {
        handleFill(message.profile, message.settings);
    }
});

// Back-compat: support window.postMessage from injected script (if any)
window.addEventListener('message', async (event) => {
    if (event.data && event.data.action === 'FILL_FORM' && event.data.profile) {
        handleFill(event.data.profile, event.data.settings);
    }
});

// Fire input/change events so Google Forms registers edits
const triggerInputEvent = (element) => {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

const setNativeValue = (element, value) => {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
    } else {
        element.value = value;
    }
};

const fillField = (questionElement, answer) => {
    // Text inputs
    const textInput = questionElement.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[aria-label], input:not([type])');
    if (textInput) {
        textInput.focus();
        setNativeValue(textInput, answer);
        triggerInputEvent(textInput);
        return;
    }

    // Textarea
    const textArea = questionElement.querySelector('textarea');
    if (textArea) {
        textArea.focus();
        setNativeValue(textArea, answer);
        triggerInputEvent(textArea);
        return;
    }

    // Radios / Checkboxes
    const options = questionElement.querySelectorAll('[role="radio"], [role="checkbox"]');
    if (options.length) {
        const normalizedAnswer = String(answer).toLowerCase();
        for (const opt of options) {
            const txtEl = opt.querySelector('.freebirdFormviewerComponentsQuestionOptionText, .docssharedWizToggleLabeledLabelText');
            const optText = (txtEl ? txtEl.innerText : opt.getAttribute('aria-label') || '').trim().toLowerCase();
            if (!optText) continue;
            if (optText.includes(normalizedAnswer) || normalizedAnswer.includes(optText)) {
                opt.click();
                return;
            }
        }
    }

    // Dropdown (listbox)
    const listbox = questionElement.querySelector('[role="listbox"]');
    if (listbox) {
        listbox.click();
        const menuItems = document.querySelectorAll('[role="presentation"] [role="option"], [role="option"]');
        const normalizedAnswer = String(answer).toLowerCase();
        for (const item of menuItems) {
            const label = (item.innerText || item.getAttribute('aria-label') || '').trim().toLowerCase();
            if (label && (label.includes(normalizedAnswer) || normalizedAnswer.includes(label))) {
                item.click();
                return;
            }
        }
        // Close dropdown if nothing matched
        document.body.click();
    }
};