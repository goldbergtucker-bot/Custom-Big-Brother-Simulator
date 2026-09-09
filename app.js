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


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadSeasonsFromStorage();

    setupImagePreviews();

    setupRuleControls();

    setupRelationshipControls();

    initializeHouseguestCount();

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

    currentSeason = null;

    currentHouseguestId = 0;

    editingRelationshipId = null;

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

    updateHouseguestNumbers();

    populateRelationshipHouseguestOptions();

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


function renderRelationships() {

    const container =
        document.getElementById(
            "relationships-container"
        );

    if (!container) {
        return;
    }


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
            existingSeason?.alliances ||
            [],

        relationships:
            existingRelationships,

        competitions:
            existingSeason?.competitions ||
            {
                hoh: [],
                pov: [],
                safety: [],
                luxury: [],
                finalHoh: []
            },

        twists:
            existingSeason?.twists ||
            [],

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

        hoh =
            randomItem(
                houseguests
            );
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

        const winner =
            chooseCompetitionWinner(
                players,
                "physical",
                "mental",
                "general"
            );


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


    const evictionTarget =
        randomItem(
            nomineesAsPlayers
        );


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
