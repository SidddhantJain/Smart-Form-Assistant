document.addEventListener('DOMContentLoaded', () => {
    const profileNameInput = document.getElementById('profileName');
    const fieldKeyInput = document.getElementById('fieldKey');
    const fieldValueInput = document.getElementById('fieldValue');
    const savedFieldsContainer = document.getElementById('savedFields');
    const addFieldBtn = document.getElementById('addField');
    const saveProfileBtn = document.getElementById('saveProfile');
    const profilesListDiv = document.getElementById('profilesList');
    const fillFormBtn = document.getElementById('fillForm');

    const reviewModeCheckbox = document.getElementById('reviewMode');
    const learningEnabledCheckbox = document.getElementById('learningEnabled');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');

    let currentFields = {};

    const renderFields = () => {
        savedFieldsContainer.innerHTML = '';
        for (const key in currentFields) {
            const field = document.createElement('div');
            field.className = 'flex space-x-2 items-center mb-2';
            field.innerHTML = `
                <div class="flex-1">
                    <input type="text" value="${key}" disabled class="mt-1 block w-full rounded-md bg-gray-200 text-gray-600 shadow-sm sm:text-sm p-2">
                </div>
                <div class="flex-1">
                    <input type="text" value="${currentFields[key]}" disabled class="mt-1 block w-full rounded-md bg-gray-200 text-gray-600 shadow-sm sm:text-sm p-2">
                </div>
                <button class="remove-field-btn text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
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
                    <button data-profile-name="${name}" class="load-profile-btn text-indigo-500 hover:text-indigo-700">Load</button>
                    <button data-profile-name="${name}" class="delete-profile-btn text-red-500 hover:text-red-700">Delete</button>
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
            });
        });

        profilesListDiv.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.dataset.profileName;
                if (confirm(`Are you sure you want to delete profile "${name}"?`)) {
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

    thresholdSlider.addEventListener('input', () => {
        thresholdValue.textContent = Number(thresholdSlider.value).toFixed(2);
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
                console.log(`Profile "${profileName}" saved.`);
                loadProfiles();
            });
        });
    });

    fillFormBtn.addEventListener('click', () => {
        const profileName = profileNameInput.value.trim();
        if (!profileName) {
            alert('Please load or save a profile first.');
            return;
        }

        const settings = saveSettings();

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabId = tabs[0].id;
            chrome.storage.local.get('profiles', (data) => {
                const profileToFill = data.profiles[profileName];
                chrome.tabs.sendMessage(currentTabId, { action: 'FILL_FORM', profile: profileToFill, settings });
            });
        });
    });

    loadProfiles();
});