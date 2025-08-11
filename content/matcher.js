// Lightweight semantic matcher without external ML libs.
// Exposes window.smartFormMatcher with matchQuestionToAnswer(question, profile)

window.smartFormMatcher = {
    isReady: true,

    init: async () => {
        // No async loading required in this lightweight matcher
        console.log('SmartFormMatcher (light) initialized.');
    },

    normalize(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    tokenize(text) {
        const stop = new Set(['the','a','an','and','or','of','for','to','in','on','is','are','your','you','me','my','we','us','our','with','at','as','by','please','enter','provide','select','choose','from']);
        let tokens = this.normalize(text).split(' ').filter(t => t && !stop.has(t));
        // very light stemming: drop trailing 's' for longer tokens
        tokens = tokens.map(t => (t.length > 4 && t.endsWith('s')) ? t.slice(0, -1) : t);
        return tokens;
    },

    addSynonyms(tokens) {
        const syn = new Map([
            ['name', ['fullname','full','first','last','surname','given','middle']],
            ['email', ['mail','e-mail','gmail','outlook']],
            ['phone', ['mobile','telephone','tel','contact','whatsapp','cell','number','no']],
            ['address', ['addr','location','street','st','city','state','province','zip','zipcode','postcode','pincode','country']],
            ['date', ['dob','birth','birthday','day','month','year']],
            ['college', ['university','school','institute','campus']],
            ['degree', ['qualification','education','course','program','major']],
            ['company', ['organization','organisation','employer','workplace','firm','corp','corporation']],
            ['role', ['position','title','job','designation']],
            ['experience', ['exp','years','yoe','workexp']],
            ['gpa', ['cgpa','grade','score']],
            ['github', ['git','gh','repository','repo','username','handle']],
            ['linkedin', ['linkdin','profile','li']],
            ['website', ['portfolio','site','url','link']],
            ['gender', ['sex']],
            ['nationality', ['citizenship']],
        ]);
        const out = new Set(tokens);
        for (const t of tokens) {
            if (syn.has(t)) for (const s of syn.get(t)) out.add(s);
        }
        return out; // set
    },

    getTypeHints(text) {
        const t = this.normalize(text);
        const hints = new Set();
        if (/(email|e\s?mail)/.test(t)) hints.add('email');
        if (/(phone|mobile|tel|whatsapp|contact)/.test(t)) hints.add('phone');
        if (/(dob|birth|date)/.test(t)) hints.add('date');
        if (/(github|git)/.test(t)) hints.add('github');
        if (/(linkedin)/.test(t)) hints.add('linkedin');
        if (/(portfolio|website|site|url|link)/.test(t)) hints.add('url');
        if (/(zip|zipcode|postcode|pincode)/.test(t)) hints.add('postal');
        return hints;
    },

    jaccard(setA, setB) {
        const a = new Set(setA);
        const b = new Set(setB);
        let inter = 0;
        for (const x of a) if (b.has(x)) inter++;
        const union = a.size + b.size - inter;
        return union === 0 ? 0 : inter / union;
    },

    levenshteinSim(a, b) {
        a = this.normalize(a); b = this.normalize(b);
        const m = a.length, n = b.length;
        if (m === 0 && n === 0) return 1;
        const dp = new Array(n + 1);
        for (let j = 0; j <= n; j++) dp[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = dp[0];
            dp[0] = i;
            for (let j = 1; j <= n; j++) {
                const tmp = dp[j];
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[j] = Math.min(
                    dp[j] + 1,         // deletion
                    dp[j - 1] + 1,     // insertion
                    prev + cost        // substitution
                );
                prev = tmp;
            }
        }
        const dist = dp[n];
        const maxLen = Math.max(m, n) || 1;
        return 1 - dist / maxLen;
    },

    scoreSimilarity(question, key) {
        const qTokens = this.addSynonyms(this.tokenize(question));
        const kTokens = this.addSynonyms(this.tokenize(key));
        const j = this.jaccard(qTokens, kTokens); // 0..1
        const qn = this.normalize(question);
        const kn = this.normalize(key);
        const contains = qn.includes(kn) || kn.includes(qn) ? 1 : 0;
        const lev = this.levenshteinSim(qn, kn); // 0..1
        // Type-hints bonus if both sides suggest same field type
        const qHints = this.getTypeHints(question);
        const kHints = this.getTypeHints(key);
        let typeBonus = 0;
        for (const h of qHints) if (kHints.has(h)) typeBonus = Math.max(typeBonus, 0.10);
        // Weighted combination; small bonus for substring containment and type hints
        const score = 0.52 * j + 0.33 * lev + 0.10 * contains + typeBonus;
        return Math.min(1, Math.max(0, score));
    },

    // Find best match from a list of candidate strings
    bestMatchFromList(question, candidates = []) {
        let best = { index: -1, score: 0 };
        for (let i = 0; i < candidates.length; i++) {
            const s = this.scoreSimilarity(question, candidates[i]);
            if (s > best.score) best = { index: i, score: s };
        }
        return best;
    },

    // Return best match object { key, value, score }
    matchQuestion(question, profile) {
        const profileKeys = Object.keys(profile || {});
        if (!profileKeys.length) return null;
        // Precompute normalized keys to save work
        let best = { key: null, value: null, score: 0 };
        for (const key of profileKeys) {
            const s = this.scoreSimilarity(question, key);
            if (s > best.score) best = { key, value: profile[key], score: s };
        }
        return best.key ? best : null;
    },

    matchQuestionToAnswer: async function(question, profile, options = {}) {
        // options: { threshold?: number }
        const threshold = typeof options.threshold === 'number' ? options.threshold : 0.55;
        const best = this.matchQuestion(question, profile);
        if (best && best.score >= threshold) return best.value;
        return null;
    }
};

window.smartFormMatcher.init();