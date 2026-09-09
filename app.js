/*
 * ============================================================
 * BIG BROTHER SIMULATOR
 * APPLICATION CONTROLLER
 * ============================================================
 *
 * Current systems:
 *  - Season information
 *  - Houseguests
 *  - Houseguest ratings
 *  - Season rules
 *  - Relationships
 *  - Alliances
 *  - Saved seasons
 *  - Basic simulator event chain
 *
 * Future systems:
 *  - Competitions
 *  - Twists
 *  - Full simulation engine
 *  - Detailed season history
 *  - Final statistics
 * ============================================================
 */


/* ============================================================
   CONSTANTS
   ============================================================ */

const STORAGE_KEY = "bigBrotherSimulatorSeasons";

const STAT_KEYS = [
    "general",
    "physical",
    "mental",
    "social",
    "strategic"
];

const RELATIONSHIP_KEYS = [
    "friendship",
    "trust",
    "loyalty",
    "rivalry",
    "attraction",
    "respect"
];

const EVENT_CHAIN = [
    {
        id: "hoh",
        label: "HOH",
        type: "HOH",
        title: "Head of Household"
    },
    {
        id: "nominations",
        label: "Nominations",
        type: "NOMINATIONS",
        title: "Nomination Ceremony"
    },
    {
        id: "pov-players",
        label: "POV Players",
        type: "POV PLAYERS",
        title: "Power of Veto Players"
    },
    {
        id: "pov",
        label: "POV",
        type: "POV",
        title: "Power of Veto Competition"
    },
    {
        id: "veto-ceremony",
        label: "Veto Ceremony",
        type: "VETO CEREMONY",
        title: "Veto Ceremony"
    },
    {
        id: "eviction",
        label: "Eviction",
        type: "EVICTION",
        title: "Live Eviction"
    }
];


/* ============================================================
   APPLICATION STATE
   ============================================================ */

let savedSeasons = [];

let currentSeason = null;

let editingSeasonId = null;

let currentHouseguestId = 0;

let editingRelationshipId = null;

let creatorRelationships = [];

let editingAllianceId = null;

let creatorAlliances = [];


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    loadSavedSeasons();

    setupImagePreviews();

    setupRuleControls();

    setupRelationshipControls();

    setupAllianceControls();

    initializeHouseguestEditor();

    renderSavedSeasons();

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();

    renderRelationships();

    renderAlliances();

    updateRelationshipMetricDisplays();

    updateAllianceStrength();

});


/* ============================================================
   GENERAL DOM HELPERS
   ============================================================ */

function getElement(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   PAGE NAVIGATION
   ============================================================ */

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active-page");
    });

    const page = getElement(pageId);

    if (page) {
        page.classList.add("active-page");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadSavedSeasons() {

    try {

        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            savedSeasons = [];
            return;
        }

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
            savedSeasons = parsed.map(normalizeSeason);
        } else {
            savedSeasons = [];
        }

    } catch (error) {

        console.error(
            "Could not load saved seasons:",
            error
        );

        savedSeasons = [];
    }
}


function persistSavedSeasons() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedSeasons)
        );

    } catch (error) {

        console.error(
            "Could not save seasons:",
            error
        );
    }
}


/* ============================================================
   SEASON NORMALIZATION
   ============================================================ */

function normalizeSeason(season) {

    const normalized = {
        ...season
    };

    normalized.houseguests = Array.isArray(
        season.houseguests
    )
        ? season.houseguests
        : [];

    normalized.relationships = Array.isArray(
        season.relationships
    )
        ? season.relationships
        : [];

    normalized.alliances = Array.isArray(
        season.alliances
    )
        ? season.alliances
        : [];

    normalized.competitions = season.competitions || {
        hoh: [],
        pov: [],
        safety: [],
        luxury: [],
        finalHoh: []
    };

    normalized.twists = Array.isArray(
        season.twists
    )
        ? season.twists
        : [];

    normalized.rules = {
        finalists: 2,
        jurySize: 7,
        vetoEnabled: true,
        safetyCompetitionEnabled: false,
        battleBackEnabled: false,
        doubleEvictionEnabled: false,
        nomineesPerWeek: 2,
        vetoPlayers: 6,
        evictionType: "house",
        startingHOH: "random",
        specificStartingHOH: "",
        juryVotingEnabled: true,
        ...(season.rules || {})
    };

    normalized.simulation = {
        started: false,
        completed: false,
        currentWeek: 1,
        currentPhase: "setup",
        currentEventIndex: 0,
        history: [],
        finalPlacements: [],
        winner: null,
        runnerUp: null,
        jury: [],
        finalists: [],
        currentHOH: null,
        currentNominees: [],
        currentPOVPlayers: [],
        currentPOVWinner: null,
        currentSafetyWinner: null,
        currentEviction: null,
        ...(season.simulation || {})
    };

    normalized.alliances = normalized.alliances.map(
        normalizeAlliance
    );

    normalized.relationships = normalized.relationships.map(
        normalizeRelationship
    );

    return normalized;
}


/* ============================================================
   SAVED SEASONS
   ============================================================ */

function renderSavedSeasons() {

    const container = getElement(
        "saved-seasons-container"
    );

    if (!container) {
        return;
    }

    if (!savedSeasons.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    🏠
                </div>

                <h3>
                    No Saved Seasons
                </h3>

                <p>
                    Create your first Big Brother season
                    to get started.
                </p>

                <button
                    type="button"
                    class="primary-button"
                    onclick="showPage('creator-page')"
                >
                    Create Season
                </button>

            </div>
        `;

        return;
    }

    container.innerHTML = savedSeasons.map(season => {

        const castCount =
            season.houseguests.length;

        const allianceCount =
            season.alliances.length;

        const relationshipCount =
            season.relationships.length;

        const backgroundStyle =
            season.background
                ? `style="background-image:url('${escapeHtml(season.background)}')"`
                : "";

        return `
            <article
                class="saved-season-card"
                ${backgroundStyle}
            >

                <div class="saved-season-card-overlay"></div>

                <div class="saved-season-card-content">

                    ${
                        season.logo
                            ? `
                                <img
                                    class="saved-season-logo"
                                    src="${escapeHtml(season.logo)}"
                                    alt="${escapeHtml(season.name)} logo"
                                >
                            `
                            : ""
                    }

                    <div class="saved-season-info">

                        <h3>
                            ${escapeHtml(season.name || "Untitled Season")}
                        </h3>

                        <p>
                            ${escapeHtml(season.theme || "Custom Season")}
                        </p>

                        <div class="saved-season-meta">

                            <span>
                                ${castCount} Houseguests
                            </span>

                            <span>
                                ${relationshipCount} Relationships
                            </span>

                            <span>
                                ${allianceCount} Alliances
                            </span>

                        </div>

                    </div>

                    <div class="saved-season-actions">

                        <button
                            type="button"
                            class="primary-button"
                            onclick="openSeason('${season.id}')"
                        >
                            Open
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            onclick="editSeason('${season.id}')"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="danger-button"
                            onclick="deleteSeason('${season.id}')"
                        >
                            Delete
                        </button>

                    </div>

                </div>

            </article>
        `;

    }).join("");
}


/* ============================================================
   CREATE / RESET SEASON
   ============================================================ */

function resetSeasonCreator() {

    currentSeason = null;

    editingSeasonId = null;

    currentHouseguestId = 0;

    creatorRelationships = [];

    editingRelationshipId = null;

    creatorAlliances = [];

    editingAllianceId = null;

    const fields = [
        "season-name",
        "season-theme",
        "season-description",
        "season-logo",
        "season-background"
    ];

    fields.forEach(id => {

        const element = getElement(id);

        if (element) {
            element.value = "";
        }

    });

    resetSeasonRules();

    const editor = getElement(
        "houseguest-editor"
    );

    if (editor) {
        editor.innerHTML = "";
    }

    const countInput = getElement(
        "houseguest-count"
    );

    if (countInput) {
        countInput.value = 16;
    }

    initializeHouseguestEditor();

    resetRelationshipForm();

    resetAllianceForm();

    renderRelationships();

    renderAlliances();

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();

    updateSeasonLogoPreview("");

    showPage("creator-page");
}


function initializeHouseguestEditor() {

    const editor = getElement(
        "houseguest-editor"
    );

    if (!editor) {
        return;
    }

    if (editor.children.length > 0) {
        updateHouseguestNumbers();
        return;
    }

    const countInput = getElement(
        "houseguest-count"
    );

    const count = countInput
        ? Math.max(
            2,
            Math.min(
                100,
                Number(countInput.value) || 16
            )
        )
        : 16;

    for (let i = 0; i < count; i++) {
        addHouseguest();
    }

    updateHouseguestNumbers();
}


/* ============================================================
   HOUSEGUEST EDITOR
   ============================================================ */

function createDefaultHouseguest() {

    return {
        name: "",
        image: "",
        age: "",
        occupation: "",
        ratings: {
            general: 5,
            physical: 5,
            mental: 5,
            social: 5,
            strategic: 5
        },
        status: "active",
        placement: null,
        weeksInGame: 0,
        hohWins: 0,
        povWins: 0,
        safetyWins: 0,
        nominationCount: 0,
        vetoUsedOn: [],
        evictionVotesReceived: 0
    };
}


function addHouseguest(data = null) {

    const editor = getElement(
        "houseguest-editor"
    );

    if (!editor) {
        return;
    }

    const houseguest =
        data || createDefaultHouseguest();

    const id =
        houseguest.id ||
        `hg-${++currentHouseguestId}`;

    const card = document.createElement("article");

    card.className = "houseguest-card";

    card.dataset.houseguestId = id;

    card.innerHTML = `
        <div class="houseguest-card-header">

            <div>
                <span class="houseguest-number">
                    Houseguest
                </span>

                <h3 class="houseguest-title">
                    Houseguest
                </h3>
            </div>

            <button
                type="button"
                class="danger-button"
                onclick="removeHouseguest('${id}')"
            >
                Remove
            </button>

        </div>


        <div class="houseguest-card-body">

            <div class="houseguest-photo-section">

                <div
                    class="houseguest-photo-preview"
                    id="photo-preview-${id}"
                >
                    ${
                        houseguest.image
                            ? `
                                <img
                                    src="${escapeHtml(houseguest.image)}"
                                    alt="Houseguest"
                                >
                            `
                            : `
                                <span>
                                    No Photo
                                </span>
                            `
                    }
                </div>

                <input
                    type="url"
                    class="houseguest-image-input"
                    data-field="image"
                    placeholder="Houseguest image URL"
                    value="${escapeHtml(houseguest.image || "")}"
                    oninput="updateHouseguestImage('${id}', this.value)"
                >

            </div>


            <div class="houseguest-basic-info">

                <div class="form-group">

                    <label>
                        Name
                    </label>

                    <input
                        type="text"
                        data-field="name"
                        placeholder="Houseguest name"
                        value="${escapeHtml(houseguest.name || "")}"
                        oninput="updateHouseguestNumbers()"
                    >

                </div>


                <div class="form-group">

                    <label>
                        Age
                    </label>

                    <input
                        type="number"
                        data-field="age"
                        min="18"
                        max="100"
                        value="${escapeHtml(houseguest.age || "")}"
                    >

                </div>


                <div class="form-group">

                    <label>
                        Occupation
                    </label>

                    <input
                        type="text"
                        data-field="occupation"
                        placeholder="Occupation"
                        value="${escapeHtml(houseguest.occupation || "")}"
                    >

                </div>

            </div>


            <div class="houseguest-ratings">

                <h4>
                    Ratings
                </h4>

                <div class="ratings-grid">

                    ${STAT_KEYS.map(key => `
                        <div class="rating-group">

                            <label>
                                ${capitalize(key)}
                            </label>

                            <input
                                type="number"
                                data-rating="${key}"
                                min="1"
                                max="10"
                                value="${getRatingValue(
                                    houseguest.ratings,
                                    key
                                )}"
                            >

                        </div>
                    `).join("")}

                </div>

            </div>

        </div>
    `;

    editor.appendChild(card);

    currentHouseguestId++;

    updateHouseguestNumbers();

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();

    updateSpecificHOHOptions();
}


function getRatingValue(ratings, key) {

    if (!ratings) {
        return 5;
    }

    const value = Number(ratings[key]);

    if (!Number.isFinite(value)) {
        return 5;
    }

    return Math.max(
        1,
        Math.min(10, value)
    );
}


function removeHouseguest(id) {

    const card = document.querySelector(
        `.houseguest-card[data-houseguest-id="${id}"]`
    );

    if (card) {
        card.remove();
    }

    creatorRelationships =
        creatorRelationships.filter(
            relationship =>
                relationship.from !== id &&
                relationship.to !== id
        );

    creatorAlliances =
        creatorAlliances.map(alliance => ({
            ...alliance,
            members: alliance.members.filter(
                memberId => memberId !== id
            )
        })).filter(
            alliance => alliance.members.length >= 2
        );

    if (
        editingRelationshipId &&
        !creatorRelationships.some(
            relationship =>
                relationship.id === editingRelationshipId
        )
    ) {
        resetRelationshipForm();
    }

    if (
        editingAllianceId &&
        !creatorAlliances.some(
            alliance =>
                alliance.id === editingAllianceId
        )
    ) {
        resetAllianceForm();
    }

    updateHouseguestNumbers();

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();

    renderRelationships();

    renderAlliances();

    updateSpecificHOHOptions();

    updateAllianceStrength();
}


function updateHouseguestNumbers() {

    const cards = document.querySelectorAll(
        ".houseguest-card"
    );

    cards.forEach((card, index) => {

        const number = card.querySelector(
            ".houseguest-number"
        );

        const title = card.querySelector(
            ".houseguest-title"
        );

        const nameInput = card.querySelector(
            '[data-field="name"]'
        );

        const name =
            nameInput?.value.trim();

        if (number) {
            number.textContent =
                `Houseguest ${index + 1}`;
        }

        if (title) {
            title.textContent =
                name || `Houseguest ${index + 1}`;
        }

    });

    const countInput = getElement(
        "houseguest-count"
    );

    if (countInput) {
        countInput.value = cards.length;
    }
}


function updateHouseguestCount() {

    const countInput = getElement(
        "houseguest-count"
    );

    const editor = getElement(
        "houseguest-editor"
    );

    if (!countInput || !editor) {
        return;
    }

    let target =
        parseInt(countInput.value, 10);

    if (!Number.isFinite(target)) {
        target = 16;
    }

    target = Math.max(
        2,
        Math.min(100, target)
    );

    countInput.value = target;

    const current =
        editor.querySelectorAll(
            ".houseguest-card"
        ).length;

    if (target > current) {

        for (let i = current; i < target; i++) {
            addHouseguest();
        }

    } else if (target < current) {

        const cards = [
            ...editor.querySelectorAll(
                ".houseguest-card"
            )
        ];

        for (
            let i = cards.length - 1;
            i >= target;
            i--
        ) {

            const id =
                cards[i].dataset.houseguestId;

            removeHouseguest(id);
        }
    }

    updateHouseguestNumbers();

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();
}


function collectHouseguests() {

    const cards = document.querySelectorAll(
        ".houseguest-card"
    );

    return [...cards].map((card, index) => {

        const getField = field =>
            card.querySelector(
                `[data-field="${field}"]`
            );

        const name =
            getField("name")?.value.trim() || "";

        const image =
            getField("image")?.value.trim() || "";

        const age =
            getField("age")?.value || "";

        const occupation =
            getField("occupation")?.value.trim() || "";

        const ratings = {};

        STAT_KEYS.forEach(key => {

            const input = card.querySelector(
                `[data-rating="${key}"]`
            );

            ratings[key] =
                Math.max(
                    1,
                    Math.min(
                        10,
                        Number(input?.value) || 5
                    )
                );
        });

        return {
            id:
                card.dataset.houseguestId ||
                `hg-${index + 1}`,

            name,
            image,
            age,
            occupation,
            ratings,

            status: "active",
            placement: null,
            weeksInGame: 0,
            hohWins: 0,
            povWins: 0,
            safetyWins: 0,
            nominationCount: 0,
            vetoUsedOn: [],
            evictionVotesReceived: 0
        };

    });
}


function updateHouseguestImage(id, url) {

    const preview = getElement(
        `photo-preview-${id}`
    );

    if (!preview) {
        return;
    }

    const cleanUrl =
        String(url || "").trim();

    if (!cleanUrl) {
        showHouseguestPlaceholder(id);
        return;
    }

    preview.innerHTML = `
        <img
            src="${escapeHtml(cleanUrl)}"
            alt="Houseguest"
            onerror="showHouseguestPlaceholder('${id}')"
        >
    `;
}


function showHouseguestPlaceholder(id) {

    const preview = getElement(
        `photo-preview-${id}`
    );

    if (!preview) {
        return;
    }

    preview.innerHTML = `
        <span>
            No Photo
        </span>
    `;
}


/* ============================================================
   IMAGE PREVIEWS
   ============================================================ */

function setupImagePreviews() {

    const logoInput =
        getElement("season-logo");

    if (logoInput) {

        logoInput.addEventListener(
            "input",
            () => {
                updateSeasonLogoPreview(
                    logoInput.value
                );
            }
        );
    }

    const backgroundInput =
        getElement("season-background");

    if (backgroundInput) {

        backgroundInput.addEventListener(
            "input",
            () => {
                updateSeasonBackgroundPreview(
                    backgroundInput.value
                );
            }
        );
    }
}


function updateSeasonLogoPreview(url) {

    const container =
        getElement("season-logo-preview");

    const image =
        getElement("season-logo-preview-image");

    if (!container || !image) {
        return;
    }

    const cleanUrl =
        String(url || "").trim();

    if (!cleanUrl) {

        image.removeAttribute("src");

        container.classList.remove(
            "has-image"
        );

        return;
    }

    image.src = cleanUrl;

    image.onerror = () => {
        container.classList.remove(
            "has-image"
        );
    };

    image.onload = () => {
        container.classList.add(
            "has-image"
        );
    };
}


function updateSeasonBackgroundPreview(url) {

    const creator =
        getElement("creator-page");

    if (!creator) {
        return;
    }

    const cleanUrl =
        String(url || "").trim();

    if (cleanUrl) {

        creator.style.setProperty(
            "--season-background-image",
            `url("${cleanUrl}")`
        );

    } else {

        creator.style.removeProperty(
            "--season-background-image"
        );
    }
}


/* ============================================================
   SEASON RULES
   ============================================================ */

function setupRuleControls() {

    const nominees =
        getElement("rule-nominees");

    if (nominees) {

        nominees.addEventListener(
            "change",
            updateCustomNomineesVisibility
        );
    }

    const vetoPlayers =
        getElement("rule-veto-players");

    if (vetoPlayers) {

        vetoPlayers.addEventListener(
            "change",
            updateCustomVetoPlayersVisibility
        );
    }

    const startingHOH =
        getElement("rule-starting-hoh");

    if (startingHOH) {

        startingHOH.addEventListener(
            "change",
            updateSpecificHOHVisibility
        );
    }

    const count =
        getElement("houseguest-count");

    if (count) {

        count.addEventListener(
            "change",
            updateHouseguestCount
        );
    }

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();
}


function resetSeasonRules() {

    const defaults = {
        "rule-finalists": 2,
        "rule-jury-size": 7,
        "rule-nominees": "2",
        "rule-custom-nominees": 2,
        "rule-veto-players": "6",
        "rule-custom-veto-players": 6,
        "rule-eviction-type": "house",
        "rule-starting-hoh": "random",
        "rule-specific-hoh": ""
    };

    Object.entries(defaults).forEach(
        ([id, value]) => {

            const element = getElement(id);

            if (element) {
                element.value = value;
            }

        }
    );

    const toggles = {
        "rule-veto-enabled": true,
        "rule-safety-enabled": false,
        "rule-battle-back": false,
        "rule-double-eviction": false,
        "rule-jury-voting": true
    };

    Object.entries(toggles).forEach(
        ([id, value]) => {

            const element = getElement(id);

            if (element) {
                element.checked = value;
            }

        }
    );

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();

    updateSpecificHOHOptions();
}


function collectSeasonRules() {

    const nominees =
        getElement("rule-nominees");

    const vetoPlayers =
        getElement("rule-veto-players");

    const finalists =
        Number(
            getElement("rule-finalists")?.value
        ) || 2;

    const jurySize =
        Number(
            getElement("rule-jury-size")?.value
        ) || 7;

    let nomineesPerWeek =
        nominees?.value === "custom"
            ? Number(
                getElement(
                    "rule-custom-nominees"
                )?.value
            ) || 2
            : Number(nominees?.value) || 2;

    let vetoPlayerCount =
        vetoPlayers?.value === "custom"
            ? Number(
                getElement(
                    "rule-custom-veto-players"
                )?.value
            ) || 6
            : Number(vetoPlayers?.value) || 6;

    return {

        finalists: Math.max(
            2,
            finalists
        ),

        jurySize: Math.max(
            0,
            jurySize
        ),

        vetoEnabled:
            getElement(
                "rule-veto-enabled"
            )?.checked ?? true,

        safetyCompetitionEnabled:
            getElement(
                "rule-safety-enabled"
            )?.checked ?? false,

        battleBackEnabled:
            getElement(
                "rule-battle-back"
            )?.checked ?? false,

        doubleEvictionEnabled:
            getElement(
                "rule-double-eviction"
            )?.checked ?? false,

        nomineesPerWeek:
            Math.max(
                1,
                nomineesPerWeek
            ),

        vetoPlayers:
            Math.max(
                2,
                vetoPlayerCount
            ),

        evictionType:
            getElement(
                "rule-eviction-type"
            )?.value || "house",

        startingHOH:
            getElement(
                "rule-starting-hoh"
            )?.value || "random",

        specificStartingHOH:
            getElement(
                "rule-specific-hoh"
            )?.value || "",

        juryVotingEnabled:
            getElement(
                "rule-jury-voting"
            )?.checked ?? true
    };
}


function updateCustomNomineesVisibility() {

    const selector =
        getElement("rule-nominees");

    const container =
        getElement(
            "custom-nominees-container"
        );

    if (!selector || !container) {
        return;
    }

    container.style.display =
        selector.value === "custom"
            ? ""
            : "none";
}


function updateCustomVetoPlayersVisibility() {

    const selector =
        getElement("rule-veto-players");

    const container =
        getElement(
            "custom-veto-players-container"
        );

    if (!selector || !container) {
        return;
    }

    container.style.display =
        selector.value === "custom"
            ? ""
            : "none";
}


function updateSpecificHOHVisibility() {

    const selector =
        getElement("rule-starting-hoh");

    const container =
        getElement(
            "specific-hoh-container"
        );

    if (!selector || !container) {
        return;
    }

    container.style.display =
        selector.value === "specific"
            ? ""
            : "none";

    if (selector.value === "specific") {
        populateSpecificHOHOptions();
    }
}


function populateSpecificHOHOptions() {

    const select =
        getElement("rule-specific-hoh");

    if (!select) {
        return;
    }

    const current =
        select.value;

    const houseguests =
        collectHouseguests();

    select.innerHTML = `
        <option value="">
            Select Houseguest
        </option>
    `;

    houseguests.forEach(houseguest => {

        if (!houseguest.name.trim()) {
            return;
        }

        const option =
            document.createElement("option");

        option.value =
            houseguest.id;

        option.textContent =
            houseguest.name;

        select.appendChild(option);
    });

    if (
        houseguests.some(
            houseguest =>
                houseguest.id === current
        )
    ) {
        select.value = current;
    }
}


function updateSpecificHOHOptions() {
    populateSpecificHOHOptions();
}


function loadSeasonRules(rules) {

    const normalized = {
        ...{
            finalists: 2,
            jurySize: 7,
            vetoEnabled: true,
            safetyCompetitionEnabled: false,
            battleBackEnabled: false,
            doubleEvictionEnabled: false,
            nomineesPerWeek: 2,
            vetoPlayers: 6,
            evictionType: "house",
            startingHOH: "random",
            specificStartingHOH: "",
            juryVotingEnabled: true
        },
        ...(rules || {})
    };

    const setValue = (id, value) => {

        const element = getElement(id);

        if (element) {
            element.value = value;
        }
    };

    const setChecked = (id, value) => {

        const element = getElement(id);

        if (element) {
            element.checked = Boolean(value);
        }
    };

    setValue(
        "rule-finalists",
        normalized.finalists
    );

    setValue(
        "rule-jury-size",
        normalized.jurySize
    );

    setValue(
        "rule-eviction-type",
        normalized.evictionType
    );

    setValue(
        "rule-starting-hoh",
        normalized.startingHOH
    );

    setValue(
        "rule-specific-hoh",
        normalized.specificStartingHOH
    );

    setChecked(
        "rule-veto-enabled",
        normalized.vetoEnabled
    );

    setChecked(
        "rule-safety-enabled",
        normalized.safetyCompetitionEnabled
    );

    setChecked(
        "rule-battle-back",
        normalized.battleBackEnabled
    );

    setChecked(
        "rule-double-eviction",
        normalized.doubleEvictionEnabled
    );

    setChecked(
        "rule-jury-voting",
        normalized.juryVotingEnabled
    );

    const standardNominees =
        [2, 3].includes(
            Number(normalized.nomineesPerWeek)
        );

    setValue(
        "rule-nominees",
        standardNominees
            ? String(normalized.nomineesPerWeek)
            : "custom"
    );

    setValue(
        "rule-custom-nominees",
        normalized.nomineesPerWeek
    );

    const standardVeto =
        [4, 5, 6].includes(
            Number(normalized.vetoPlayers)
        );

    setValue(
        "rule-veto-players",
        standardVeto
            ? String(normalized.vetoPlayers)
            : "custom"
    );

    setValue(
        "rule-custom-veto-players",
        normalized.vetoPlayers
    );

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();

    populateSpecificHOHOptions();
}


/* ============================================================
   RELATIONSHIPS
   ============================================================ */

function setupRelationshipControls() {

    const metricMap = {
        friendship:
            "relationship-friendship",

        trust:
            "relationship-trust",

        loyalty:
            "relationship-loyalty",

        rivalry:
            "relationship-rivalry",

        attraction:
            "relationship-attraction",

        respect:
            "relationship-respect"
    };

    Object.entries(metricMap).forEach(
        ([key, id]) => {

            const input =
                getElement(id);

            if (!input) {
                return;
            }

            input.addEventListener(
                "input",
                () => {
                    updateRelationshipMetricDisplays();
                }
            );
        }
    );

    const from =
        getElement("relationship-from");

    const to =
        getElement("relationship-to");

    if (from) {
        from.addEventListener(
            "change",
            updateRelationshipFormForPair
        );
    }

    if (to) {
        to.addEventListener(
            "change",
            updateRelationshipFormForPair
        );
    }
}


function normalizeRelationship(
    relationship,
    index = 0
) {

    return {
        id:
            relationship?.id ||
            `relationship-${Date.now()}-${index}`,

        from:
            relationship?.from || "",

        to:
            relationship?.to || "",

        friendship:
            clamp(
                relationship?.friendship,
                0,
                10,
                5
            ),

        trust:
            clamp(
                relationship?.trust,
                0,
                10,
                5
            ),

        loyalty:
            clamp(
                relationship?.loyalty,
                0,
                10,
                5
            ),

        rivalry:
            clamp(
                relationship?.rivalry,
                0,
                10,
                0
            ),

        attraction:
            clamp(
                relationship?.attraction,
                0,
                10,
                0
            ),

        respect:
            clamp(
                relationship?.respect,
                0,
                10,
                5
            )
    };
}


function clamp(
    value,
    min,
    max,
    fallback
) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.max(
        min,
        Math.min(max, number)
    );
}


function calculateRelationshipOverall(
    relationship
) {

    const positive =
        (
            Number(relationship.friendship) +
            Number(relationship.trust) +
            Number(relationship.loyalty) +
            Number(relationship.respect)
        ) / 4;

    /*
     * Rivalry reduces the overall relationship.
     *
     * Attraction is intentionally kept separate.
     * It can later influence showmances or strategic
     * behavior without automatically making two players
     * "better friends."
     */

    const adjusted =
        positive -
        (Number(relationship.rivalry) * 0.5);

    return Math.max(
        0,
        Math.min(
            10,
            Math.round(adjusted * 10) / 10
        )
    );
}


function getCurrentCreatorHouseguests() {

    return collectHouseguests();
}


function refreshRelationshipHouseguestOptions() {

    const from =
        getElement("relationship-from");

    const to =
        getElement("relationship-to");

    if (!from || !to) {
        return;
    }

    const currentFrom =
        from.value;

    const currentTo =
        to.value;

    const houseguests =
        getCurrentCreatorHouseguests()
            .filter(
                houseguest =>
                    houseguest.name.trim()
            );

    const createOptions = () => {

        const fragment =
            document.createDocumentFragment();

        const placeholder =
            document.createElement("option");

        placeholder.value = "";

        placeholder.textContent =
            "Select Houseguest";

        fragment.appendChild(
            placeholder
        );

        houseguests.forEach(
            houseguest => {

                const option =
                    document.createElement("option");

                option.value =
                    houseguest.id;

                option.textContent =
                    houseguest.name;

                fragment.appendChild(
                    option
                );
            }
        );

        return fragment;
    };

    from.innerHTML = "";

    to.innerHTML = "";

    from.appendChild(
        createOptions()
    );

    to.appendChild(
        createOptions()
    );

    if (
        houseguests.some(
            houseguest =>
                houseguest.id === currentFrom
        )
    ) {
        from.value = currentFrom;
    }

    if (
        houseguests.some(
            houseguest =>
                houseguest.id === currentTo
        )
    ) {
        to.value = currentTo;
    }

    const disabled =
        houseguests.length < 2;

    from.disabled = disabled;

    to.disabled = disabled;

    updateRelationshipFormForPair();
}


function getRelationshipFromForm() {

    const relationship = {

        from:
            getElement(
                "relationship-from"
            )?.value || "",

        to:
            getElement(
                "relationship-to"
            )?.value || "",

        friendship:
            Number(
                getElement(
                    "relationship-friendship"
                )?.value
            ) || 0,

        trust:
            Number(
                getElement(
                    "relationship-trust"
                )?.value
            ) || 0,

        loyalty:
            Number(
                getElement(
                    "relationship-loyalty"
                )?.value
            ) || 0,

        rivalry:
            Number(
                getElement(
                    "relationship-rivalry"
                )?.value
            ) || 0,

        attraction:
            Number(
                getElement(
                    "relationship-attraction"
                )?.value
            ) || 0,

        respect:
            Number(
                getElement(
                    "relationship-respect"
                )?.value
            ) || 0
    };

    return normalizeRelationship(
        relationship,
        0
    );
}


function setRelationshipForm(
    relationship
) {

    const normalized =
        normalizeRelationship(
            relationship
        );

    const values = {
        "relationship-from":
            normalized.from,

        "relationship-to":
            normalized.to,

        "relationship-friendship":
            normalized.friendship,

        "relationship-trust":
            normalized.trust,

        "relationship-loyalty":
            normalized.loyalty,

        "relationship-rivalry":
            normalized.rivalry,

        "relationship-attraction":
            normalized.attraction,

        "relationship-respect":
            normalized.respect
    };

    Object.entries(values).forEach(
        ([id, value]) => {

            const element =
                getElement(id);

            if (element) {
                element.value = value;
            }
        }
    );

    updateRelationshipMetricDisplays();
}


function updateRelationshipMetricDisplays() {

    const keys =
        RELATIONSHIP_KEYS;

    keys.forEach(key => {

        const input =
            getElement(
                `relationship-${key}`
            );

        const output =
            getElement(
                `relationship-${key}-value`
            );

        if (input && output) {
            output.textContent =
                input.value;
        }
    });

    const relationship =
        getRelationshipFromForm();

    const overall =
        calculateRelationshipOverall(
            relationship
        );

    const overallElement =
        getElement(
            "relationship-overall"
        );

    const fill =
        getElement(
            "relationship-overall-fill"
        );

    if (overallElement) {
        overallElement.textContent =
            `${overall.toFixed(1)} / 10`;
    }

    if (fill) {
        fill.style.width =
            `${overall * 10}%`;
    }
}


function updateRelationshipFormForPair() {

    const from =
        getElement(
            "relationship-from"
        )?.value;

    const to =
        getElement(
            "relationship-to"
        )?.value;

    if (!from || !to || from === to) {
        updateRelationshipMetricDisplays();
        return;
    }

    /*
     * When creating a new relationship, automatically load
     * an existing A → B relationship if one exists.
     *
     * The reverse B → A relationship remains independent.
     */

    if (!editingRelationshipId) {

        const existing =
            creatorRelationships.find(
                relationship =>
                    relationship.from === from &&
                    relationship.to === to
            );

        if (existing) {
            setRelationshipForm(existing);
        }
    }
}


function saveRelationship() {

    const from =
        getElement(
            "relationship-from"
        )?.value || "";

    const to =
        getElement(
            "relationship-to"
        )?.value || "";

    if (!from || !to) {

        alert(
            "Please select both houseguests."
        );

        return;
    }

    if (from === to) {

        alert(
            "Houseguest A and Houseguest B must be different."
        );

        return;
    }

    const houseguests =
        getCurrentCreatorHouseguests();

    const fromExists =
        houseguests.some(
            houseguest =>
                houseguest.id === from
        );

    const toExists =
        houseguests.some(
            houseguest =>
                houseguest.id === to
        );

    if (!fromExists || !toExists) {

        alert(
            "Both selected houseguests must exist."
        );

        return;
    }

    const relationship =
        getRelationshipFromForm();

    const existingIndex =
        editingRelationshipId
            ? creatorRelationships.findIndex(
                item =>
                    item.id ===
                    editingRelationshipId
            )
            : creatorRelationships.findIndex(
                item =>
                    item.from ===
                        relationship.from &&
                    item.to ===
                        relationship.to
            );

    if (existingIndex >= 0) {

        relationship.id =
            creatorRelationships[
                existingIndex
            ].id;

        creatorRelationships[
            existingIndex
        ] = relationship;

    } else {

        relationship.id =
            `relationship-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;

        creatorRelationships.push(
            relationship
        );
    }

    renderRelationships();

    resetRelationshipForm();

    /*
     * Alliances use relationships to calculate their
     * strength, so updating a relationship immediately
     * updates the alliance preview.
     */

    updateAllianceStrength();
}


function resetRelationshipForm() {

    editingRelationshipId = null;

    const title =
        getElement(
            "relationship-form-title"
        );

    const button =
        getElement(
            "add-relationship-btn"
        );

    const cancel =
        getElement(
            "cancel-relationship-btn"
        );

    if (title) {
        title.textContent =
            "Create Relationship";
    }

    if (button) {
        button.textContent =
            "Add Relationship";
    }

    if (cancel) {
        cancel.style.display =
            "none";
    }

    const defaults = {
        "relationship-from": "",
        "relationship-to": "",
        "relationship-friendship": 5,
        "relationship-trust": 5,
        "relationship-loyalty": 5,
        "relationship-rivalry": 0,
        "relationship-attraction": 0,
        "relationship-respect": 5
    };

    Object.entries(defaults).forEach(
        ([id, value]) => {

            const element =
                getElement(id);

            if (element) {
                element.value = value;
            }
        }
    );

    updateRelationshipMetricDisplays();
}


function editRelationship(id) {

    const relationship =
        creatorRelationships.find(
            item => item.id === id
        );

    if (!relationship) {
        return;
    }

    editingRelationshipId = id;

    refreshRelationshipHouseguestOptions();

    setRelationshipForm(
        relationship
    );

    const title =
        getElement(
            "relationship-form-title"
        );

    const button =
        getElement(
            "add-relationship-btn"
        );

    const cancel =
        getElement(
            "cancel-relationship-btn"
        );

    if (title) {
        title.textContent =
            "Edit Relationship";
    }

    if (button) {
        button.textContent =
            "Update Relationship";
    }

    if (cancel) {
        cancel.style.display =
            "";
    }

    const editor =
        document.querySelector(
            ".relationship-editor"
        );

    if (editor) {

        editor.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


function deleteRelationship(id) {

    const relationship =
        creatorRelationships.find(
            item => item.id === id
        );

    if (!relationship) {
        return;
    }

    const houseguests =
        getCurrentCreatorHouseguests();

    const from =
        houseguests.find(
            houseguest =>
                houseguest.id ===
                relationship.from
        );

    const to =
        houseguests.find(
            houseguest =>
                houseguest.id ===
                relationship.to
        );

    const fromName =
        from?.name || "Houseguest A";

    const toName =
        to?.name || "Houseguest B";

    const confirmed =
        confirm(
            `Delete the relationship from ${fromName} to ${toName}?`
        );

    if (!confirmed) {
        return;
    }

    creatorRelationships =
        creatorRelationships.filter(
            item => item.id !== id
        );

    if (editingRelationshipId === id) {
        resetRelationshipForm();
    }

    renderRelationships();

    updateAllianceStrength();
}


function getHouseguestById(id) {

    return getCurrentCreatorHouseguests()
        .find(
            houseguest =>
                houseguest.id === id
        );
}


function renderRelationships() {

    const container =
        getElement("relationships-list");

    if (!container) {
        return;
    }

    if (!creatorRelationships.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ❤️
                </div>

                <h3>
                    No Relationships Yet
                </h3>

                <p>
                    Create your first relationship above.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML = `
        <table class="relationship-table">

            <thead>

                <tr>

                    <th>
                        Relationship
                    </th>

                    <th>
                        Friendship
                    </th>

                    <th>
                        Trust
                    </th>

                    <th>
                        Loyalty
                    </th>

                    <th>
                        Rivalry
                    </th>

                    <th>
                        Attraction
                    </th>

                    <th>
                        Respect
                    </th>

                    <th>
                        Overall
                    </th>

                    <th>
                        Actions
                    </th>

                </tr>

            </thead>

            <tbody>

                ${creatorRelationships.map(
                    relationship => {

                        const from =
                            getHouseguestById(
                                relationship.from
                            );

                        const to =
                            getHouseguestById(
                                relationship.to
                            );

                        const fromName =
                            from?.name ||
                            "Unknown";

                        const toName =
                            to?.name ||
                            "Unknown";

                        const overall =
                            calculateRelationshipOverall(
                                relationship
                            );

                        return `
                            <tr>

                                <td
                                    class="relationship-direction-cell"
                                >
                                    ${escapeHtml(fromName)}
                                    →
                                    ${escapeHtml(toName)}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.friendship}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.trust}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.loyalty}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.rivalry}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.attraction}
                                </td>

                                <td
                                    class="relationship-number"
                                >
                                    ${relationship.respect}
                                </td>

                                <td
                                    class="relationship-number relationship-overall-cell"
                                >
                                    ${overall.toFixed(1)}
                                </td>

                                <td>

                                    <div
                                        class="relationship-actions"
                                    >

                                        <button
                                            type="button"
                                            class="relationship-action-button"
                                            onclick="editRelationship('${relationship.id}')"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            class="relationship-action-button delete"
                                            onclick="deleteRelationship('${relationship.id}')"
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </td>

                            </tr>
                        `;
                    }
                ).join("")}

            </tbody>

        </table>
    `;
}


function collectRelationships() {

    return creatorRelationships.map(
        relationship =>
            normalizeRelationship(
                relationship
            )
    );
}


function loadRelationships(
    relationships
) {

    creatorRelationships =
        Array.isArray(relationships)
            ? relationships.map(
                (relationship, index) =>
                    normalizeRelationship(
                        relationship,
                        index
                    )
            )
            : [];

    editingRelationshipId = null;

    refreshRelationshipHouseguestOptions();

    renderRelationships();

    resetRelationshipForm();

    updateAllianceStrength();
}


/* ============================================================
   ALLIANCES
   ============================================================ */

function setupAllianceControls() {

    const members =
        getElement("alliance-members");

    if (members) {

        members.addEventListener(
            "change",
            updateAllianceStrength
        );
    }

    /*
     * The strength is also recalculated whenever the
     * alliance form itself changes.
     */

    const name =
        getElement("alliance-name");

    const description =
        getElement("alliance-description");

    const week =
        getElement("alliance-formation-week");

    const status =
        getElement("alliance-status");

    [
        name,
        description,
        week,
        status
    ].forEach(element => {

        if (!element) {
            return;
        }

        element.addEventListener(
            "input",
            updateAllianceStrength
        );

        element.addEventListener(
            "change",
            updateAllianceStrength
        );
    });
}


function normalizeAlliance(
    alliance,
    index = 0
) {

    return {

        id:
            alliance?.id ||
            `alliance-${Date.now()}-${index}`,

        name:
            String(
                alliance?.name || ""
            ).trim(),

        description:
            String(
                alliance?.description || ""
            ).trim(),

        formationWeek:
            Math.max(
                1,
                Number(
                    alliance?.formationWeek
                ) || 1
            ),

        status:
            alliance?.status === "dissolved"
                ? "dissolved"
                : "active",

        members:
            Array.isArray(
                alliance?.members
            )
                ? [
                    ...new Set(
                        alliance.members
                    )
                ]
                : [],

        strength:
            Number.isFinite(
                Number(alliance?.strength)
            )
                ? Math.max(
                    0,
                    Math.min(
                        10,
                        Number(
                            alliance.strength
                        )
                    )
                )
                : 0,

        history:
            Array.isArray(
                alliance?.history
            )
                ? alliance.history
                : []
    };
}


function refreshAllianceHouseguestOptions() {

    const container =
        getElement("alliance-members");

    if (!container) {
        return;
    }

    const houseguests =
        getCurrentCreatorHouseguests()
            .filter(
                houseguest =>
                    houseguest.name.trim()
            );

    if (houseguests.length < 2) {

        container.innerHTML = `
            <div class="empty-state">

                <p>
                    Add at least two named houseguests
                    to create an alliance.
                </p>

            </div>
        `;

        updateAllianceStrength();

        return;
    }

    let selectedMembers = [];

    if (editingAllianceId) {

        const editing =
            creatorAlliances.find(
                alliance =>
                    alliance.id ===
                    editingAllianceId
            );

        if (editing) {
            selectedMembers =
                editing.members;
        }

    } else {

        selectedMembers =
            [...container.querySelectorAll(
                'input[type="checkbox"]:checked'
            )].map(
                input => input.value
            );
    }

    container.innerHTML =
        houseguests.map(
            houseguest => {

                const checkboxId =
                    `alliance-member-${houseguest.id}`;

                const checked =
                    selectedMembers.includes(
                        houseguest.id
                    )
                        ? "checked"
                        : "";

                return `
                    <div
                        class="alliance-member-option"
                    >

                        <input
                            type="checkbox"
                            id="${checkboxId}"
                            value="${escapeHtml(houseguest.id)}"
                            ${checked}
                            onchange="updateAllianceStrength()"
                        >

                        <label for="${checkboxId}">

                            ${escapeHtml(
                                houseguest.name
                            )}

                        </label>

                    </div>
                `;
            }
        ).join("");

    updateAllianceStrength();
}


function getSelectedAllianceMembers() {

    const container =
        getElement("alliance-members");

    if (!container) {
        return [];
    }

    return [
        ...container.querySelectorAll(
            'input[type="checkbox"]:checked'
        )
    ].map(
        input => input.value
    );
}


function calculateAllianceStrength(
    memberIds
) {

    const uniqueMembers =
        [
            ...new Set(
                memberIds || []
            )
        ];

    if (uniqueMembers.length < 2) {
        return 0;
    }

    /*
     * Alliance strength is based on every directional
     * relationship between every member.
     *
     * If A likes B but B dislikes A, both directions
     * matter.
     */

    const scores = [];

    for (
        let i = 0;
        i < uniqueMembers.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < uniqueMembers.length;
            j++
        ) {

            const a =
                uniqueMembers[i];

            const b =
                uniqueMembers[j];

            const forward =
                creatorRelationships.find(
                    relationship =>
                        relationship.from === a &&
                        relationship.to === b
                );

            const reverse =
                creatorRelationships.find(
                    relationship =>
                        relationship.from === b &&
                        relationship.to === a
                );

            if (forward) {

                scores.push(
                    calculateRelationshipOverall(
                        forward
                    )
                );
            }

            if (reverse) {

                scores.push(
                    calculateRelationshipOverall(
                        reverse
                    )
                );
            }

            /*
             * If no relationship has been explicitly
             * created, use a neutral score of 5.
             */

            if (!forward && !reverse) {

                scores.push(5);

                scores.push(5);

            } else {

                if (!forward) {
                    scores.push(5);
                }

                if (!reverse) {
                    scores.push(5);
                }
            }
        }
    }

    if (!scores.length) {
        return 5;
    }

    const average =
        scores.reduce(
            (total, score) =>
                total + score,
            0
        ) / scores.length;

    return Math.round(
        average * 10
    ) / 10;
}


function updateAllianceStrength() {

    const selectedMembers =
        getSelectedAllianceMembers();

    const strength =
        calculateAllianceStrength(
            selectedMembers
        );

    const value =
        getElement(
            "alliance-strength-value"
        );

    const fill =
        getElement(
            "alliance-strength-fill"
        );

    if (value) {

        value.textContent =
            `${strength.toFixed(1)} / 10`;
    }

    if (fill) {

        fill.style.width =
            `${strength * 10}%`;
    }
}


function getAllianceFromForm() {

    const members =
        getSelectedAllianceMembers();

    return normalizeAlliance({

        name:
            getElement(
                "alliance-name"
            )?.value.trim() || "",

        description:
            getElement(
                "alliance-description"
            )?.value.trim() || "",

        formationWeek:
            Number(
                getElement(
                    "alliance-formation-week"
                )?.value
            ) || 1,

        status:
            getElement(
                "alliance-status"
            )?.value || "active",

        members,

        strength:
            calculateAllianceStrength(
                members
            )
    });
}


function saveAlliance() {

    const name =
        getElement(
            "alliance-name"
        )?.value.trim() || "";

    if (!name) {

        alert(
            "Please enter an alliance name."
        );

        return;
    }

    const members =
        getSelectedAllianceMembers();

    if (members.length < 2) {

        alert(
            "An alliance must have at least two houseguests."
        );

        return;
    }

    const houseguests =
        getCurrentCreatorHouseguests();

    const validMembers =
        members.every(
            memberId =>
                houseguests.some(
                    houseguest =>
                        houseguest.id ===
                        memberId
                )
        );

    if (!validMembers) {

        alert(
            "One or more selected houseguests no longer exist."
        );

        return;
    }

    const alliance =
        getAllianceFromForm();

    const existingIndex =
        editingAllianceId
            ? creatorAlliances.findIndex(
                item =>
                    item.id ===
                    editingAllianceId
            )
            : -1;

    if (existingIndex >= 0) {

        alliance.id =
            creatorAlliances[
                existingIndex
            ].id;

        alliance.history =
            creatorAlliances[
                existingIndex
            ].history || [];

        creatorAlliances[
            existingIndex
        ] = alliance;

    } else {

        alliance.id =
            `alliance-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;

        alliance.history = [
            {
                week:
                    alliance.formationWeek,

                event:
                    "Alliance formed",

                members:
                    [...alliance.members]
            }
        ];

        creatorAlliances.push(
            alliance
        );
    }

    renderAlliances();

    resetAllianceForm();
}


function resetAllianceForm() {

    editingAllianceId = null;

    const title =
        getElement(
            "alliance-form-title"
        );

    const button =
        getElement(
            "add-alliance-btn"
        );

    const cancel =
        getElement(
            "cancel-alliance-btn"
        );

    if (title) {
        title.textContent =
            "Create Alliance";
    }

    if (button) {
        button.textContent =
            "Add Alliance";
    }

    if (cancel) {
        cancel.style.display =
            "none";
    }

    const name =
        getElement("alliance-name");

    const description =
        getElement(
            "alliance-description"
        );

    const week =
        getElement(
            "alliance-formation-week"
        );

    const status =
        getElement(
            "alliance-status"
        );

    if (name) {
        name.value = "";
    }

    if (description) {
        description.value = "";
    }

    if (week) {
        week.value = 1;
    }

    if (status) {
        status.value = "active";
    }

    refreshAllianceHouseguestOptions();

    /*
     * refreshAllianceHouseguestOptions preserves selected
     * members when editing. We want a completely blank
     * form after saving/cancelling.
     */

    const container =
        getElement("alliance-members");

    if (container) {

        container
            .querySelectorAll(
                'input[type="checkbox"]'
            )
            .forEach(
                checkbox =>
                    checkbox.checked = false
            );
    }

    updateAllianceStrength();
}


function editAlliance(id) {

    const alliance =
        creatorAlliances.find(
            item => item.id === id
        );

    if (!alliance) {
        return;
    }

    editingAllianceId = id;

    const name =
        getElement(
            "alliance-name"
        );

    const description =
        getElement(
            "alliance-description"
        );

    const week =
        getElement(
            "alliance-formation-week"
        );

    const status =
        getElement(
            "alliance-status"
        );

    if (name) {
        name.value =
            alliance.name;
    }

    if (description) {
        description.value =
            alliance.description;
    }

    if (week) {
        week.value =
            alliance.formationWeek;
    }

    if (status) {
        status.value =
            alliance.status;
    }

    refreshAllianceHouseguestOptions();

    const title =
        getElement(
            "alliance-form-title"
        );

    const button =
        getElement(
            "add-alliance-btn"
        );

    const cancel =
        getElement(
            "cancel-alliance-btn"
        );

    if (title) {
        title.textContent =
            "Edit Alliance";
    }

    if (button) {
        button.textContent =
            "Update Alliance";
    }

    if (cancel) {
        cancel.style.display =
            "";
    }

    updateAllianceStrength();

    const editor =
        document.querySelector(
            ".alliance-editor"
        );

    if (editor) {

        editor.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


function deleteAlliance(id) {

    const alliance =
        creatorAlliances.find(
            item => item.id === id
        );

    if (!alliance) {
        return;
    }

    const confirmed =
        confirm(
            `Delete the alliance "${alliance.name}"?`
        );

    if (!confirmed) {
        return;
    }

    creatorAlliances =
        creatorAlliances.filter(
            item => item.id !== id
        );

    if (editingAllianceId === id) {
        resetAllianceForm();
    }

    renderAlliances();
}


function collectAlliances() {

    return creatorAlliances.map(
        alliance => ({
            ...normalizeAlliance(
                alliance
            ),

            /*
             * Strength is recalculated before saving
             * so it always reflects the latest
             * relationships.
             */

            strength:
                calculateAllianceStrength(
                    alliance.members
                )
        })
    );
}


function loadAlliances(
    alliances
) {

    creatorAlliances =
        Array.isArray(alliances)
            ? alliances.map(
                (alliance, index) =>
                    normalizeAlliance(
                        alliance,
                        index
                    )
            )
            : [];

    creatorAlliances =
        creatorAlliances.map(
            alliance => ({
                ...alliance,

                strength:
                    calculateAllianceStrength(
                        alliance.members
                    )
            })
        );

    editingAllianceId = null;

    resetAllianceForm();

    renderAlliances();
}


function renderAlliances() {

    const container =
        getElement("alliances-list");

    if (!container) {
        return;
    }

    if (!creatorAlliances.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    🤝
                </div>

                <h3>
                    No Alliances Yet
                </h3>

                <p>
                    Create your first alliance above.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        creatorAlliances.map(
            alliance => {

                const members =
                    alliance.members
                        .map(
                            memberId =>
                                getHouseguestById(
                                    memberId
                                )
                        )
                        .filter(Boolean);

                const strength =
                    calculateAllianceStrength(
                        alliance.members
                    );

                const memberTags =
                    members.length
                        ? members.map(
                            member => `
                                <span
                                    class="alliance-member-tag"
                                >
                                    ${escapeHtml(
                                        member.name
                                    )}
                                </span>
                            `
                        ).join("")
                        : `
                            <span
                                class="alliance-member-tag"
                            >
                                No Members
                            </span>
                        `;

                const statusLabel =
                    alliance.status ===
                    "dissolved"
                        ? "Dissolved"
                        : "Active";

                return `
                    <article
                        class="alliance-card"
                    >

                        <div
                            class="alliance-card-header"
                        >

                            <div>

                                <h3
                                    class="alliance-card-title"
                                >
                                    ${escapeHtml(
                                        alliance.name
                                    )}
                                </h3>

                                ${
                                    alliance.description
                                        ? `
                                            <p
                                                class="alliance-card-description"
                                            >
                                                ${escapeHtml(
                                                    alliance.description
                                                )}
                                            </p>
                                        `
                                        : ""
                                }

                            </div>


                            <span
                                class="alliance-status ${alliance.status}"
                            >
                                ${statusLabel}
                            </span>

                        </div>


                        <div
                            class="alliance-card-members"
                        >
                            ${memberTags}
                        </div>


                        <div
                            class="alliance-card-details"
                        >

                            <div
                                class="alliance-detail"
                            >

                                <span
                                    class="alliance-detail-label"
                                >
                                    Members
                                </span>

                                <span
                                    class="alliance-detail-value"
                                >
                                    ${members.length}
                                </span>

                            </div>


                            <div
                                class="alliance-detail"
                            >

                                <span
                                    class="alliance-detail-label"
                                >
                                    Formation Week
                                </span>

                                <span
                                    class="alliance-detail-value"
                                >
                                    Week
                                    ${alliance.formationWeek}
                                </span>

                            </div>


                            <div
                                class="alliance-detail"
                            >

                                <span
                                    class="alliance-detail-label"
                                >
                                    Strength
                                </span>

                                <span
                                    class="alliance-detail-value"
                                >
                                    ${strength.toFixed(1)}
                                    / 10
                                </span>

                            </div>

                        </div>


                        <div
                            class="alliance-card-actions"
                        >

                            <button
                                type="button"
                                class="alliance-action-button"
                                onclick="editAlliance('${alliance.id}')"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="alliance-action-button delete"
                                onclick="deleteAlliance('${alliance.id}')"
                            >
                                Delete
                            </button>

                        </div>

                    </article>
                `;
            }
        ).join("");
}


/* ============================================================
   SAVE SEASON
   ============================================================ */

function saveSeason() {

    const name =
        getElement(
            "season-name"
        )?.value.trim() || "";

    if (!name) {

        alert(
            "Please enter a season name."
        );

        return;
    }

    const houseguests =
        collectHouseguests();

    if (houseguests.length < 2) {

        alert(
            "Your season needs at least two houseguests."
        );

        return;
    }

    const unnamed =
        houseguests.filter(
            houseguest =>
                !houseguest.name.trim()
        );

    if (unnamed.length) {

        alert(
            "Please give every houseguest a name before saving."
        );

        return;
    }

    /*
     * Make sure the relationship and alliance collections
     * reflect the current creator state before saving.
     */

    const relationships =
        collectRelationships();

    const alliances =
        collectAlliances();

    const seasonData = {

        name,

        theme:
            getElement(
                "season-theme"
            )?.value.trim() || "",

        description:
            getElement(
                "season-description"
            )?.value.trim() || "",

        logo:
            getElement(
                "season-logo"
            )?.value.trim() || "",

        background:
            getElement(
                "season-background"
            )?.value.trim() || "",

        houseguests,

        alliances,

        relationships,

        competitions:
            currentSeason?.competitions || {
                hoh: [],
                pov: [],
                safety: [],
                luxury: [],
                finalHoh: []
            },

        twists:
            currentSeason?.twists || [],

        rules:
            collectSeasonRules(),

        simulation:
            currentSeason?.simulation || {
                started: false,
                completed: false,
                currentWeek: 1,
                currentPhase: "setup",
                currentEventIndex: 0,
                history: [],
                finalPlacements: [],
                winner: null,
                runnerUp: null,
                jury: [],
                finalists: [],
                currentHOH: null,
                currentNominees: [],
                currentPOVPlayers: [],
                currentPOVWinner: null,
                currentSafetyWinner: null,
                currentEviction: null
            },

        createdAt:
            currentSeason?.createdAt ||
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()
    };

    if (editingSeasonId) {

        const index =
            savedSeasons.findIndex(
                season =>
                    season.id ===
                    editingSeasonId
            );

        if (index >= 0) {

            savedSeasons[index] =
                normalizeSeason({
                    ...savedSeasons[index],
                    ...seasonData,
                    id: editingSeasonId
                });

        }

    } else {

        const newSeason = normalizeSeason({

            id:
                `season-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,

            ...seasonData
        });

        savedSeasons.push(
            newSeason
        );
    }

    persistSavedSeasons();

    renderSavedSeasons();

    alert(
        "Season saved successfully!"
    );

    const savedId =
        editingSeasonId ||
        savedSeasons[
            savedSeasons.length - 1
        ]?.id;

    editingSeasonId = null;

    const savedSeason =
        savedSeasons.find(
            season =>
                season.id === savedId
        );

    if (savedSeason) {
        currentSeason =
            normalizeSeason(
                savedSeason
            );
    }

    showPage("home-page");
}


function editSeason(id) {

    const season =
        savedSeasons.find(
            item => item.id === id
        );

    if (!season) {
        return;
    }

    currentSeason =
        normalizeSeason(
            season
        );

    editingSeasonId = id;

    const setValue = (
        elementId,
        value
    ) => {

        const element =
            getElement(elementId);

        if (element) {
            element.value =
                value ?? "";
        }
    };

    setValue(
        "season-name",
        season.name
    );

    setValue(
        "season-theme",
        season.theme
    );

    setValue(
        "season-description",
        season.description
    );

    setValue(
        "season-logo",
        season.logo
    );

    setValue(
        "season-background",
        season.background
    );

    updateSeasonLogoPreview(
        season.logo
    );

    updateSeasonBackgroundPreview(
        season.background
    );

    const editor =
        getElement(
            "houseguest-editor"
        );

    if (editor) {
        editor.innerHTML = "";
    }

    currentHouseguestId = 0;

    season.houseguests.forEach(
        houseguest =>
            addHouseguest(
                houseguest
            )
    );

    const countInput =
        getElement(
            "houseguest-count"
        );

    if (countInput) {
        countInput.value =
            season.houseguests.length;
    }

    updateHouseguestNumbers();

    loadSeasonRules(
        season.rules
    );

    loadRelationships(
        season.relationships
    );

    loadAlliances(
        season.alliances
    );

    refreshRelationshipHouseguestOptions();

    refreshAllianceHouseguestOptions();

    showPage("creator-page");
}


function deleteSeason(id) {

    const season =
        savedSeasons.find(
            item => item.id === id
        );

    if (!season) {
        return;
    }

    const confirmed =
        confirm(
            `Delete "${season.name}"? This cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    savedSeasons =
        savedSeasons.filter(
            item => item.id !== id
        );

    persistSavedSeasons();

    renderSavedSeasons();
}


function openSeason(id) {

    const season =
        savedSeasons.find(
            item => item.id === id
        );

    if (!season) {
        return;
    }

    currentSeason =
        normalizeSeason(
            season
        );

    /*
     * Keep creator collections synchronized as well.
     * This means if the user returns to editing later,
     * the relationships and alliances are still available.
     */

    creatorRelationships =
        currentSeason.relationships.map(
            normalizeRelationship
        );

    creatorAlliances =
        currentSeason.alliances.map(
            normalizeAlliance
        );

    loadSimulator(
        currentSeason
    );

    showPage("simulator-page");
}


/* ============================================================
   SIMULATOR
   ============================================================ */

function loadSimulator(season) {

    currentSeason =
        normalizeSeason(
            season
        );

    const name =
        getElement(
            "simulator-season-name"
        );

    const theme =
        getElement(
            "simulator-season-theme"
        );

    if (name) {
        name.textContent =
            currentSeason.name ||
            "Big Brother";
    }

    if (theme) {
        theme.textContent =
            currentSeason.theme ||
            "Season Theme";
    }

    updateSimulatorStatus();

    updateGameChain();

    displayCurrentEvent();
}


function updateSimulatorStatus() {

    if (!currentSeason) {
        return;
    }

    const simulation =
        currentSeason.simulation;

    const week =
        getElement("current-week");

    const hoh =
        getElement("current-hoh");

    const nominees =
        getElement(
            "current-nominees"
        );

    const veto =
        getElement(
            "current-veto"
        );

    if (week) {
        week.textContent =
            simulation.currentWeek;
    }

    const getName = id => {

        if (!id) {
            return "—";
        }

        return currentSeason.houseguests
            .find(
                houseguest =>
                    houseguest.id === id
            )
            ?.name || "—";
    };

    if (hoh) {
        hoh.textContent =
            getName(
                simulation.currentHOH
            );
    }

    if (nominees) {

        nominees.textContent =
            simulation.currentNominees
                .map(getName)
                .filter(
                    name => name !== "—"
                )
                .join(", ") || "—";
    }

    if (veto) {

        veto.textContent =
            getName(
                simulation.currentPOVWinner
            );
    }
}


function updateGameChain() {

    if (!currentSeason) {
        return;
    }

    const index =
        currentSeason.simulation
            .currentEventIndex;

    document.querySelectorAll(
        ".chain-step"
    ).forEach(
        (step, stepIndex) => {

            step.classList.remove(
                "active"
            );

            step.classList.remove(
                "completed"
            );

            if (stepIndex < index) {

                step.classList.add(
                    "completed"
                );

            } else if (stepIndex === index) {

                step.classList.add(
                    "active"
                );
            }
        }
    );
}


function displayCurrentEvent() {

    if (!currentSeason) {
        return;
    }

    const index =
        currentSeason.simulation
            .currentEventIndex;

    const event =
        EVENT_CHAIN[
            index
        ];

    if (!event) {
        return;
    }

    const type =
        getElement("event-type");

    const title =
        getElement("event-title");

    const content =
        getElement("event-content");

    if (type) {
        type.textContent =
            event.type;
    }

    if (title) {
        title.textContent =
            event.title;
    }

    if (content) {

        content.innerHTML =
            getEventDescription(
                event.id
            );
    }
}


function getEventDescription(
    eventId
) {

    if (!currentSeason) {
        return "";
    }

    const simulation =
        currentSeason.simulation;

    const houseguests =
        currentSeason.houseguests;

    const getName = id =>
        houseguests.find(
            houseguest =>
                houseguest.id === id
        )?.name || "Unknown";

    switch (eventId) {

        case "hoh":

            return `
                <p>
                    The Houseguests are ready to compete
                    for the Head of Household.
                </p>

                <p>
                    <strong>
                        HOH:
                    </strong>
                    ${simulation.currentHOH
                        ? getName(
                            simulation.currentHOH
                        )
                        : "Not yet determined"}
                </p>
            `;


        case "nominations":

            return `
                <p>
                    The Head of Household will nominate
                    ${currentSeason.rules.nomineesPerWeek}
                    houseguest${
                        currentSeason.rules.nomineesPerWeek === 1
                            ? ""
                            : "s"
                    } for eviction.
                </p>

                <p>
                    <strong>
                        Nominees:
                    </strong>
                    ${
                        simulation.currentNominees
                            .map(getName)
                            .join(", ") ||
                        "Not yet determined"
                    }
                </p>
            `;


        case "pov-players":

            return `
                <p>
                    The Power of Veto players are selected.
                </p>

                <p>
                    <strong>
                        Players:
                    </strong>
                    ${
                        simulation.currentPOVPlayers
                            .map(getName)
                            .join(", ") ||
                        "Not yet determined"
                    }
                </p>
            `;


        case "pov":

            return `
                <p>
                    The Power of Veto competition
                    takes place.
                </p>

                <p>
                    <strong>
                        POV Winner:
                    </strong>
                    ${
                        simulation.currentPOVWinner
                            ? getName(
                                simulation.currentPOVWinner
                            )
                            : "Not yet determined"
                    }
                </p>
            `;


        case "veto-ceremony":

            return `
                <p>
                    The Power of Veto ceremony
                    determines whether the nominations
                    change.
                </p>
            `;


        case "eviction":

            return `
                <p>
                    The houseguests cast their votes
                    for eviction.
                </p>

                <p>
                    <strong>
                        Evicted:
                    </strong>
                    ${
                        simulation.currentEviction
                            ? getName(
                                simulation.currentEviction
                            )
                            : "Not yet determined"
                    }
                </p>
            `;


        default:
            return "";
    }
}


function runNextEvent() {

    if (!currentSeason) {
        return;
    }

    const simulation =
        currentSeason.simulation;

    if (
        simulation.currentEventIndex >=
        EVENT_CHAIN.length
    ) {

        finishSimulationWeek();

        return;
    }

    const event =
        EVENT_CHAIN[
            simulation.currentEventIndex
        ];

    /*
     * The full simulation engine will eventually perform
     * the actual competition, nomination, voting, and
     * strategic calculations here.
     *
     * For now, this maintains the BrantSteele-style
     * chain progression without pretending that the
     * unfinished engine has simulated outcomes.
     */

    simulation.currentPhase =
        event.id;

    simulation.currentEventIndex++;

    if (
        simulation.currentEventIndex >=
        EVENT_CHAIN.length
    ) {

        updateGameChain();

        displayCurrentEvent();

        setTimeout(
            () => {
                finishSimulationWeek();
            },
            250
        );

        return;
    }

    updateGameChain();

    displayCurrentEvent();

    updateSimulatorStatus();
}


function finishSimulationWeek() {

    if (!currentSeason) {
        return;
    }

    const simulation =
        currentSeason.simulation;

    simulation.currentWeek++;

    simulation.currentEventIndex = 0;

    simulation.currentPhase =
        "setup";

    updateSimulatorStatus();

    updateGameChain();

    displayCurrentEvent();
}


/* ============================================================
   RESULTS
   ============================================================ */

function displayResults(
    season
) {

    const normalized =
        normalizeSeason(
            season
        );

    const name =
        getElement(
            "results-season-name"
        );

    const winner =
        getElement(
            "winner-name"
        );

    if (name) {
        name.textContent =
            normalized.name;
    }

    if (winner) {

        winner.textContent =
            normalized.simulation.winner
                ? normalized.houseguests.find(
                    houseguest =>
                        houseguest.id ===
                        normalized.simulation.winner
                )?.name || "—"
                : "—";
    }

    renderFinalPlacements(
        normalized
    );

    renderSeasonStatistics(
        normalized
    );
}


function renderFinalPlacements(
    season
) {

    const container =
        getElement(
            "final-placements"
        );

    if (!container) {
        return;
    }

    const placements =
        season.simulation
            .finalPlacements || [];

    if (!placements.length) {

        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    No Placements Yet
                </h3>

                <p>
                    Placements will appear when the
                    simulation is completed.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        placements.map(
            (placement, index) => {

                const houseguest =
                    season.houseguests.find(
                        item =>
                            item.id ===
                            (
                                typeof placement ===
                                "string"
                                    ? placement
                                    : placement.id
                            )
                    );

                return `
                    <div class="placement-row">

                        <span>
                            ${index + 1}
                        </span>

                        <strong>
                            ${escapeHtml(
                                houseguest?.name ||
                                "Unknown"
                            )}
                        </strong>

                    </div>
                `;
            }
        ).join("");
}


function renderSeasonStatistics(
    season
) {

    const container =
        getElement(
            "season-statistics"
        );

    if (!container) {
        return;
    }

    const houseguests =
        season.houseguests;

    const totalHOHWins =
        houseguests.reduce(
            (total, houseguest) =>
                total +
                Number(
                    houseguest.hohWins || 0
                ),
            0
        );

    const totalPOVWins =
        houseguests.reduce(
            (total, houseguest) =>
                total +
                Number(
                    houseguest.povWins || 0
                ),
            0
        );

    const totalNominations =
        houseguests.reduce(
            (total, houseguest) =>
                total +
                Number(
                    houseguest.nominationCount || 0
                ),
            0
        );

    container.innerHTML = `

        <div class="stats-grid">

            <div class="stat-card">

                <span>
                    Houseguests
                </span>

                <strong>
                    ${houseguests.length}
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    Alliances
                </span>

                <strong>
                    ${season.alliances.length}
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    Relationships
                </span>

                <strong>
                    ${season.relationships.length}
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    HOH Wins
                </span>

                <strong>
                    ${totalHOHWins}
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    POV Wins
                </span>

                <strong>
                    ${totalPOVWins}
                </strong>

            </div>


            <div class="stat-card">

                <span>
                    Nominations
                </span>

                <strong>
                    ${totalNominations}
                </strong>

            </div>

        </div>
    `;
}


/* ============================================================
   MODAL
   ============================================================ */

function openModal(content) {

    const modal =
        getElement("modal");

    const body =
        getElement("modal-body");

    if (!modal || !body) {
        return;
    }

    body.innerHTML =
        content;

    modal.classList.add(
        "open"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function closeModal() {

    const modal =
        getElement("modal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "open"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* ============================================================
   UTILITY
   ============================================================ */

function capitalize(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value).slice(1);
}


/* ============================================================
   GLOBAL EXPORTS
   ============================================================ */

/*
 * The HTML uses inline onclick handlers, so explicitly expose
 * the public functions on window.
 */

window.showPage =
    showPage;

window.addHouseguest =
    addHouseguest;

window.removeHouseguest =
    removeHouseguest;

window.updateHouseguestImage =
    updateHouseguestImage;

window.saveSeason =
    saveSeason;

window.editSeason =
    editSeason;

window.deleteSeason =
    deleteSeason;

window.openSeason =
    openSeason;

window.runNextEvent =
    runNextEvent;

window.openModal =
    openModal;

window.closeModal =
    closeModal;


/* Relationships */

window.saveRelationship =
    saveRelationship;

window.resetRelationshipForm =
    resetRelationshipForm;

window.editRelationship =
    editRelationship;

window.deleteRelationship =
    deleteRelationship;


/* Alliances */

window.saveAlliance =
    saveAlliance;

window.resetAllianceForm =
    resetAllianceForm;

window.editAlliance =
    editAlliance;

window.deleteAlliance =
    deleteAlliance;
