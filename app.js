/*
 * =========================================================
 * BIG BROTHER SIMULATOR
 * APPLICATION CONTROLLER
 * =========================================================
 *
 * Current systems:
 * - Season creation
 * - Houseguest editor
 * - Houseguest ratings
 * - Season rules
 * - Relationships
 * - Saved seasons
 * - Simulator foundation
 * - Event chain
 * - Results foundation
 *
 * The actual strategic simulation engine will be added later.
 * =========================================================
 */


/* =========================================================
   CONSTANTS
   ========================================================= */

const STORAGE_KEY = "bigBrotherSimulatorSeasons";

const STAT_KEYS = [
    "general",
    "physical",
    "mental",
    "social",
    "strategic"
];

const EVENT_CHAIN = [
    "hoh",
    "nominations",
    "pov-players",
    "pov",
    "veto-ceremony",
    "eviction"
];

const RELATIONSHIP_KEYS = [
    "friendship",
    "trust",
    "loyalty",
    "rivalry",
    "respect",
    "attraction"
];


/* =========================================================
   APPLICATION STATE
   ========================================================= */

let savedSeasons = [];

let currentSeason = null;

let editingSeasonId = null;

let currentHouseguestId = 0;

let editingRelationshipId = null;
let editingAllianceId = null;
let editingCompetitionId = null;
let editingTwistId = null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadSeasonsFromStorage();

    setupImagePreviews();

    setupRuleControls();

    setupRelationshipControls();

    // Build the houseguest editor before initializing the advanced
    // alliance/competition/twist controls so their player lists are
    // populated from the actual houseguest cards.
    initializeHouseguestCount();
    setupAdvancedSeasonControls();
    renderRelationshipMatrix();

    renderSavedSeasons();

});


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        page.classList.remove("active");
    });

    const targetPage = document.getElementById(pageId);

    if (targetPage) {
        targetPage.classList.add("active");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadSeasonsFromStorage() {

    try {

        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            savedSeasons = [];
            return;
        }

        savedSeasons = JSON.parse(stored);

        if (!Array.isArray(savedSeasons)) {
            savedSeasons = [];
        }

    } catch (error) {

        console.error(
            "Unable to load saved seasons:",
            error
        );

        savedSeasons = [];
    }
}


function saveSeasonsToStorage() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedSeasons)
        );

    } catch (error) {

        console.error(
            "Unable to save seasons:",
            error
        );

        alert(
            "There was a problem saving your season."
        );
    }
}


/* =========================================================
   SAVED SEASONS
   ========================================================= */

function renderSavedSeasons() {

    const container =
        document.getElementById("saved-seasons-container");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (savedSeasons.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    ★
                </div>

                <h3>
                    No Saved Seasons
                </h3>

                <p>
                    Create your first custom Big Brother season
                    to get started.
                </p>
            </div>
        `;

        return;
    }

    savedSeasons.forEach(season => {

        const card =
            document.createElement("div");

        card.className = "saved-season-card";

        const houseguestCount =
            Array.isArray(season.houseguests)
                ? season.houseguests.length
                : 0;

        const relationshipCount =
            Array.isArray(season.relationships)
                ? season.relationships.length
                : 0;

        card.innerHTML = `
            <h3>
                ${escapeHTML(season.name || "Untitled Season")}
            </h3>

            <p>
                ${escapeHTML(
                    season.theme || "Custom Season"
                )}
            </p>

            <p>
                ${houseguestCount} Houseguests
                •
                ${relationshipCount} Relationships
            </p>

            <div class="saved-season-actions">

                <button
                    class="primary-button"
                    onclick="openSeason('${season.id}')"
                >
                    Open
                </button>

                <button
                    class="secondary-button"
                    onclick="editSeason('${season.id}')"
                >
                    Edit
                </button>

                <button
                    class="secondary-button"
                    onclick="deleteSeason('${season.id}')"
                >
                    Delete
                </button>

            </div>
        `;

        container.appendChild(card);
    });
}


/* =========================================================
   CREATE / RESET SEASON
   ========================================================= */

function resetSeasonCreator() {

    editingSeasonId = null;

    // Keep one complete creator-state object available while the season
    // is being built.  The previous implementation set this to null and
    // the advanced editors could create a partial season object, which
    // caused houseguest/advanced data to fall out of sync.
    currentSeason = {
        alliances: [],
        relationships: [],
        competitions: {
            hoh: [],
            pov: [],
            safety: [],
            luxury: [],
            finalHoh: []
        },
        twists: [],
        simulation: createDefaultSimulation()
    };

    currentHouseguestId = 0;

    editingRelationshipId = null;
    editingAllianceId = null;
    editingCompetitionId = null;
    editingTwistId = null;

    const fields = [
        "season-name",
        "season-theme",
        "season-description",
        "season-logo",
        "season-background"
    ];

    fields.forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.value = "";
        }
    });

    resetSeasonRules();

    const editor =
        document.getElementById("houseguest-editor");

    if (editor) {
        editor.innerHTML = "";
    }

    const countInput =
        document.getElementById("houseguest-count");

    if (countInput) {
        countInput.value = 16;
    }

    initializeHouseguestCount();

    resetRelationshipEditor();

    renderRelationships();
    clearAdvancedEditors();
    renderAlliances();
    renderCompetitions();
    renderTwists();

    setupImagePreviews();

}


function createNewSeason() {

    resetSeasonCreator();

    showPage("creator-page");
}


/* =========================================================
   HOUSEGUEST EDITOR
   ========================================================= */

function initializeHouseguestCount() {

    const editor =
        document.getElementById("houseguest-editor");

    if (!editor) {
        return;
    }

    if (editor.children.length > 0) {
        updateHouseguestNumbers();
        populateRelationshipHouseguestOptions();
        return;
    }

    const countInput =
        document.getElementById("houseguest-count");

    const count =
        countInput
            ? parseInt(countInput.value, 10) || 16
            : 16;

    for (let i = 0; i < count; i++) {
        addHouseguest();
    }

    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();
}


function addHouseguest(data = null) {

    const editor =
        document.getElementById("houseguest-editor");

    if (!editor) {
        return;
    }

    currentHouseguestId++;

    const id =
        data && data.id
            ? data.id
            : `hg-${currentHouseguestId}`;

    const card =
        document.createElement("div");

    card.className = "houseguest-card";

    card.dataset.houseguestId = id;

    const houseguest =
        data || createDefaultHouseguest(id);

    card.innerHTML = `

        <div class="houseguest-card-header">

            <h3 class="houseguest-number">
                Houseguest
            </h3>

            <button
                type="button"
                class="secondary-button"
                onclick="removeHouseguest('${id}')"
            >
                Remove
            </button>

        </div>


        <div class="houseguest-photo-section">

            <div
                class="houseguest-photo-preview"
                id="houseguest-photo-preview-${id}"
            >

                <span>
                    Photo Preview
                </span>

                <img
                    id="houseguest-photo-image-${id}"
                    src=""
                    alt="Houseguest"
                >

            </div>


            <div class="form-group">

                <label for="houseguest-image-${id}">
                    Image URL
                </label>

                <input
                    type="url"
                    id="houseguest-image-${id}"
                    value="${escapeAttribute(
                        houseguest.image || ""
                    )}"
                    placeholder="https://..."
                    oninput="updateHouseguestImage(
                        '${id}',
                        this.value
                    )"
                >

            </div>

        </div>


        <div class="houseguest-basic-info">

            <div class="form-group">

                <label for="houseguest-name-${id}">
                    Name
                </label>

                <input
                    type="text"
                    id="houseguest-name-${id}"
                    value="${escapeAttribute(
                        houseguest.name || ""
                    )}"
                    placeholder="Houseguest Name"
                >

            </div>


            <div class="form-group">

                <label for="houseguest-age-${id}">
                    Age
                </label>

                <input
                    type="number"
                    id="houseguest-age-${id}"
                    value="${escapeAttribute(
                        houseguest.age ?? ""
                    )}"
                    min="18"
                    max="100"
                    placeholder="Age"
                >

            </div>


            <div class="form-group">

                <label for="houseguest-occupation-${id}">
                    Occupation
                </label>

                <input
                    type="text"
                    id="houseguest-occupation-${id}"
                    value="${escapeAttribute(
                        houseguest.occupation || ""
                    )}"
                    placeholder="Occupation"
                >

            </div>

        </div>


        <div class="houseguest-ratings">

            <div class="section-label">
                PLAYER RATINGS
            </div>


            <div class="ratings-grid">

                ${createRatingInput(
                    id,
                    "general",
                    "General",
                    houseguest.ratings?.general
                )}

                ${createRatingInput(
                    id,
                    "physical",
                    "Physical",
                    houseguest.ratings?.physical
                )}

                ${createRatingInput(
                    id,
                    "mental",
                    "Mental",
                    houseguest.ratings?.mental
                )}

                ${createRatingInput(
                    id,
                    "social",
                    "Social",
                    houseguest.ratings?.social
                )}

                ${createRatingInput(
                    id,
                    "strategic",
                    "Strategic",
                    houseguest.ratings?.strategic
                )}

            </div>

        </div>
    `;

    editor.appendChild(card);

    updateHouseguestImage(
        id,
        houseguest.image || ""
    );

    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();
    refreshAdvancedHouseguestOptions();
}


function createDefaultHouseguest(id) {

    return {

        id,

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


function createRatingInput(
    houseguestId,
    key,
    label,
    value
) {

    const rating =
        value !== undefined &&
        value !== null &&
        value !== ""
            ? value
            : 5;

    return `

        <div class="rating-group">

            <label for="rating-${houseguestId}-${key}">
                ${label}
            </label>

            <input
                type="number"
                id="rating-${houseguestId}-${key}"
                min="1"
                max="10"
                value="${rating}"
            >

        </div>

    `;
}


function removeHouseguest(id) {

    const card =
        document.querySelector(
            `.houseguest-card[data-houseguest-id="${id}"]`
        );

    if (!card) {
        return;
    }

    const confirmed =
        confirm(
            "Remove this houseguest?"
        );

    if (!confirmed) {
        return;
    }

    card.remove();

    cleanupRelationshipsForHouseguest(id);
    cleanupAlliancesForHouseguest(id);

    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();
    refreshAdvancedHouseguestOptions();

    renderRelationships();
}


function updateHouseguestNumbers() {

    const cards =
        document.querySelectorAll(
            ".houseguest-card"
        );

    cards.forEach((card, index) => {

        const heading =
            card.querySelector(
                ".houseguest-number"
            );

        if (heading) {

            heading.textContent =
                `Houseguest ${index + 1}`;
        }
    });

    const countInput =
        document.getElementById(
            "houseguest-count"
        );

    if (countInput) {
        countInput.value = cards.length;
    }
}


function updateHouseguestCount() {

    const countInput =
        document.getElementById(
            "houseguest-count"
        );

    const editor =
        document.getElementById(
            "houseguest-editor"
        );

    if (!countInput || !editor) {
        return;
    }

    let requestedCount =
        parseInt(
            countInput.value,
            10
        );

    if (isNaN(requestedCount)) {
        requestedCount = 16;
    }

    requestedCount =
        Math.max(
            2,
            Math.min(
                100,
                requestedCount
            )
        );

    countInput.value = requestedCount;

    const currentCount =
        editor.querySelectorAll(
            ".houseguest-card"
        ).length;

    if (requestedCount > currentCount) {

        for (
            let i = currentCount;
            i < requestedCount;
            i++
        ) {
            addHouseguest();
        }

    } else if (
        requestedCount < currentCount
    ) {

        const cards =
            Array.from(
                editor.querySelectorAll(
                    ".houseguest-card"
                )
            );

        for (
            let i = cards.length - 1;
            i >= requestedCount;
            i--
        ) {

            const id =
                cards[i].dataset.houseguestId;

            cards[i].remove();

            cleanupRelationshipsForHouseguest(
                id
            );
        }
    }

    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();
    refreshAdvancedHouseguestOptions();
    renderRelationshipMatrix();

    renderRelationships();
}


function updateHouseguestImage(id, url) {

    const image =
        document.getElementById(
            `houseguest-photo-image-${id}`
        );

    const preview =
        document.getElementById(
            `houseguest-photo-preview-${id}`
        );

    if (!image || !preview) {
        return;
    }

    if (!url || !url.trim()) {

        showHouseguestPlaceholder(id);

        return;
    }

    image.onload = () => {

        image.style.display = "block";

        const span =
            preview.querySelector(
                "span"
            );

        if (span) {
            span.style.display = "none";
        }
    };

    image.onerror = () => {

        showHouseguestPlaceholder(id);
    };

    image.src = url.trim();
}


function showHouseguestPlaceholder(id) {

    const image =
        document.getElementById(
            `houseguest-photo-image-${id}`
        );

    const preview =
        document.getElementById(
            `houseguest-photo-preview-${id}`
        );

    if (!image || !preview) {
        return;
    }

    image.style.display = "none";

    image.removeAttribute("src");

    let span =
        preview.querySelector(
            "span"
        );

    if (!span) {

        span =
            document.createElement(
                "span"
            );

        preview.appendChild(span);
    }

    span.textContent =
        "Photo Preview";

    span.style.display = "block";
}


function collectHouseguests() {

    const cards =
        document.querySelectorAll(
            ".houseguest-card"
        );

    return Array.from(cards).map(
        (card, index) => {

            const id =
                card.dataset.houseguestId ||
                `hg-${index + 1}`;

            return {

                id,

                name:
                    getInputValue(
                        `houseguest-name-${id}`
                    ),

                image:
                    getInputValue(
                        `houseguest-image-${id}`
                    ),

                age:
                    getInputValue(
                        `houseguest-age-${id}`
                    ),

                occupation:
                    getInputValue(
                        `houseguest-occupation-${id}`
                    ),

                ratings: {

                    general:
                        getRatingValue(
                            `rating-${id}-general`
                        ),

                    physical:
                        getRatingValue(
                            `rating-${id}-physical`
                        ),

                    mental:
                        getRatingValue(
                            `rating-${id}-mental`
                        ),

                    social:
                        getRatingValue(
                            `rating-${id}-social`
                        ),

                    strategic:
                        getRatingValue(
                            `rating-${id}-strategic`
                        )

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
    );
}


function getRatingValue(id) {

    const input =
        document.getElementById(id);

    if (!input) {
        return 5;
    }

    let value =
        parseInt(
            input.value,
            10
        );

    if (isNaN(value)) {
        value = 5;
    }

    return Math.max(
        1,
        Math.min(
            10,
            value
        )
    );
}


/* =========================================================
   IMAGE PREVIEWS
   ========================================================= */

function setupImagePreviews() {

    const logoInput =
        document.getElementById(
            "season-logo"
        );

    const backgroundInput =
        document.getElementById(
            "season-background"
        );

    if (logoInput) {

        logoInput.oninput =
            updateSeasonLogoPreview;
    }

    if (backgroundInput) {

        backgroundInput.oninput =
            updateSeasonBackground;
    }
}


function updateSeasonLogoPreview() {

    const input =
        document.getElementById(
            "season-logo"
        );

    const image =
        document.getElementById(
            "season-logo-preview-image"
        );

    const preview =
        document.getElementById(
            "season-logo-preview"
        );

    if (!input || !image || !preview) {
        return;
    }

    const url =
        input.value.trim();

    if (!url) {

        image.style.display = "none";

        const span =
            preview.querySelector(
                "span"
            );

        if (span) {
            span.style.display = "block";
        }

        return;
    }

    image.onload = () => {

        image.style.display = "block";

        const span =
            preview.querySelector(
                "span"
            );

        if (span) {
            span.style.display = "none";
        }
    };

    image.onerror = () => {

        image.style.display = "none";

        const span =
            preview.querySelector(
                "span"
            );

        if (span) {
            span.textContent =
                "Unable to load logo";
            span.style.display = "block";
        }
    };

    image.src = url;
}


function updateSeasonBackground() {

    const input =
        document.getElementById(
            "season-background"
        );

    if (!input) {
        return;
    }

    const url =
        input.value.trim();

    if (url) {

        document.body.style.backgroundImage =
            `linear-gradient(
                rgba(11,13,18,0.90),
                rgba(11,13,18,0.90)
            ),
            url("${url}")`;

        document.body.style.backgroundSize =
            "cover";

        document.body.style.backgroundAttachment =
            "fixed";

    } else {

        document.body.style.backgroundImage =
            "";
    }
}


/* =========================================================
   SEASON RULES
   ========================================================= */

function setupRuleControls() {

    const nominees =
        document.getElementById(
            "rule-nominees"
        );

    const vetoPlayers =
        document.getElementById(
            "rule-veto-players"
        );

    const startingHOH =
        document.getElementById(
            "rule-starting-hoh"
        );

    if (nominees) {

        nominees.addEventListener(
            "change",
            updateCustomNomineesVisibility
        );
    }

    if (vetoPlayers) {

        vetoPlayers.addEventListener(
            "change",
            updateCustomVetoPlayersVisibility
        );
    }

    if (startingHOH) {

        startingHOH.addEventListener(
            "change",
            updateSpecificHOHVisibility
        );
    }

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();
}


function resetSeasonRules() {

    setValue(
        "rule-finalists",
        2
    );

    setValue(
        "rule-jury-size",
        7
    );

    setChecked(
        "rule-veto-enabled",
        true
    );

    setChecked(
        "rule-safety-enabled",
        false
    );

    setChecked(
        "rule-battle-back",
        false
    );

    setChecked(
        "rule-double-eviction",
        false
    );

    setValue(
        "rule-nominees",
        "2"
    );

    setValue(
        "rule-custom-nominees",
        2
    );

    setValue(
        "rule-veto-players",
        "6"
    );

    setValue(
        "rule-custom-veto-players",
        6
    );

    setValue(
        "rule-eviction-type",
        "house"
    );

    setValue(
        "rule-starting-hoh",
        "random"
    );

    setValue(
        "rule-specific-hoh",
        ""
    );

    setChecked(
        "rule-jury-voting",
        true
    );

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();
}


function collectSeasonRules() {

    let nominees =
        getValue(
            "rule-nominees"
        );

    if (nominees === "custom") {

        nominees =
            parseInt(
                getValue(
                    "rule-custom-nominees"
                ),
                10
            ) || 2;
    } else {

        nominees =
            parseInt(
                nominees,
                10
            ) || 2;
    }


    let vetoPlayers =
        getValue(
            "rule-veto-players"
        );

    if (vetoPlayers === "custom") {

        vetoPlayers =
            parseInt(
                getValue(
                    "rule-custom-veto-players"
                ),
                10
            ) || 6;

    } else {

        vetoPlayers =
            parseInt(
                vetoPlayers,
                10
            ) || 6;
    }


    return {

        finalists:
            parseInt(
                getValue(
                    "rule-finalists"
                ),
                10
            ) || 2,

        jurySize:
            parseInt(
                getValue(
                    "rule-jury-size"
                ),
                10
            ) || 7,

        vetoEnabled:
            getChecked(
                "rule-veto-enabled"
            ),

        safetyCompetitionEnabled:
            getChecked(
                "rule-safety-enabled"
            ),

        battleBackEnabled:
            getChecked(
                "rule-battle-back"
            ),

        doubleEvictionEnabled:
            getChecked(
                "rule-double-eviction"
            ),

        nomineesPerWeek:
            nominees,

        vetoPlayers:
            vetoPlayers,

        evictionType:
            getValue(
                "rule-eviction-type"
            ) || "house",

        startingHOH:
            getValue(
                "rule-starting-hoh"
            ) || "random",

        specificStartingHOH:
            getValue(
                "rule-specific-hoh"
            ) || "",

        juryVotingEnabled:
            getChecked(
                "rule-jury-voting"
            )
    };
}


function updateCustomNomineesVisibility() {

    const select =
        document.getElementById(
            "rule-nominees"
        );

    const container =
        document.getElementById(
            "custom-nominees-container"
        );

    if (!select || !container) {
        return;
    }

    container.style.display =
        select.value === "custom"
            ? "block"
            : "none";
}


function updateCustomVetoPlayersVisibility() {

    const select =
        document.getElementById(
            "rule-veto-players"
        );

    const container =
        document.getElementById(
            "custom-veto-players-container"
        );

    if (!select || !container) {
        return;
    }

    container.style.display =
        select.value === "custom"
            ? "block"
            : "none";
}


function updateSpecificHOHVisibility() {

    const select =
        document.getElementById(
            "rule-starting-hoh"
        );

    const container =
        document.getElementById(
            "specific-hoh-container"
        );

    if (!select || !container) {
        return;
    }

    container.style.display =
        select.value === "specific"
            ? "block"
            : "none";

    if (
        select.value === "specific"
    ) {

        populateSpecificHOHOptions();
    }
}


function populateSpecificHOHOptions() {

    const select =
        document.getElementById(
            "rule-specific-hoh"
        );

    if (!select) {
        return;
    }

    const currentValue =
        select.value;

    select.innerHTML = `
        <option value="">
            Select Houseguest
        </option>
    `;

    const houseguests =
        collectHouseguests();

    houseguests.forEach(
        houseguest => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                houseguest.id;

            option.textContent =
                houseguest.name ||
                "Unnamed Houseguest";

            select.appendChild(option);
        }
    );

    if (
        houseguests.some(
            houseguest =>
                houseguest.id === currentValue
        )
    ) {

        select.value =
            currentValue;
    }
}


function loadSeasonRules(rules = {}) {

    setValue(
        "rule-finalists",
        rules.finalists ?? 2
    );

    setValue(
        "rule-jury-size",
        rules.jurySize ?? 7
    );

    setChecked(
        "rule-veto-enabled",
        rules.vetoEnabled !== false
    );

    setChecked(
        "rule-safety-enabled",
        rules.safetyCompetitionEnabled === true
    );

    setChecked(
        "rule-battle-back",
        rules.battleBackEnabled === true
    );

    setChecked(
        "rule-double-eviction",
        rules.doubleEvictionEnabled === true
    );

    setValue(
        "rule-nominees",
        rules.nomineesPerWeek ?? 2
    );

    if (
        !["2", "3", "4"].includes(
            String(
                rules.nomineesPerWeek ?? 2
            )
        )
    ) {

        setValue(
            "rule-nominees",
            "custom"
        );

        setValue(
            "rule-custom-nominees",
            rules.nomineesPerWeek ?? 2
        );
    }

    setValue(
        "rule-veto-players",
        rules.vetoPlayers ?? 6
    );

    if (
        !["3", "4", "5", "6"].includes(
            String(
                rules.vetoPlayers ?? 6
            )
        )
    ) {

        setValue(
            "rule-veto-players",
            "custom"
        );

        setValue(
            "rule-custom-veto-players",
            rules.vetoPlayers ?? 6
        );
    }

    setValue(
        "rule-eviction-type",
        rules.evictionType || "house"
    );

    setValue(
        "rule-starting-hoh",
        rules.startingHOH || "random"
    );

    setValue(
        "rule-specific-hoh",
        rules.specificStartingHOH || ""
    );

    setChecked(
        "rule-jury-voting",
        rules.juryVotingEnabled !== false
    );

    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();

    populateSpecificHOHOptions();
}


/* =========================================================
   RELATIONSHIPS
   ========================================================= */

function setupRelationshipControls() {

    const relationshipInputs =
        RELATIONSHIP_KEYS.map(
            key =>
                document.getElementById(
                    `relationship-${key}`
                )
        );

    relationshipInputs.forEach(
        input => {

            if (!input) {
                return;
            }

            input.addEventListener(
                "input",
                updateRelationshipDisplay
            );

            input.addEventListener(
                "change",
                updateRelationshipDisplay
            );
        }
    );

    const fromSelect =
        document.getElementById(
            "relationship-from"
        );

    const toSelect =
        document.getElementById(
            "relationship-to"
        );

    if (fromSelect) {

        fromSelect.addEventListener(
            "change",
            handleRelationshipSelectionChange
        );
    }

    if (toSelect) {

        toSelect.addEventListener(
            "change",
            handleRelationshipSelectionChange
        );
    }

    resetRelationshipEditor();

    updateRelationshipDisplay();

    populateRelationshipHouseguestOptions();
}


function resetRelationshipEditor() {

    editingRelationshipId = null;

    setValue(
        "relationship-from",
        ""
    );

    setValue(
        "relationship-to",
        ""
    );

    setRelationshipValue(
        "friendship",
        5
    );

    setRelationshipValue(
        "trust",
        5
    );

    setRelationshipValue(
        "loyalty",
        5
    );

    setRelationshipValue(
        "rivalry",
        0
    );

    setRelationshipValue(
        "respect",
        5
    );

    setRelationshipValue(
        "attraction",
        0
    );

    updateRelationshipDisplay();

    const button =
        document.querySelector(
            ".relationship-actions .primary-button"
        );

    if (button) {

        button.textContent =
            "Add Relationship";
    }
}


function setRelationshipValue(
    key,
    value
) {

    const input =
        document.getElementById(
            `relationship-${key}`
        );

    if (input) {

        input.value =
            Math.max(
                0,
                Math.min(
                    10,
                    Number(value)
                )
            );
    }
}


function getRelationshipValue(key) {

    const input =
        document.getElementById(
            `relationship-${key}`
        );

    if (!input) {
        return 0;
    }

    const value =
        Number(
            input.value
        );

    if (isNaN(value)) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            10,
            value
        )
    );
}


function updateRelationshipDisplay() {

    RELATIONSHIP_KEYS.forEach(
        key => {

            const value =
                getRelationshipValue(
                    key
                );

            const display =
                document.getElementById(
                    `relationship-${key}-value`
                );

            if (display) {

                display.textContent =
                    Number.isInteger(value)
                        ? value
                        : value.toFixed(1);
            }
        }
    );


    const overall =
        calculateOverallRelationship({

            friendship:
                getRelationshipValue(
                    "friendship"
                ),

            trust:
                getRelationshipValue(
                    "trust"
                ),

            loyalty:
                getRelationshipValue(
                    "loyalty"
                ),

            rivalry:
                getRelationshipValue(
                    "rivalry"
                ),

            respect:
                getRelationshipValue(
                    "respect"
                ),

            attraction:
                getRelationshipValue(
                    "attraction"
                )
        });


    const overallDisplay =
        document.getElementById(
            "relationship-overall-value"
        );

    if (overallDisplay) {

        overallDisplay.textContent =
            overall.toFixed(1);
    }
}


function calculateOverallRelationship(
    relationship
) {

    /*
     * Overall relationship is intentionally based on:
     *
     * Friendship
     * Trust
     * Loyalty
     * Respect
     *
     * Rivalry acts as a negative modifier.
     *
     * Attraction is kept separate so that romantic attraction
     * does not automatically turn into a stronger strategic
     * relationship.
     */

    const positiveAverage =
        (
            Number(
                relationship.friendship || 0
            ) +

            Number(
                relationship.trust || 0
            ) +

            Number(
                relationship.loyalty || 0
            ) +

            Number(
                relationship.respect || 0
            )
        ) / 4;


    const rivalry =
        Number(
            relationship.rivalry || 0
        );


    const overall =
        positiveAverage -
        (
            rivalry * 0.5
        );


    return Math.max(
        0,
        Math.min(
            10,
            overall
        )
    );
}


function populateRelationshipHouseguestOptions() {

    const fromSelect =
        document.getElementById(
            "relationship-from"
        );

    const toSelect =
        document.getElementById(
            "relationship-to"
        );

    if (!fromSelect || !toSelect) {
        return;
    }

    const currentFrom =
        fromSelect.value;

    const currentTo =
        toSelect.value;

    const houseguests =
        collectHouseguests();


    fromSelect.innerHTML = `
        <option value="">
            Select Houseguest
        </option>
    `;

    toSelect.innerHTML = `
        <option value="">
            Select Houseguest
        </option>
    `;


    houseguests.forEach(
        houseguest => {

            const name =
                houseguest.name ||
                `Houseguest ${getHouseguestNumber(
                    houseguest.id
                )}`;


            const fromOption =
                document.createElement(
                    "option"
                );

            fromOption.value =
                houseguest.id;

            fromOption.textContent =
                name;

            fromSelect.appendChild(
                fromOption
            );


            const toOption =
                document.createElement(
                    "option"
                );

            toOption.value =
                houseguest.id;

            toOption.textContent =
                name;

            toSelect.appendChild(
                toOption
            );
        }
    );


    if (
        houseguests.some(
            hg =>
                hg.id === currentFrom
        )
    ) {

        fromSelect.value =
            currentFrom;
    }

    if (
        houseguests.some(
            hg =>
                hg.id === currentTo
        )
    ) {

        toSelect.value =
            currentTo;
    }
}


function handleRelationshipSelectionChange() {

    const from =
        getValue(
            "relationship-from"
        );

    const to =
        getValue(
            "relationship-to"
        );


    if (
        !from ||
        !to ||
        from === to
    ) {

        return;
    }


    if (
        !currentSeason ||
        !Array.isArray(
            currentSeason.relationships
        )
    ) {

        return;
    }


    const existing =
        currentSeason.relationships.find(
            relationship =>
                relationship.from === from &&
                relationship.to === to
        );


    if (existing) {

        loadRelationshipIntoEditor(
            existing
        );
    }
}


function addRelationship() {

    const from =
        getValue(
            "relationship-from"
        );

    const to =
        getValue(
            "relationship-to"
        );


    if (!from || !to) {

        alert(
            "Please select both houseguests."
        );

        return;
    }


    if (from === to) {

        alert(
            "A houseguest cannot have a relationship with themselves."
        );

        return;
    }


    if (!currentSeason) {

        /*
         * The creator has not been saved yet.
         *
         * Keep a temporary relationship collection so the
         * user can build relationships before saving.
         */

        currentSeason = {
            relationships: []
        };
    }


    if (
        !Array.isArray(
            currentSeason.relationships
        )
    ) {

        currentSeason.relationships = [];
    }


    const relationship = {

        id:
            editingRelationshipId ||
            generateRelationshipId(),

        from,

        to,

        friendship:
            getRelationshipValue(
                "friendship"
            ),

        trust:
            getRelationshipValue(
                "trust"
            ),

        loyalty:
            getRelationshipValue(
                "loyalty"
            ),

        rivalry:
            getRelationshipValue(
                "rivalry"
            ),

        respect:
            getRelationshipValue(
                "respect"
            ),

        attraction:
            getRelationshipValue(
                "attraction"
            )
    };


    const duplicate =
        currentSeason.relationships.find(
            existing =>
                existing.from === from &&
                existing.to === to &&
                existing.id !== relationship.id
        );


    if (duplicate) {

        /*
         * If the pair already exists, update that
         * directional relationship instead of creating
         * a duplicate.
         */

        relationship.id =
            duplicate.id;
    }


    const existingIndex =
        currentSeason.relationships.findIndex(
            existing =>
                existing.id === relationship.id
        );


    if (existingIndex >= 0) {

        currentSeason.relationships[
            existingIndex
        ] = relationship;

    } else {

        currentSeason.relationships.push(
            relationship
        );
    }


    editingRelationshipId = null;

    renderRelationships();

    resetRelationshipEditor();

    /*
     * If the season is already a saved season, update it
     * immediately in localStorage.
     */

    if (
        currentSeason.id &&
        savedSeasons.some(
            season =>
                season.id === currentSeason.id
        )
    ) {

        const savedIndex =
            savedSeasons.findIndex(
                season =>
                    season.id === currentSeason.id
            );

        if (savedIndex >= 0) {

            savedSeasons[
                savedIndex
            ].relationships =
                currentSeason.relationships;

            savedSeasons[
                savedIndex
            ].updatedAt =
                new Date().toISOString();

            saveSeasonsToStorage();

            renderSavedSeasons();
        }
    }
}


function editRelationship(id) {

    if (!currentSeason) {
        return;
    }

    const relationship =
        (
            currentSeason.relationships ||
            []
        ).find(
            item =>
                item.id === id
        );


    if (!relationship) {
        return;
    }


    loadRelationshipIntoEditor(
        relationship
    );


    const section =
        document.getElementById(
            "relationships-section"
        );

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


function loadRelationshipIntoEditor(
    relationship
) {

    if (!relationship) {
        return;
    }

    editingRelationshipId =
        relationship.id;


    setValue(
        "relationship-from",
        relationship.from
    );

    setValue(
        "relationship-to",
        relationship.to
    );


    setRelationshipValue(
        "friendship",
        relationship.friendship
    );

    setRelationshipValue(
        "trust",
        relationship.trust
    );

    setRelationshipValue(
        "loyalty",
        relationship.loyalty
    );

    setRelationshipValue(
        "rivalry",
        relationship.rivalry
    );

    setRelationshipValue(
        "respect",
        relationship.respect
    );

    setRelationshipValue(
        "attraction",
        relationship.attraction
    );


    updateRelationshipDisplay();


    const button =
        document.querySelector(
            ".relationship-actions .primary-button"
        );

    if (button) {

        button.textContent =
            "Update Relationship";
    }
}


function deleteRelationship(id) {

    if (!currentSeason) {
        return;
    }


    const confirmed =
        confirm(
            "Delete this relationship?"
        );


    if (!confirmed) {
        return;
    }


    if (
        !Array.isArray(
            currentSeason.relationships
        )
    ) {

        return;
    }


    currentSeason.relationships =
        currentSeason.relationships.filter(
            relationship =>
                relationship.id !== id
        );


    if (
        editingRelationshipId === id
    ) {

        resetRelationshipEditor();
    }


    renderRelationships();


    if (
        currentSeason.id &&
        savedSeasons.some(
            season =>
                season.id === currentSeason.id
        )
    ) {

        const savedIndex =
            savedSeasons.findIndex(
                season =>
                    season.id === currentSeason.id
            );


        if (savedIndex >= 0) {

            savedSeasons[
                savedIndex
            ].relationships =
                currentSeason.relationships;

            savedSeasons[
                savedIndex
            ].updatedAt =
                new Date().toISOString();

            saveSeasonsToStorage();

            renderSavedSeasons();
        }
    }
}


function cleanupRelationshipsForHouseguest(
    houseguestId
) {

    if (
        !currentSeason ||
        !Array.isArray(
            currentSeason.relationships
        )
    ) {

        return;
    }


    currentSeason.relationships =
        currentSeason.relationships.filter(
            relationship =>
                relationship.from !== houseguestId &&
                relationship.to !== houseguestId
        );


    if (
        editingRelationshipId
    ) {

        const stillExists =
            currentSeason.relationships.some(
                relationship =>
                    relationship.id ===
                    editingRelationshipId
            );


        if (!stillExists) {

            resetRelationshipEditor();
        }
    }
}


function relationshipPresetValues(preset) {
    const presets = {
        enemy:       { friendship:1, trust:0, loyalty:0, rivalry:9, respect:2, attraction:0 },
        dislike:     { friendship:2, trust:2, loyalty:2, rivalry:6, respect:3, attraction:0 },
        neutral:     { friendship:5, trust:5, loyalty:5, rivalry:0, respect:5, attraction:0 },
        good:        { friendship:7, trust:6, loyalty:6, rivalry:0, respect:7, attraction:0 },
        close:       { friendship:8, trust:8, loyalty:8, rivalry:0, respect:8, attraction:0 },
        bestfriends: { friendship:10, trust:9, loyalty:10, rivalry:0, respect:9, attraction:0 },
        showmance:   { friendship:9, trust:8, loyalty:8, rivalry:0, respect:8, attraction:10 },
        rivalry:     { friendship:2, trust:1, loyalty:1, rivalry:10, respect:4, attraction:0 }
    };
    return presets[preset] || presets.neutral;
}

function relationshipPresetLabel(preset) {
    return ({enemy:"Enemy",dislike:"Dislike",neutral:"Neutral",good:"Good",close:"Close",bestfriends:"Best Friends",showmance:"Showmance",rivalry:"Rivals"})[preset] || "Neutral";
}

function findRelationship(from, to) {
    return (currentSeason?.relationships || []).find(r => r.from === from && r.to === to);
}

function upsertRelationshipPreset(from, to, preset) {
    if (!from || !to || from === to) return;
    if (!currentSeason) getAdvancedArrays();
    if (!Array.isArray(currentSeason.relationships)) currentSeason.relationships = [];
    const values = relationshipPresetValues(preset);
    let r = findRelationship(from, to);
    if (!r) {
        r = { id: generateRelationshipId(), from, to, ...values };
        currentSeason.relationships.push(r);
    } else {
        Object.assign(r, values);
    }
}

function renderRelationshipMatrix() {
    const container = document.getElementById("relationship-matrix-container");
    if (!container) return;
    const guests = collectHouseguests();
    if (guests.length < 2) {
        container.innerHTML = '<div class="empty-state"><p>Add at least two houseguests to use the quick relationship matrix.</p></div>';
        return;
    }
    const options = `<option value="">—</option><option value="enemy">Enemy</option><option value="dislike">Dislike</option><option value="neutral">Neutral</option><option value="good">Good</option><option value="close">Close</option><option value="bestfriends">Best Friends</option><option value="showmance">Showmance</option><option value="rivalry">Rivals</option>`;
    let html = '<div class="relationship-matrix-scroll"><table class="relationship-matrix"><thead><tr><th class="matrix-corner">FEELS ABOUT →</th>';
    guests.forEach(g => html += `<th title="${escapeAttribute(g.name || "Houseguest")}">${escapeHTML(g.name || "HG")}</th>`);
    html += '</tr></thead><tbody>';
    guests.forEach(from => {
        html += `<tr><th title="${escapeAttribute(from.name || "Houseguest")}">${escapeHTML(from.name || "Houseguest")}</th>`;
        guests.forEach(to => {
            if (from.id === to.id) { html += '<td class="matrix-self">—</td>'; return; }
            const r = findRelationship(from.id, to.id);
            const overall = r ? calculateOverallRelationship(r) : null;
            html += `<td><select class="matrix-select" data-from="${escapeAttribute(from.id)}" data-to="${escapeAttribute(to.id)}" aria-label="${escapeAttribute((from.name||"Houseguest")+" feelings toward "+(to.name||"Houseguest"))}">${options}</select>${overall !== null ? `<span class="matrix-score">${overall.toFixed(1)}</span>` : ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div><div class="matrix-legend"><span><b>Quick set:</b> choose a relationship type in any cell.</span><span>Click Edit below for individual ratings.</span></div>';
    container.innerHTML = html;
    container.querySelectorAll('.matrix-select').forEach(select => {
        const r = findRelationship(select.dataset.from, select.dataset.to);
        if (r) select.value = inferRelationshipPreset(r);
        select.addEventListener('change', () => {
            if (!select.value) return;
            upsertRelationshipPreset(select.dataset.from, select.dataset.to, select.value);
            renderRelationshipMatrix();
            renderRelationships();
            persistCurrentSeasonIfSaved();
        });
    });
}

function inferRelationshipPreset(r) {
    const v = Number(r?.friendship||0), t=Number(r?.trust||0), l=Number(r?.loyalty||0), rv=Number(r?.rivalry||0), a=Number(r?.attraction||0);
    if (a >= 9 && v >= 8) return 'showmance';
    if (rv >= 8 && v <= 3) return 'rivalry';
    if (rv >= 7) return 'enemy';
    if (v >= 9 && t >= 8 && l >= 9) return 'bestfriends';
    if (v >= 8 && t >= 7 && l >= 7) return 'close';
    if (v >= 7 && t >= 6) return 'good';
    if (v <= 2 && t <= 2) return 'dislike';
    return 'neutral';
}

function resetRelationshipMatrix() {
    if (!currentSeason || !Array.isArray(currentSeason.relationships)) return;
    if (!confirm("Clear all relationships? This removes every saved directional relationship.")) return;
    currentSeason.relationships = [];
    resetRelationshipEditor();
    renderRelationshipMatrix();
    renderRelationships();
    persistCurrentSeasonIfSaved();
}

function persistCurrentSeasonIfSaved() {
    if (!currentSeason?.id || !savedSeasons.some(s => s.id === currentSeason.id)) return;
    const i = savedSeasons.findIndex(s => s.id === currentSeason.id);
    if (i < 0) return;
    savedSeasons[i].relationships = deepClone(currentSeason.relationships || []);
    savedSeasons[i].alliances = deepClone(currentSeason.alliances || []);
    savedSeasons[i].competitions = deepClone(currentSeason.competitions || {});
    savedSeasons[i].twists = deepClone(currentSeason.twists || []);
    savedSeasons[i].updatedAt = new Date().toISOString();
    saveSeasonsToStorage();
    renderSavedSeasons();
}

function renderRelationships() {

    const container =
        document.getElementById(
            "relationships-container"
        );

    if (!container) {
        return;
    }

    renderRelationshipMatrix();

    const relationships =
        currentSeason &&
        Array.isArray(
            currentSeason.relationships
        )
            ? currentSeason.relationships
            : [];


    if (relationships.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ♥
                </div>

                <h3>
                    No Relationships Added
                </h3>

                <p>
                    Select two houseguests above to create
                    the first relationship.
                </p>

            </div>

        `;

        return;
    }


    const houseguests =
        currentSeason &&
        Array.isArray(
            currentSeason.houseguests
        )
            ? currentSeason.houseguests
            : collectHouseguests();


    const getName =
        id => {

            const houseguest =
                houseguests.find(
                    hg =>
                        hg.id === id
                );


            return houseguest
                ? (
                    houseguest.name ||
                    `Houseguest ${
                        getHouseguestNumber(
                            houseguest.id
                        )
                    }`
                )
                : "Unknown";
        };


    let html = `

        <div class="relationship-table-wrapper">

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
                            Respect
                        </th>

                        <th>
                            Attraction
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
    `;


    relationships.forEach(
        relationship => {

            const overall =
                calculateOverallRelationship(
                    relationship
                );


            html += `

                <tr>

                    <td>

                        <span class="relationship-direction">

                            <span>
                                ${escapeHTML(
                                    getName(
                                        relationship.from
                                    )
                                )}
                            </span>

                            <span class="relationship-direction-arrow">
                                →
                            </span>

                            <span>
                                ${escapeHTML(
                                    getName(
                                        relationship.to
                                    )
                                )}
                            </span>

                        </span>

                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.friendship
                        )}
                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.trust
                        )}
                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.loyalty
                        )}
                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.rivalry
                        )}
                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.respect
                        )}
                    </td>


                    <td>
                        ${formatRelationshipNumber(
                            relationship.attraction
                        )}
                    </td>


                    <td>

                        <span class="relationship-score">
                            ${overall.toFixed(1)}
                        </span>

                    </td>


                    <td>

                        <div class="relationship-table-actions">

                            <button
                                type="button"
                                class="relationship-edit-button"
                                onclick="editRelationship('${relationship.id}')"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="relationship-delete-button"
                                onclick="deleteRelationship('${relationship.id}')"
                            >
                                Delete
                            </button>

                        </div>

                    </td>

                </tr>

            `;
        }
    );


    html += `

                </tbody>

            </table>

        </div>

    `;


    container.innerHTML =
        html;
}


function formatRelationshipNumber(
    value
) {

    const number =
        Number(value);

    if (isNaN(number)) {
        return "0";
    }

    return Number.isInteger(number)
        ? number
        : number.toFixed(1);
}


function generateRelationshipId() {

    return `
        relationship-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}
    `.replace(/\s+/g, "");
}


/* =========================================================
   SAVE SEASON
   ========================================================= */

function saveSeason() {

    const name =
        getValue(
            "season-name"
        ).trim();

    const theme =
        getValue(
            "season-theme"
        ).trim();

    const description =
        getValue(
            "season-description"
        ).trim();

    const logo =
        getValue(
            "season-logo"
        ).trim();

    const background =
        getValue(
            "season-background"
        ).trim();


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


    const rules =
        collectSeasonRules();


    /*
     * Preserve existing simulation data when editing
     * instead of resetting the simulation.
     */

    const existingSeason =
        editingSeasonId
            ? savedSeasons.find(
                season =>
                    season.id ===
                    editingSeasonId
            )
            : null;


    const existingRelationships =
        existingSeason &&
        Array.isArray(
            existingSeason.relationships
        )
            ? existingSeason.relationships
            : (
                currentSeason &&
                Array.isArray(
                    currentSeason.relationships
                )
                    ? currentSeason.relationships
                    : []
            );


    const season = {

        id:
            editingSeasonId ||
            generateSeasonId(),

        name,

        theme,

        description,

        logo,

        background,

        houseguests,

        alliances:
            collectAlliances(),

        relationships:
            existingRelationships,

        competitions:
            collectCompetitions(),

        twists:
            collectTwists(),

        rules,

        simulation:
            existingSeason?.simulation ||
            createDefaultSimulation(),

        createdAt:
            existingSeason?.createdAt ||
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()
    };


    const existingIndex =
        savedSeasons.findIndex(
            savedSeason =>
                savedSeason.id ===
                season.id
        );


    if (existingIndex >= 0) {

        savedSeasons[
            existingIndex
        ] = season;

    } else {

        savedSeasons.push(
            season
        );
    }


    currentSeason =
        deepClone(
            season
        );

    editingSeasonId =
        season.id;


    saveSeasonsToStorage();

    renderSavedSeasons();

    renderRelationships();

    alert(
        "Season saved successfully!"
    );

    showPage(
        "home-page"
    );
}


function generateSeasonId() {

    return `
        season-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}
    `.replace(/\s+/g, "");
}


function createDefaultSimulation() {

    return {

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

    };
}


/* =========================================================
   EDIT SEASON
   ========================================================= */

function editSeason(id) {

    const season =
        savedSeasons.find(
            item =>
                item.id === id
        );


    if (!season) {
        return;
    }


    editingSeasonId =
        season.id;


    currentSeason =
        deepClone(
            season
        );


    loadSeasonIntoCreator(
        currentSeason
    );


    showPage(
        "creator-page"
    );
}


function loadSeasonIntoCreator(
    season
) {

    setValue(
        "season-name",
        season.name || ""
    );

    setValue(
        "season-theme",
        season.theme || ""
    );

    setValue(
        "season-description",
        season.description || ""
    );

    setValue(
        "season-logo",
        season.logo || ""
    );

    setValue(
        "season-background",
        season.background || ""
    );


    loadHouseguests(
        season.houseguests || []
    );


    loadSeasonRules(
        season.rules || {}
    );


    resetRelationshipEditor();

    populateRelationshipHouseguestOptions();

    renderRelationships();
    loadAlliances(season.alliances || []);
    loadCompetitions(season.competitions || {});
    loadTwists(season.twists || []);


    updateSeasonLogoPreview();

    updateSeasonBackground();
}


function loadHouseguests(
    houseguests
) {

    const editor =
        document.getElementById(
            "houseguest-editor"
        );

    if (!editor) {
        return;
    }


    editor.innerHTML = "";

    currentHouseguestId = 0;


    houseguests.forEach(
        houseguest => {

            const numericPart =
                String(
                    houseguest.id || ""
                ).match(
                    /(\d+)$/
                );


            if (numericPart) {

                currentHouseguestId =
                    Math.max(
                        currentHouseguestId,
                        parseInt(
                            numericPart[1],
                            10
                        )
                    );
            }


            addHouseguest(
                houseguest
            );
        }
    );


    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();
}


/* =========================================================
   OPEN SEASON
   ========================================================= */

function openSeason(id) {

    const season =
        savedSeasons.find(
            item =>
                item.id === id
        );


    if (!season) {
        return;
    }


    currentSeason =
        deepClone(
            season
        );


    editingSeasonId =
        season.id;


    initializeSimulator(
        currentSeason
    );


    showPage(
        "simulator-page"
    );
}


/* =========================================================
   DELETE SEASON
   ========================================================= */

function deleteSeason(id) {

    const season =
        savedSeasons.find(
            item =>
                item.id === id
        );


    if (!season) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${season.name}"?`
        );


    if (!confirmed) {
        return;
    }


    savedSeasons =
        savedSeasons.filter(
            item =>
                item.id !== id
        );


    saveSeasonsToStorage();

    renderSavedSeasons();


    if (
        currentSeason &&
        currentSeason.id === id
    ) {

        currentSeason = null;

        editingSeasonId = null;
    }
}


/* =========================================================
   SIMULATOR
   ========================================================= */

function initializeSimulator(
    season
) {

    if (!season) {
        return;
    }


    if (!season.simulation) {

        season.simulation =
            createDefaultSimulation();
    }


    const simulation =
        season.simulation;


    setText(
        "simulator-season-name",
        season.name ||
        "Big Brother"
    );

    setText(
        "simulator-season-theme",
        season.theme ||
        "Custom Season"
    );

    setText(
        "current-week",
        simulation.currentWeek || 1
    );


    updateSimulatorStatus(
        simulation
    );


    resetGameChain(
        simulation.currentEventIndex || 0
    );


    showEvent(
        "Simulation Ready",
        "EVENT",
        `
            <p>
                Your season is ready to begin.
            </p>
        `
    );
}


function updateSimulatorStatus(
    simulation
) {

    if (!simulation) {
        return;
    }


    const houseguests =
        currentSeason?.houseguests ||
        [];


    setText(
        "current-hoh",
        getHouseguestDisplayName(
            simulation.currentHOH,
            houseguests
        )
    );


    setText(
        "current-nominees",
        formatHouseguestList(
            simulation.currentNominees,
            houseguests
        )
    );


    setText(
        "current-veto",
        getHouseguestDisplayName(
            simulation.currentPOVWinner,
            houseguests
        )
    );
}


function resetGameChain(
    activeIndex = 0
) {

    const steps =
        document.querySelectorAll(
            ".chain-step"
        );


    steps.forEach(
        (step, index) => {

            step.classList.toggle(
                "active",
                index === activeIndex
            );
        }
    );
}


function runNextEvent() {

    if (!currentSeason) {

        alert(
            "Please open a saved season first."
        );

        return;
    }


    if (!currentSeason.simulation) {

        currentSeason.simulation =
            createDefaultSimulation();
    }


    const simulation =
        currentSeason.simulation;


    const index =
        simulation.currentEventIndex || 0;


    const event =
        EVENT_CHAIN[index];


    switch (event) {

        case "hoh":

            runHOHEvent();

            break;


        case "nominations":

            runNominationEvent();

            break;


        case "pov-players":

            runPOVPlayersEvent();

            break;


        case "pov":

            runPOVEvent();

            break;


        case "veto-ceremony":

            runVetoCeremonyEvent();

            break;


        case "eviction":

            runEvictionEvent();

            break;


        default:

            simulation.currentEventIndex = 0;

            simulation.currentWeek++;

            setText(
                "current-week",
                simulation.currentWeek
            );

            resetGameChain(0);

            showEvent(
                "New Week",
                "WEEK",
                `
                    <p>
                        Week ${simulation.currentWeek}
                        is beginning.
                    </p>
                `
            );

            break;
    }


    persistCurrentSeason();
}


/* =========================================================
   SIMULATOR EVENTS
   ========================================================= */

function runHOHEvent() {

    const simulation =
        currentSeason.simulation;


    const houseguests =
        getActiveHouseguests();


    if (houseguests.length === 0) {
        return;
    }


    /*
     * This is still the foundation engine.
     * A real competition system will eventually determine
     * the winner using custom competition rules and player
     * ratings.
     */

    let hoh =
        null;


    if (
        simulation.currentWeek === 1 &&
        currentSeason.rules?.startingHOH ===
            "specific" &&
        currentSeason.rules?.specificStartingHOH
    ) {

        hoh =
            houseguests.find(
                houseguest =>
                    houseguest.id ===
                    currentSeason.rules
                        .specificStartingHOH
            );
    }


    if (!hoh) {
        const custom = chooseCustomCompetition("hoh");
        hoh = custom
            ? chooseCompetitionWinnerByCustom(houseguests, custom)
            : randomItem(houseguests);
    }


    simulation.currentHOH =
        hoh.id;


    hoh.hohWins =
        Number(
            hoh.hohWins || 0
        ) + 1;


    simulation.currentEventIndex = 1;


    updateSimulatorStatus(
        simulation
    );

    resetGameChain(1);


    showEvent(
        "Head of Household",
        "HOH",
        `
            <p>
                <strong>
                    ${escapeHTML(
                        getHouseguestDisplayName(
                            hoh.id,
                            houseguests
                        )
                    )}
                </strong>
                has won the Head of Household competition.
            </p>
        `
    );
}


function runNominationEvent() {

    const simulation =
        currentSeason.simulation;


    const active =
        getActiveHouseguests();


    const hohId =
        simulation.currentHOH;


    const eligible =
        active.filter(
            houseguest =>
                houseguest.id !== hohId
        );


    const nomineeCount =
        Math.min(
            Number(
                currentSeason.rules
                    ?.nomineesPerWeek || 2
            ),
            eligible.length
        );


    const nominees =
        chooseRandomPlayers(
            eligible,
            nomineeCount
        );


    simulation.currentNominees =
        nominees.map(
            houseguest =>
                houseguest.id
        );


    nominees.forEach(
        nominee => {

            nominee.nominationCount =
                Number(
                    nominee.nominationCount || 0
                ) + 1;
        }
    );


    simulation.currentEventIndex = 2;


    updateSimulatorStatus(
        simulation
    );

    resetGameChain(2);


    showEvent(
        "Nominations",
        "NOMINATIONS",
        `
            <p>
                The Head of Household has nominated:
            </p>

            <p>
                <strong>
                    ${escapeHTML(
                        nominees
                            .map(
                                nominee =>
                                    getHouseguestDisplayName(
                                        nominee.id,
                                        active
                                    )
                            )
                            .join(" & ")
                    )}
                </strong>
            </p>
        `
    );
}


function runPOVPlayersEvent() {

    const simulation =
        currentSeason.simulation;


    if (
        currentSeason.rules?.vetoEnabled ===
        false
    ) {

        simulation.currentPOVPlayers =
            [];

        simulation.currentEventIndex = 4;

        resetGameChain(4);

        showEvent(
            "Power of Veto Disabled",
            "POV PLAYERS",
            `
                <p>
                    The Power of Veto is disabled
                    for this season.
                </p>
            `
        );

        return;
    }


    const active =
        getActiveHouseguests();


    const requiredPlayers =
        Math.min(
            Number(
                currentSeason.rules
                    ?.vetoPlayers || 6
            ),
            active.length
        );


    const selected =
        chooseVetoPlayers(
            active,
            simulation.currentHOH,
            simulation.currentNominees,
            requiredPlayers
        );


    simulation.currentPOVPlayers =
        selected.map(
            houseguest =>
                houseguest.id
        );


    simulation.currentEventIndex = 3;


    resetGameChain(3);


    showEvent(
        "Power of Veto Players",
        "POV PLAYERS",
        `
            <p>
                The following houseguests will compete
                in the Power of Veto:
            </p>

            <p>
                <strong>
                    ${escapeHTML(
                        selected
                            .map(
                                player =>
                                    getHouseguestDisplayName(
                                        player.id,
                                        active
                                    )
                            )
                            .join(", ")
                    )}
                </strong>
            </p>
        `
    );
}


function runPOVEvent() {

    const simulation =
        currentSeason.simulation;


    if (
        currentSeason.rules?.vetoEnabled ===
        false
    ) {

        simulation.currentPOVWinner =
            null;

        simulation.currentEventIndex = 4;

        resetGameChain(4);

        return;
    }


    const players =
        simulation.currentPOVPlayers
            .map(
                id =>
                    currentSeason.houseguests.find(
                        houseguest =>
                            houseguest.id === id
                    )
            )
            .filter(Boolean);


    if (players.length === 0) {

        simulation.currentPOVWinner =
            null;

    } else {

        const custom = chooseCustomCompetition("pov");
        const winner = custom
            ? chooseCompetitionWinnerByCustom(players, custom)
            : chooseCompetitionWinner(players, "physical", "mental", "general");


        simulation.currentPOVWinner =
            winner.id;


        winner.povWins =
            Number(
                winner.povWins || 0
            ) + 1;
    }


    simulation.currentEventIndex = 4;


    updateSimulatorStatus(
        simulation
    );

    resetGameChain(4);


    showEvent(
        "Power of Veto",
        "POV",
        `
            <p>
                <strong>
                    ${escapeHTML(
                        getHouseguestDisplayName(
                            simulation.currentPOVWinner,
                            currentSeason.houseguests
                        )
                    )}
                </strong>
                has won the Power of Veto.
            </p>
        `
    );
}


function runVetoCeremonyEvent() {

    const simulation =
        currentSeason.simulation;


    if (
        currentSeason.rules?.vetoEnabled ===
        false
    ) {

        simulation.currentEventIndex = 5;

        resetGameChain(5);

        showEvent(
            "Veto Ceremony",
            "VETO CEREMONY",
            `
                <p>
                    The Power of Veto is not enabled
                    for this season.
                </p>
            `
        );

        return;
    }


    const vetoWinner =
        simulation.currentPOVWinner;


    const nominees =
        simulation.currentNominees || [];


    if (
        vetoWinner &&
        nominees.includes(vetoWinner)
    ) {

        const remaining =
            getActiveHouseguests().filter(
                houseguest =>
                    houseguest.id !==
                    simulation.currentHOH &&
                    !nominees.includes(
                        houseguest.id
                    )
            );


        if (remaining.length > 0) {

            const replacement =
                randomItem(
                    remaining
                );


            const index =
                nominees.indexOf(
                    vetoWinner
                );


            if (index >= 0) {

                simulation.currentNominees[
                    index
                ] =
                    replacement.id;
            }
        }
    }


    simulation.currentEventIndex = 5;


    updateSimulatorStatus(
        simulation
    );

    resetGameChain(5);


    showEvent(
        "Veto Ceremony",
        "VETO CEREMONY",
        `
            <p>
                The Power of Veto ceremony has been held.
            </p>

            <p>
                The current nominees are:
            </p>

            <p>
                <strong>
                    ${escapeHTML(
                        formatHouseguestList(
                            simulation.currentNominees,
                            currentSeason.houseguests
                        )
                    )}
                </strong>
            </p>
        `
    );
}


function runEvictionEvent() {

    const simulation =
        currentSeason.simulation;


    const nominees =
        simulation.currentNominees || [];


    const active =
        getActiveHouseguests();


    if (nominees.length === 0) {

        simulation.currentEventIndex = 0;

        simulation.currentWeek++;

        setText(
            "current-week",
            simulation.currentWeek
        );

        resetGameChain(0);

        showEvent(
            "New Week",
            "WEEK",
            `
                <p>
                    No eviction can occur because there
                    are no current nominees.
                </p>
            `
        );

        return;
    }


    /*
     * Temporary foundation behavior:
     * randomly select an eviction target.
     *
     * Later, this will use:
     * - relationships
     * - alliances
     * - strategy
     * - nominations
     * - veto usage
     * - threat level
     * - voting preferences
     */

    const nomineesAsPlayers =
        nominees
            .map(
                id =>
                    active.find(
                        houseguest =>
                            houseguest.id === id
                    )
            )
            .filter(Boolean);


    const evictionTarget = chooseEvictionTarget(nomineesAsPlayers, active);


    if (evictionTarget) {

        evictionTarget.status =
            "evicted";

        evictionTarget.placement =
            active.length;


        simulation.currentEviction =
            evictionTarget.id;


        simulation.finalPlacements.push(
            {
                id:
                    evictionTarget.id,

                name:
                    evictionTarget.name,

                placement:
                    evictionTarget.placement
            }
        );
    }


    const remainingAfterEviction = getActiveHouseguests();

    if (remainingAfterEviction.length <= Number(currentSeason.rules?.finalists || 2)) {
        finalizeSeason(remainingAfterEviction);
        return;
    }

    simulation.currentWeek++;

    simulation.currentEventIndex = 0;

    simulation.currentNominees = [];

    simulation.currentPOVPlayers = [];

    simulation.currentPOVWinner = null;

    simulation.currentEviction = null;


    setText(
        "current-week",
        simulation.currentWeek
    );


    updateSimulatorStatus(
        simulation
    );

    resetGameChain(0);


    showEvent(
        "Eviction",
        "EVICTION",
        `
            <p>
                <strong>
                    ${escapeHTML(
                        evictionTarget?.name ||
                        "A houseguest"
                    )}
                </strong>
                has been evicted from the Big Brother house.
            </p>

            <p>
                Week ${simulation.currentWeek}
                is now beginning.
            </p>
        `
    );
}


/* =========================================================
   COMPETITION HELPERS
   ========================================================= */

function chooseVetoPlayers(
    active,
    hohId,
    nominees,
    requiredPlayers
) {

    const selected = [];


    const nomineePlayers =
        nominees
            .map(
                id =>
                    active.find(
                        houseguest =>
                            houseguest.id === id
                    )
            )
            .filter(Boolean);


    nomineePlayers.forEach(
        nominee => {

            if (
                selected.length <
                requiredPlayers
            ) {

                selected.push(
                    nominee
                );
            }
        }
    );


    const hoh =
        active.find(
            houseguest =>
                houseguest.id === hohId
        );


    if (
        hoh &&
        selected.length <
            requiredPlayers
    ) {

        selected.push(
            hoh
        );
    }


    const remaining =
        active.filter(
            houseguest =>
                !selected.includes(
                    houseguest
                )
        );


    while (
        selected.length <
            requiredPlayers &&
        remaining.length > 0
    ) {

        const index =
            Math.floor(
                Math.random() *
                remaining.length
            );


        const [
            player
        ] =
            remaining.splice(
                index,
                1
            );


        selected.push(
            player
        );
    }


    return selected;
}


function chooseCompetitionWinner(
    players,
    primaryStat,
    secondaryStat,
    generalStat
) {

    if (
        players.length === 1
    ) {

        return players[0];
    }


    const weighted =
        players.map(
            player => {

                const primary =
                    Number(
                        player.ratings?.[
                            primaryStat
                        ] || 0
                    );


                const secondary =
                    Number(
                        player.ratings?.[
                            secondaryStat
                        ] || 0
                    );


                const general =
                    Number(
                        player.ratings?.[
                            generalStat
                        ] || 0
                    );


                return {

                    player,

                    score:
                        primary * 0.45 +
                        secondary * 0.30 +
                        general * 0.25 +
                        Math.random() * 4
                };
            }
        );


    weighted.sort(
        (
            a,
            b
        ) =>
            b.score -
            a.score
    );


    return weighted[0].player;
}


/* =========================================================
   ACTIVE HOUSEGUEST HELPERS
   ========================================================= */

function getActiveHouseguests() {

    if (
        !currentSeason ||
        !Array.isArray(
            currentSeason.houseguests
        )
    ) {

        return [];
    }


    return currentSeason.houseguests.filter(
        houseguest =>
            houseguest.status !==
            "evicted"
    );
}


function getHouseguestDisplayName(
    id,
    houseguests
) {

    if (!id) {
        return "—";
    }


    const houseguest =
        (
            houseguests ||
            []
        ).find(
            player =>
                player.id === id
        );


    if (!houseguest) {
        return "Unknown";
    }


    return (
        houseguest.name ||
        `Houseguest ${
            getHouseguestNumber(
                houseguest.id
            )
        }`
    );
}


function getHouseguestNumber(id) {

    const match =
        String(
            id || ""
        ).match(
            /(\d+)$/
        );


    if (match) {

        return parseInt(
            match[1],
            10
        );
    }


    return "?";
}


function formatHouseguestList(
    ids,
    houseguests
) {

    if (
        !Array.isArray(ids) ||
        ids.length === 0
    ) {

        return "—";
    }


    return ids
        .map(
            id =>
                getHouseguestDisplayName(
                    id,
                    houseguests
                )
        )
        .join(", ");
}


/* =========================================================
   RANDOM HELPERS
   ========================================================= */

function randomItem(
    array
) {

    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {

        return null;
    }


    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}


function chooseRandomPlayers(
    array,
    count
) {

    const copy =
        [...array];


    const selected = [];


    while (
        selected.length <
            count &&
        copy.length > 0
    ) {

        const index =
            Math.floor(
                Math.random() *
                copy.length
            );


        selected.push(
            copy.splice(
                index,
                1
            )[0]
        );
    }


    return selected;
}


/* =========================================================
   RESULTS
   ========================================================= */

function showResults() {

    if (!currentSeason) {
        return;
    }


    setText(
        "results-season-name",
        currentSeason.name ||
        "Big Brother"
    );


    setText(
        "winner-name",
        currentSeason.simulation
            ?.winner ||
        "—"
    );


    renderFinalPlacements();

    renderSeasonStatistics();

    showPage(
        "results-page"
    );
}


function renderFinalPlacements() {

    const container =
        document.getElementById(
            "final-placements"
        );


    if (!container) {
        return;
    }


    const placements =
        currentSeason?.simulation
            ?.finalPlacements ||
        [];


    if (placements.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    No Placements Yet
                </h3>

                <p>
                    Finish the simulation to see
                    final placements.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="placement-list">

            ${placements
                .map(
                    placement => `

                        <div class="placement-row">

                            <span class="placement-number">
                                ${placement.placement}
                            </span>

                            <span class="placement-name">
                                ${escapeHTML(
                                    placement.name ||
                                    "Unknown"
                                )}
                            </span>

                            <span class="placement-status">
                                Evicted
                            </span>

                        </div>
                    `
                )
                .join("")}

        </div>

    `;
}


function renderSeasonStatistics() {

    const container =
        document.getElementById(
            "season-statistics"
        );


    if (!container) {
        return;
    }


    const houseguests =
        currentSeason?.houseguests ||
        [];


    const totalHOHWins =
        houseguests.reduce(
            (
                total,
                houseguest
            ) =>
                total +
                Number(
                    houseguest.hohWins || 0
                ),
            0
        );


    const totalPOVWins =
        houseguests.reduce(
            (
                total,
                houseguest
            ) =>
                total +
                Number(
                    houseguest.povWins || 0
                ),
            0
        );


    const totalNominations =
        houseguests.reduce(
            (
                total,
                houseguest
            ) =>
                total +
                Number(
                    houseguest.nominationCount || 0
                ),
            0
        );


    const relationshipCount =
        currentSeason &&
        Array.isArray(
            currentSeason.relationships
        )
            ? currentSeason.relationships.length
            : 0;


    container.innerHTML = `

        <div class="statistics-grid">

            <div class="stat-card">

                <strong>
                    Houseguests
                </strong>

                <span>
                    ${houseguests.length}
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    HOH Wins
                </strong>

                <span>
                    ${totalHOHWins}
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    POV Wins
                </strong>

                <span>
                    ${totalPOVWins}
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    Nominations
                </strong>

                <span>
                    ${totalNominations}
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    Relationships
                </strong>

                <span>
                    ${relationshipCount}
                </span>

            </div>

        </div>

    `;
}


/* =========================================================
   PERSIST CURRENT SEASON
   ========================================================= */

function persistCurrentSeason() {

    if (!currentSeason) {
        return;
    }


    const index =
        savedSeasons.findIndex(
            season =>
                season.id ===
                currentSeason.id
        );


    if (index < 0) {
        return;
    }


    currentSeason.updatedAt =
        new Date().toISOString();


    savedSeasons[index] =
        deepClone(
            currentSeason
        );


    saveSeasonsToStorage();

    renderSavedSeasons();
}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(
    content
) {

    const modal =
        document.getElementById(
            "modal"
        );

    const body =
        document.getElementById(
            "modal-body"
        );


    if (!modal || !body) {
        return;
    }


    body.innerHTML =
        content;


    modal.classList.add(
        "active"
    );
}


function closeModal() {

    const modal =
        document.getElementById(
            "modal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );
    }
}


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function getValue(id) {

    const element =
        document.getElementById(id);


    if (!element) {
        return "";
    }


    return element.value;
}


function getInputValue(id) {

    return getValue(id);
}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    element.value =
        value;
}


function getChecked(id) {

    const element =
        document.getElementById(id);


    if (!element) {
        return false;
    }


    return element.checked;
}


function setChecked(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    element.checked =
        Boolean(value);
}


function setText(
    id,
    text
) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    element.textContent =
        text;
}


function deepClone(
    object
) {

    if (
        object === undefined ||
        object === null
    ) {

        return object;
    }


    return JSON.parse(
        JSON.stringify(object)
    );
}


function escapeHTML(
    value
) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(
    value
) {

    return escapeHTML(
        value
    );
}


/* =========================================================
   GLOBAL EXPORTS
   =========================================================
   These make functions available to the onclick handlers
   in index.html.
   ========================================================= */

window.showPage =
    showPage;

window.createNewSeason =
    createNewSeason;

window.addHouseguest =
    addHouseguest;

window.removeHouseguest =
    removeHouseguest;

window.updateHouseguestCount =
    updateHouseguestCount;

window.updateHouseguestImage =
    updateHouseguestImage;

window.saveSeason =
    saveSeason;

window.editSeason =
    editSeason;

window.openSeason =
    openSeason;

window.deleteSeason =
    deleteSeason;

window.runNextEvent =
    runNextEvent;

window.showResults =
    showResults;

window.closeModal =
    closeModal;

window.openModal =
    openModal;

window.addRelationship =
    addRelationship;

window.editRelationship =
    editRelationship;

window.deleteRelationship =
    deleteRelationship;

window.updateRelationshipDisplay =
    updateRelationshipDisplay;


/* =========================================================
   ADVANCED SEASON SYSTEMS
   Alliances, competitions, twists and strategic voting
   ========================================================= */

function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function setupAdvancedSeasonControls() {
    const saveA = document.getElementById("save-alliance-btn");
    const clearA = document.getElementById("cancel-alliance-btn");
    const saveC = document.getElementById("save-competition-btn");
    const clearC = document.getElementById("cancel-competition-btn");
    const saveT = document.getElementById("save-twist-btn");
    const clearT = document.getElementById("cancel-twist-btn");
    if (saveA) saveA.onclick = saveAlliance;
    if (clearA) clearA.onclick = resetAllianceEditor;
    if (saveC) saveC.onclick = saveCompetition;
    if (clearC) clearC.onclick = resetCompetitionEditor;
    if (saveT) saveT.onclick = saveTwist;
    if (clearT) clearT.onclick = resetTwistEditor;
    
    refreshAdvancedHouseguestOptions();
    renderAlliances(); renderCompetitions(); renderTwists();
}

function refreshAdvancedHouseguestOptions() {
    const picker = document.getElementById("alliance-member-picker");
    if (!picker) return;
    const previous = new Set([...picker.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value));
    const guests = collectHouseguests();
    picker.innerHTML = guests.length ? guests.map(h => {
        const name = h.name || "Unnamed Houseguest";
        return `<label class="member-picker-item"><input type="checkbox" value="${escapeAttribute(h.id)}" ${previous.has(h.id) ? "checked" : ""}><span>${escapeHTML(name)}</span></label>`;
    }).join("") : '<div class="member-picker-empty">Add houseguests above to choose alliance members.</div>';
    picker.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener("change", updateAllianceMemberHint));
    updateAllianceMemberHint();
}

function updateAllianceMemberHint() {
    const picker = document.getElementById("alliance-member-picker");
    const hint = document.getElementById("alliance-member-count");
    if (!picker || !hint) return;
    const count = picker.querySelectorAll('input[type="checkbox"]:checked').length;
    hint.textContent = count === 0 ? "Select at least 2 houseguests." : `${count} houseguest${count === 1 ? "" : "s"} selected`;
    hint.classList.toggle("is-valid", count >= 2);
}

function getAdvancedArrays() {
    if (!currentSeason) {
        currentSeason = {
            alliances: [],
            relationships: [],
            competitions: { hoh: [], pov: [], safety: [], luxury: [], finalHoh: [] },
            twists: [],
            simulation: createDefaultSimulation()
        };
    }
    if (!Array.isArray(currentSeason.alliances)) currentSeason.alliances = [];
    if (!Array.isArray(currentSeason.relationships)) currentSeason.relationships = [];
    if (!currentSeason.competitions || typeof currentSeason.competitions !== "object") currentSeason.competitions = {};
    ["hoh", "pov", "safety", "luxury", "finalHoh"].forEach(k => {
        if (!Array.isArray(currentSeason.competitions[k])) currentSeason.competitions[k] = [];
    });
    if (!Array.isArray(currentSeason.twists)) currentSeason.twists = [];
    return currentSeason;
}

function collectAlliances() { return deepClone(getAdvancedArrays().alliances); }
function collectCompetitions() { return deepClone(getAdvancedArrays().competitions); }
function collectTwists() { return deepClone(getAdvancedArrays().twists); }

function saveAlliance() {
    const season = getAdvancedArrays();
    const name = getInputValue("alliance-name").trim();
    const description = getInputValue("alliance-description").trim();
    const status = getValue("alliance-status") || "active";
    const members = [...(document.querySelectorAll("#alliance-member-picker input[type=\"checkbox\"]:checked") || [])].map(o => o.value);
    if (!name) return alert("Please enter an alliance name.");
    if (members.length < 2) return alert("An alliance must have at least two members.");
    const duplicate = season.alliances.some(a => a.id !== editingAllianceId && String(a.name).trim().toLowerCase() === name.toLowerCase());
    if (duplicate) return alert("An alliance with that name already exists.");
    const obj = { id: editingAllianceId || uid("alliance"), name, description, members, status };
    const index = season.alliances.findIndex(a => a.id === obj.id);
    if (index >= 0) season.alliances[index] = obj; else season.alliances.push(obj);
    editingAllianceId = null; resetAllianceEditor(); renderAlliances(); persistCurrentSeasonIfSaved();
}

function resetAllianceEditor() {
    editingAllianceId = null;
    setValue("alliance-name", ""); setValue("alliance-description", ""); setValue("alliance-status", "active");
    const picker=document.getElementById("alliance-member-picker"); if(picker) picker.querySelectorAll("input[type=\"checkbox\"]").forEach(o=>o.checked=false);
    setText("alliance-form-title", "Create Alliance"); setText("save-alliance-btn", "Add Alliance");
}
function editAlliance(id) { const a=getAdvancedArrays().alliances.find(x=>x.id===id); if(!a)return; editingAllianceId=id; setValue("alliance-name",a.name);setValue("alliance-description",a.description||"");setValue("alliance-status",a.status||"active");refreshAdvancedHouseguestOptions();const picker=document.getElementById("alliance-member-picker");if(picker)picker.querySelectorAll("input[type=\"checkbox\"]").forEach(o=>o.checked=a.members.includes(o.value));updateAllianceMemberHint();setText("alliance-form-title","Edit Alliance");setText("save-alliance-btn","Save Alliance");document.getElementById("alliance-name")?.scrollIntoView({behavior:"smooth",block:"center"}); }
function deleteAlliance(id) { if(!confirm("Delete this alliance?"))return; getAdvancedArrays().alliances=getAdvancedArrays().alliances.filter(a=>a.id!==id); renderAlliances(); persistCurrentSeasonIfSaved(); }
function cleanupAlliancesForHouseguest(id) { getAdvancedArrays().alliances.forEach(a=>a.members=(a.members||[]).filter(x=>x!==id)); getAdvancedArrays().alliances=getAdvancedArrays().alliances.filter(a=>(a.members||[]).length>=2); renderAlliances(); }
function renderAlliances() { const c=document.getElementById("alliances-container"); if(!c)return; refreshAdvancedHouseguestOptions(); const gs=collectHouseguests(); const as=getAdvancedArrays().alliances; if(!as.length){c.innerHTML='<div class="empty-state"><p>No alliances created yet.</p></div>';return;} c.innerHTML=as.map(a=>`<div class="advanced-card"><div class="advanced-card-header"><div><h4>${escapeHTML(a.name)}</h4><span class="feature-status">${escapeHTML(a.status||"active")}</span></div><div class="advanced-card-actions"><button type="button" onclick="editAlliance('${escapeAttribute(a.id)}')">Edit</button><button type="button" onclick="deleteAlliance('${escapeAttribute(a.id)}')">Delete</button></div></div><p>${escapeHTML(a.description||"No description.")}</p><strong>Members (${a.members.length})</strong><p>${escapeHTML(a.members.map(id=>getHouseguestDisplayName(id,gs)).join(", "))}</p></div>`).join(""); }

function saveCompetition() { const season=getAdvancedArrays(); const name=getInputValue("competition-name").trim(); if(!name)return alert("Please enter a competition name."); const type=getValue("competition-type")||"hoh"; const obj={id:editingCompetitionId||uid("competition"),name,type,description:getInputValue("competition-description").trim(),primary:getValue("competition-primary")||"physical",secondary:getValue("competition-secondary")||"mental"}; const arr=season.competitions[type]||(season.competitions[type]=[]); let found=false; Object.keys(season.competitions).forEach(k=>{const i=season.competitions[k].findIndex(x=>x.id===obj.id);if(i>=0){season.competitions[k].splice(i,1);found=true;}}); arr.push(obj); editingCompetitionId=null; resetCompetitionEditor(); renderCompetitions(); persistCurrentSeasonIfSaved(); }
function resetCompetitionEditor(){editingCompetitionId=null;setValue("competition-name","");setValue("competition-type","hoh");setValue("competition-description","");setValue("competition-primary","physical");setValue("competition-secondary","mental");setText("competition-form-title","Create Competition");setText("save-competition-btn","Add Competition");}
function editCompetition(id){const s=getAdvancedArrays();let c=null;Object.values(s.competitions).some(arr=>{const x=arr.find(y=>y.id===id);if(x)c=x;return !!x;});if(!c)return;editingCompetitionId=id;setValue("competition-name",c.name);setValue("competition-type",c.type);setValue("competition-description",c.description||"");setValue("competition-primary",c.primary||"physical");setValue("competition-secondary",c.secondary||"mental");setText("competition-form-title","Edit Competition");setText("save-competition-btn","Save Competition");document.getElementById("competition-name")?.scrollIntoView({behavior:"smooth",block:"center"});}
function deleteCompetition(id){if(!confirm("Delete this competition?"))return;const s=getAdvancedArrays();Object.keys(s.competitions).forEach(k=>s.competitions[k]=s.competitions[k].filter(c=>c.id!==id));renderCompetitions();persistCurrentSeasonIfSaved();}
function renderCompetitions(){const c=document.getElementById("competitions-container");if(!c)return;const s=getAdvancedArrays();const all=Object.values(s.competitions).flat();if(!all.length){c.innerHTML='<div class="empty-state"><p>No custom competitions created yet.</p></div>';return;}const labels={hoh:"HOH",pov:"POV",safety:"Safety",luxury:"Luxury",finalHoh:"Final HOH"};c.innerHTML=all.map(x=>`<div class="advanced-card"><div class="advanced-card-header"><div><h4>${escapeHTML(x.name)}</h4><span class="feature-status">${labels[x.type]||x.type}</span></div><div class="advanced-card-actions"><button type="button" onclick="editCompetition('${escapeAttribute(x.id)}')">Edit</button><button type="button" onclick="deleteCompetition('${escapeAttribute(x.id)}')">Delete</button></div></div><p>${escapeHTML(x.description||"No description.")}</p><small>Primary: ${escapeHTML(x.primary)} · Secondary: ${escapeHTML(x.secondary)}</small></div>`).join("");}
function loadCompetitions(data){const s=getAdvancedArrays();s.competitions=data&&typeof data==='object'?deepClone(data):{hoh:[],pov:[],safety:[],luxury:[],finalHoh:[]};["hoh","pov","safety","luxury","finalHoh"].forEach(k=>{if(!Array.isArray(s.competitions[k]))s.competitions[k]=[]});resetCompetitionEditor();renderCompetitions();}

function saveTwist(){const s=getAdvancedArrays();const name=getInputValue("twist-name").trim();if(!name)return alert("Please enter a twist name.");const duplicate=s.twists.some(t=>t.id!==editingTwistId&&String(t.name).toLowerCase()===name.toLowerCase());if(duplicate)return alert("A twist with that name already exists.");const obj={id:editingTwistId||uid("twist"),name,description:getInputValue("twist-description").trim(),timing:getValue("twist-timing")||"season",active:getChecked("twist-active")};const i=s.twists.findIndex(t=>t.id===obj.id);if(i>=0)s.twists[i]=obj;else s.twists.push(obj);resetTwistEditor();renderTwists();persistCurrentSeasonIfSaved();}
function resetTwistEditor(){editingTwistId=null;setValue("twist-name","");setValue("twist-description","");setValue("twist-timing","season");setChecked("twist-active",true);setText("twist-form-title","Create Twist");setText("save-twist-btn","Add Twist");}
function editTwist(id){const t=getAdvancedArrays().twists.find(x=>x.id===id);if(!t)return;editingTwistId=id;setValue("twist-name",t.name);setValue("twist-description",t.description||"");setValue("twist-timing",t.timing||"season");setChecked("twist-active",t.active!==false);setText("twist-form-title","Edit Twist");setText("save-twist-btn","Save Twist");document.getElementById("twist-name")?.scrollIntoView({behavior:"smooth",block:"center"});}
function deleteTwist(id){if(!confirm("Delete this twist?"))return;getAdvancedArrays().twists=getAdvancedArrays().twists.filter(t=>t.id!==id);renderTwists();persistCurrentSeasonIfSaved();}
function renderTwists(){const c=document.getElementById("twists-container");if(!c)return;const ts=getAdvancedArrays().twists;if(!ts.length){c.innerHTML='<div class="empty-state"><p>No twists created yet.</p></div>';return;}c.innerHTML=ts.map(t=>`<div class="advanced-card"><div class="advanced-card-header"><div><h4>${escapeHTML(t.name)}</h4><span class="feature-status">${t.active===false?"Inactive":"Active"}</span></div><div class="advanced-card-actions"><button type="button" onclick="editTwist('${escapeAttribute(t.id)}')">Edit</button><button type="button" onclick="deleteTwist('${escapeAttribute(t.id)}')">Delete</button></div></div><p>${escapeHTML(t.description||"No description.")}</p><small>Timing: ${escapeHTML(t.timing||"season")}</small></div>`).join("");}
function loadTwists(data){getAdvancedArrays().twists=deepClone(Array.isArray(data)?data:[]);resetTwistEditor();renderTwists();}
function loadAlliances(data){getAdvancedArrays().alliances=deepClone(Array.isArray(data)?data:[]);refreshAdvancedHouseguestOptions();resetAllianceEditor();renderAlliances();}
function clearAdvancedEditors(){resetAllianceEditor();resetCompetitionEditor();resetTwistEditor();}

function getRelationshipValueSafe(from,to,key){const r=(currentSeason?.relationships||[]).find(x=>x.from===from&&x.to===to);return Number(r?.[key]||0);}
function allianceBond(playerId,targetId){const s=getAdvancedArrays();let score=0; s.alliances.filter(a=>a.status!=="inactive"&&(a.members||[]).includes(playerId)&&(a.members||[]).includes(targetId)).forEach(()=>score+=6);score += getRelationshipValueSafe(playerId,targetId,"trust")*0.7 + getRelationshipValueSafe(playerId,targetId,"loyalty")*0.8 + getRelationshipValueSafe(playerId,targetId,"friendship")*0.35 - getRelationshipValueSafe(playerId,targetId,"rivalry")*1.2;return score;}
function chooseEvictionTarget(nominees, active){if(nominees.length<=1)return nominees[0];const scores=nominees.map(target=>{let votesAgainst=0;active.filter(v=>v.id!==target.id&&v.id!==currentSeason.simulation?.currentHOH).forEach(v=>{const bond=allianceBond(v.id,target.id);const threat=(Number(target.ratings?.strategic||0)+Number(target.ratings?.social||0))*0.25;votesAgainst += Math.max(0,8-bond)+threat+Math.random()*4;});return {target,score:votesAgainst};});scores.sort((a,b)=>b.score-a.score);return scores[0].target;}

function finalizeSeason(finalists){const sim=currentSeason.simulation;const active=getActiveHouseguests();const pool=finalists.length?finalists:active;const ranked=[...pool].sort((a,b)=>{const sa=Number(a.ratings?.social||0)*.35+Number(a.ratings?.strategic||0)*.35+Number(a.ratings?.general||0)*.2+Number(a.ratings?.mental||0)*.1+Math.random()*3;const sb=Number(b.ratings?.social||0)*.35+Number(b.ratings?.strategic||0)*.35+Number(b.ratings?.general||0)*.2+Number(b.ratings?.mental||0)*.1+Math.random()*3;return sb-sa;});sim.finalists=ranked.map(x=>x.id);sim.winner=ranked[0]?.name||null;sim.runnerUp=ranked[1]?.name||null;ranked.forEach((p,i)=>{p.status="finalist";p.placement=i+1;});sim.completed=true;sim.currentEventIndex=0;sim.finalPlacements=ranked.map((p,i)=>({id:p.id,name:p.name,placement:i+1}));persistCurrentSeason();showResults();}

// Use a custom competition when one exists for the requested type.
function chooseCompetitionWinnerByCustom(players, competition) {
    return _baseChooseCompetitionWinner(
        players,
        competition.primary || "general",
        competition.secondary || "mental",
        "general"
    );
}

function chooseCustomCompetition(type){const list=getAdvancedArrays().competitions[type]||[];if(!list.length)return null;return list[Math.floor(Math.random()*list.length)];}

// Upgrade competition winner selection with custom competition skill weights.
const _baseChooseCompetitionWinner = chooseCompetitionWinner;
chooseCompetitionWinner = function(players, primaryStat, secondaryStat, generalStat){
    const type = primaryStat === "physical" && secondaryStat === "mental" ? "hoh" : "pov";
    const custom = chooseCustomCompetition(type);
    if(!custom) return _baseChooseCompetitionWinner(players,primaryStat,secondaryStat,generalStat);
    return _baseChooseCompetitionWinner(players,custom.primary||primaryStat,custom.secondary||secondaryStat,"general");
};
