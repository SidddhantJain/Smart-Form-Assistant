document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const tabBtns = {
        profiles: document.getElementById('tabBtn-profiles'),
        mappings: document.getElementById('tabBtn-mappings'),
        settings: document.getElementById('tabBtn-settings'),
    };
    const tabs = {
        profiles: document.getElementById('tab-profiles'),
        mappings: document.getElementById('tab-mappings'),
        settings: document.getElementById('tab-settings'),
    };
    const switchTab = (name) => {
        Object.keys(tabs).forEach(k => {
            tabs[k].classList.toggle('hidden', k !== name);
            tabBtns[k].classList.toggle('bg-indigo-600', k === name);
            tabBtns[k].classList.toggle('text-white', k === name);
            tabBtns[k].classList.toggle('border-indigo-600', k === name);
        });
    };
    Object.keys(tabBtns).forEach(k => tabBtns[k]?.addEventListener('click', () => switchTab(k)));
    switchTab('profiles');

    // Profiles UI (existing)
    const profileNameInput = document.getElementById('profileName');
    const fieldKeyInput = document.getElementById('fieldKey');
    const fieldValueInput = document.getElementById('fieldValue');
    const savedFieldsContainer = document.getElementById('savedFields');
    const addFieldBtn = document.getElementById('addField');
    const saveProfileBtn = document.getElementById('saveProfile');
    const profilesListDiv = document.getElementById('profilesList');
    const fillFormBtn = document.getElementById('fillForm');

    // Settings UI
    const reviewModeCheckbox = document.getElementById('reviewMode');
    const learningEnabledCheckbox = document.getElementById('learningEnabled');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');

    // Mappings UI
    const mappingSearch = document.getElementById('mappingSearch');
    const mappingsList = document.getElementById('mappingsList');
    const refreshMappingsBtn = document.getElementById('refreshMappings');
    const exportMappingsBtn = document.getElementById('exportMappings');
    const importFileInput = document.getElementById('importFile');
    const clearMappingsBtn = document.getElementById('clearMappings');

    let currentFields = {};

    const renderFields = () => {
        savedFieldsContainer.innerHTML = '';
        for (const key in currentFields) {
            const field = document.createElement('div');
            field.className = 'flex space-x-2 items-center mb-2';
            field.innerHTML = `
                <span class="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs">Key</span>
                <div class="flex-1">
                    <input type="text" value="${key}" disabled class="mt-1 block w-full rounded-md bg-gray-200 text-gray-600 shadow-sm sm:text-sm p-2">
                </div>
                <span class="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs">Value</span>
                <div class="flex-1">
                    <input type="text" value="${currentFields[key]}" disabled class="mt-1 block w-full rounded-md bg-gray-200 text-gray-600 shadow-sm sm:text-sm p-2">
                </div>
                <button class="remove-field-btn px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100">Remove</button>
            `;
            field.querySelector('.remove-field-btn').addEventListener('click', () => {
                delete currentFields[key];
                renderFields();
            });
            savedFieldsContainer.appendChild(field);
        }
    };

    const renderProfilesList = (profiles) => {
        profilesListDiv.innerHTML = '';
        if (Object.keys(profiles).length === 0) {
            profilesListDiv.innerHTML = '<p class="text-gray-500 text-sm">No profiles saved yet.</p>';
            return;
        }
        for (const name in profiles) {
            const profileDiv = document.createElement('div');
            profileDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded-md mb-2';
            profileDiv.innerHTML = `
                <span class="font-medium text-gray-800">${name}</span>
                <div class="flex space-x-2">
                    <button data-profile-name="${name}" class="load-profile-btn px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Load</button>
                    <button data-profile-name="${name}" class="delete-profile-btn px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100">Delete</button>
                </div>
            `;
            profilesListDiv.appendChild(profileDiv);
        }

        profilesListDiv.querySelectorAll('.load-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.profileName;
                const profile = profiles[name];
                profileNameInput.value = name;
                currentFields = { ...profile };
                renderFields();
                switchTab('profiles');
            });
        });

        profilesListDiv.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.profileName;
                if (confirm(`Delete profile "${name}"?`)) {
                    chrome.storage.local.get('profiles', (data) => {
                        const allProfiles = data.profiles || {};
                        delete allProfiles[name];
                        chrome.storage.local.set({ profiles: allProfiles }, () => {
                            loadProfiles();
                            if (profileNameInput.value === name) {
                                profileNameInput.value = '';
                                currentFields = {};
                                renderFields();
                            }
                        });
                    });
                }
            });
        });
    };

    const renderMappingsList = (items) => {
        mappingsList.innerHTML = '';
        if (!items.length) {
            mappingsList.innerHTML = '<p class="text-gray-500 text-sm">No learned pairs found.</p>';
            return;
        }
        items.forEach((m, idx) => {
            const row = document.createElement('div');
            row.className = 'bg-white rounded-md p-2 shadow flex flex-col';
            row.innerHTML = `
                <div class="flex items-start justify-between">
                    <span class="text-xs text-gray-500">${new Date(m.ts || Date.now()).toLocaleString()}</span>
                    <button class="delete-map px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100" data-idx="${idx}">Delete</button>
                </div>
                <div class="mt-1">
                    <span class="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs mr-1">Q</span>
                    <span class="text-gray-800">${m.q}</span>
                </div>
                <div class="mt-1">
                    <span class="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs mr-1">A</span>
                    <span class="text-gray-800">${m.a}</span>
                </div>
            `;
            row.querySelector('.delete-map').addEventListener('click', (e) => {
                const index = Number(e.target.dataset.idx);
                chrome.storage.local.get('learned', (data) => {
                    const learned = data.learned || [];
                    learned.splice(index, 1);
                    chrome.storage.local.set({ learned }, loadMappings);
                });
            });
            mappingsList.appendChild(row);
        });
    };

    const loadMappings = () => {
        chrome.storage.local.get('learned', (data) => {
            const learned = data.learned || [];
            const query = (mappingSearch.value || '').toLowerCase();
            const filtered = learned.filter(x => !query || x.q.toLowerCase().includes(query) || x.a.toLowerCase().includes(query));
            renderMappingsList(filtered);
        });
    };

    const loadProfiles = () => {
        chrome.storage.local.get(['profiles', 'settings'], (data) => {
            const profiles = data.profiles || {};
            renderProfilesList(profiles);

            const settings = data.settings || { reviewMode: false, learningEnabled: false, threshold: 0.55 };
            reviewModeCheckbox.checked = !!settings.reviewMode;
            learningEnabledCheckbox.checked = !!settings.learningEnabled;
            thresholdSlider.value = settings.threshold ?? 0.55;
            thresholdValue.textContent = Number(thresholdSlider.value).toFixed(2);
        });
    };

    mappingSearch.addEventListener('input', loadMappings);
    refreshMappingsBtn.addEventListener('click', loadMappings);

    exportMappingsBtn.addEventListener('click', () => {
        chrome.storage.local.get('learned', (data) => {
            const blob = new Blob([JSON.stringify(data.learned || [], null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'smart-form-assistant-mappings.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const arr = JSON.parse(reader.result);
                if (!Array.isArray(arr)) throw new Error('Invalid file');
                chrome.storage.local.get('learned', (data) => {
                    const learned = data.learned || [];
                    const merged = [...learned, ...arr.filter(x => x && typeof x.q === 'string' && typeof x.a === 'string')];
                    chrome.storage.local.set({ learned: merged }, () => {
                        importFileInput.value = '';
                        loadMappings();
                    });
                });
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    });

    clearMappingsBtn.addEventListener('click', () => {
        if (!confirm('Clear all learned mappings?')) return;
        chrome.storage.local.set({ learned: [] }, loadMappings);
    });

    const saveSettings = () => {
        const settings = {
            reviewMode: reviewModeCheckbox.checked,
            learningEnabled: learningEnabledCheckbox.checked,
            threshold: Number(thresholdSlider.value)
        };
        chrome.storage.local.set({ settings });
        return settings;
    };

    addFieldBtn.addEventListener('click', () => {
        const key = fieldKeyInput.value.trim();
        const value = fieldValueInput.value.trim();
        if (key && value) {
            currentFields[key] = value;
            renderFields();
            fieldKeyInput.value = '';
            fieldValueInput.value = '';
        }
    });

    saveProfileBtn.addEventListener('click', () => {
        const profileName = profileNameInput.value.trim();
        if (!profileName) {
            alert('Please enter a profile name.');
            return;
        }

        chrome.storage.local.get('profiles', (data) => {
            const profiles = data.profiles || {};
            profiles[profileName] = currentFields;
            chrome.storage.local.set({ profiles: profiles }, () => {
                loadProfiles();
            });
        });
    });

    fillFormBtn.addEventListener('click', () => {
        const profileName = profileNameInput.value.trim();
        // Use currentFields directly for filling, not just the saved profile
        if (!profileName || Object.keys(currentFields).length === 0) {
            alert('Please load or save a profile and add at least one field.');
            return;
        }

        const settings = saveSettings();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabId = tabs[0].id;
            // Use currentFields (live UI state) instead of only saved profile
            chrome.tabs.sendMessage(currentTabId, { action: 'FILL_FORM', profile: { ...currentFields }, settings });
        });
    });

    // Initial loads
    loadProfiles();
    loadMappings();
});