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
    "eviction-voting",
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
    setupSeasonLengthControls();

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
            finalHoh: [],
            special: []
        },
        competitionWeeks: {},
        twists: [],
        twistWeeks: {},
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

    // Support both the new first/last-name format and older saved seasons
    // that only stored a single `name` field.
    const parsedName = parseHouseguestName(houseguest);
    houseguest.firstName = parsedName.firstName;
    houseguest.lastName = parsedName.lastName;
    houseguest.name = formatHouseguestName(
        houseguest.firstName,
        houseguest.lastName
    );

    card.innerHTML = `

        <div class="houseguest-card-header">

            <div>
                <h3 class="houseguest-number" id="houseguest-number-${id}">
                    Houseguest
                </h3>
                <div
                    class="houseguest-display-name"
                    id="houseguest-display-name-${id}"
                >
                    ${escapeHTML(
                        formatHouseguestName(
                            houseguest.firstName,
                            houseguest.lastName
                        ) || "Unnamed Houseguest"
                    )}
                </div>
            </div>

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

                <label for="houseguest-first-name-${id}">
                    First Name
                </label>

                <input
                    type="text"
                    id="houseguest-first-name-${id}"
                    value="${escapeAttribute(
                        houseguest.firstName || ""
                    )}"
                    placeholder="First Name"
                    oninput="updateHouseguestNameDisplay('${id}')"
                >

            </div>


            <div class="form-group">

                <label for="houseguest-last-name-${id}">
                    Last Name
                </label>

                <input
                    type="text"
                    id="houseguest-last-name-${id}"
                    value="${escapeAttribute(
                        houseguest.lastName || ""
                    )}"
                    placeholder="Last Name"
                    oninput="updateHouseguestNameDisplay('${id}')"
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

    updateHouseguestNameDisplay(id);

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


function parseHouseguestName(houseguest) {

    const firstName =
        String(houseguest?.firstName || "").trim();

    const lastName =
        String(houseguest?.lastName || "").trim();

    if (firstName || lastName) {
        return { firstName, lastName };
    }

    const legacyName =
        String(houseguest?.name || "").trim();

    if (!legacyName) {
        return { firstName: "", lastName: "" };
    }

    const parts = legacyName.split(/\s+/);

    return {
        firstName: parts.shift() || "",
        lastName: parts.join(" ")
    };
}


function formatHouseguestName(firstName, lastName) {

    return [firstName, lastName]
        .map(value => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
}


function getLiveCreatorHouseguests() {
    const editor = document.getElementById("houseguest-editor");
    if (!editor || !editor.querySelector(".houseguest-card")) return null;
    return collectHouseguests();
}

function syncLiveHouseguestNames(id) {
    const liveGuests = getLiveCreatorHouseguests();
    if (!liveGuests) return;

    const guestsById = new Map(liveGuests.map(h => [h.id, h]));

    // Update the name shown in every houseguest card.
    liveGuests.forEach((guest, index) => {
        const fullName = guest.name || `Houseguest ${index + 1}`;
        const card = document.querySelector(`.houseguest-card[data-houseguest-id="${CSS.escape(guest.id)}"]`);
        if (!card) return;
        const number = card.querySelector(".houseguest-number");
        const display = card.querySelector(".houseguest-display-name");
        if (number) number.textContent = fullName;
        if (display) display.textContent = fullName;
    });

    // Update relationship dropdowns without rebuilding the houseguest cards.
    ["relationship-from", "relationship-to"].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const selected = select.value;
        select.querySelectorAll("option[value]").forEach(option => {
            const guest = guestsById.get(option.value);
            if (guest) option.textContent = guest.name || `Houseguest ${liveGuests.findIndex(h => h.id === guest.id) + 1}`;
        });
        if (selected) select.value = selected;
    });

    // Update alliance member labels in place so typing a name is reflected immediately.
    const picker = document.getElementById("alliance-member-picker");
    if (picker) {
        picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const guest = guestsById.get(cb.value);
            const label = cb.closest("label");
            const span = label?.querySelector("span");
            if (guest && span) span.textContent = guest.name || `Houseguest ${liveGuests.findIndex(h => h.id === guest.id) + 1}`;
        });
    }

    // Update existing alliance cards and relationship rows using the live names.
    const allianceCards = document.querySelectorAll("#alliances-container .advanced-card");
    const alliances = getAdvancedArrays().alliances;
    allianceCards.forEach((card, index) => {
        const alliance = alliances[index];
        if (!alliance) return;
        const memberParagraphs = card.querySelectorAll("p");
        const memberParagraph = memberParagraphs[memberParagraphs.length - 1];
        if (memberParagraph) memberParagraph.textContent = alliance.members.map(memberId => {
            const guest = guestsById.get(memberId);
            return guest ? (guest.name || `Houseguest ${liveGuests.findIndex(h => h.id === guest.id) + 1}`) : "Unknown";
        }).join(", ");
    });

    const relationshipContainer = document.getElementById("relationships-container");
    if (relationshipContainer) {
        relationshipContainer.querySelectorAll("[data-relationship-from], [data-relationship-to]").forEach(el => {
            const from = el.dataset.relationshipFrom ? guestsById.get(el.dataset.relationshipFrom) : null;
            const to = el.dataset.relationshipTo ? guestsById.get(el.dataset.relationshipTo) : null;
            if (from && el.dataset.relationshipFrom) el.textContent = from.name || el.textContent;
            if (to && el.dataset.relationshipTo) el.textContent = to.name || el.textContent;
        });
    }

    // Matrix headers/row labels use data IDs and can be updated without re-rendering the matrix.
    const matrix = document.querySelector(".relationship-matrix");
    if (matrix) {
        matrix.querySelectorAll("th[data-houseguest-id]").forEach(th => {
            const guest = guestsById.get(th.dataset.houseguestId);
            if (guest) th.textContent = guest.name || "HG";
        });
    }
}

function updateHouseguestNameDisplay(id) {

    const firstName = getInputValue(
        `houseguest-first-name-${id}`
    );

    const lastName = getInputValue(
        `houseguest-last-name-${id}`
    );

    const display =
        document.getElementById(
            `houseguest-display-name-${id}`
        );

    if (!display) {
        return;
    }

    const fullName =
        formatHouseguestName(firstName, lastName) ||
        "Unnamed Houseguest";

    display.textContent = fullName;

    syncLiveHouseguestNames(id);
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

                firstName:
                    getInputValue(
                        `houseguest-first-name-${id}`
                    ),

                lastName:
                    getInputValue(
                        `houseguest-last-name-${id}`
                    ),

                name:
                    formatHouseguestName(
                        getInputValue(`houseguest-first-name-${id}`),
                        getInputValue(`houseguest-last-name-${id}`)
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

    setValue("rule-season-weeks", 30);
    renderDoubleEvictionWeekPicker(30, []);

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

        seasonWeeks: Math.min(30, Math.max(1, parseInt(getValue("rule-season-weeks"), 10) || 30)),
        doubleEvictionWeeks: getSelectedDoubleEvictionWeeks(),

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


function getSeasonLength(season = currentSeason) {
    return Math.min(30, Math.max(1, Number(season?.rules?.seasonWeeks) || 30));
}

function getSelectedDoubleEvictionWeeks() {
    return Array.from(document.querySelectorAll("#double-eviction-weeks-picker input[type=checkbox]:checked"))
        .map(el => Number(el.value))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 30);
}

function renderDoubleEvictionWeekPicker(maxWeeks, selected = []) {
    const picker = document.getElementById("double-eviction-weeks-picker");
    const hint = document.getElementById("double-eviction-weeks-hint");
    if (!picker) return;
    const enabled = getChecked("rule-double-eviction");
    const chosen = new Set((selected || []).map(Number));
    const count = Math.min(30, Math.max(1, Number(maxWeeks) || 30));
    picker.innerHTML = Array.from({length: count}, (_, i) => {
        const week = i + 1;
        return `<label class="member-picker-item"><input type="checkbox" value="${week}" ${chosen.has(week) ? "checked" : ""} ${enabled ? "" : "disabled"}><span>Week ${week}</span></label>`;
    }).join("");
    if (hint) hint.textContent = enabled ? "Select one or more double eviction weeks." : "Double eviction is disabled.";
}

function setupSeasonLengthControls() {
    const weeks = document.getElementById("rule-season-weeks");
    const de = document.getElementById("rule-double-eviction");
    const refresh = () => {
        const count = Math.min(30, Math.max(1, Number(weeks?.value) || 30));
        const selected = getSelectedDoubleEvictionWeeks();
        renderDoubleEvictionWeekPicker(count, selected.filter(w => w <= count));
    };
    weeks?.addEventListener("change", refresh);
    de?.addEventListener("change", () => renderDoubleEvictionWeekPicker(Number(weeks?.value) || 30, getSelectedDoubleEvictionWeeks()));
    refresh();
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

    const loadedWeeks = Math.min(30, Math.max(1, Number(rules.seasonWeeks) || 30));
    setValue("rule-season-weeks", loadedWeeks);
    renderDoubleEvictionWeekPicker(loadedWeeks, rules.doubleEvictionWeeks || []);

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
    guests.forEach(g => html += `<th data-houseguest-id="${escapeAttribute(g.id)}" title="${escapeAttribute(g.name || "Houseguest")}">${escapeHTML(g.name || "HG")}</th>`);
    html += '</tr></thead><tbody>';
    guests.forEach(from => {
        html += `<tr><th data-houseguest-id="${escapeAttribute(from.id)}" title="${escapeAttribute(from.name || "Houseguest")}">${escapeHTML(from.name || "Houseguest")}</th>`;
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
        getLiveCreatorHouseguests() ||
        (currentSeason && Array.isArray(currentSeason.houseguests)
            ? currentSeason.houseguests
            : collectHouseguests());


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

        competitionWeeks:
            deepClone(getAdvancedArrays().competitionWeeks || {}),

        twists:
            collectTwists(),

        twistWeeks:
            deepClone(getAdvancedArrays().twistWeeks || {}),

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
    populateWeekSelectors(getSeasonLength(season));


    resetRelationshipEditor();

    populateRelationshipHouseguestOptions();

    renderRelationships();
    loadAlliances(season.alliances || []);
    loadCompetitions({ competitions: season.competitions || {}, competitionWeeks: season.competitionWeeks || {} });
    loadTwists({ twists: season.twists || [], twistWeeks: season.twistWeeks || {} });


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
    refreshAdvancedHouseguestOptions();
}


/* =========================================================
   OPEN SEASON
   ========================================================= */

function openSeason(id) {
    const season = savedSeasons.find(item => item.id === id);
    if (!season) return;
    currentSeason = deepClone(season);
    editingSeasonId = season.id;
    // Render the destination first, then initialize its controls. This makes
    // the Open button independent from the creator/editor page.
    showPage("simulator-page");
    requestAnimationFrame(() => {
        initializeSimulator(currentSeason);
        updateSimulatorStatus(currentSeason.simulation || createDefaultSimulation());
        renderDynamicGameChain();
    });
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
    
    populateWeekSelectors(getSeasonLength());
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
            competitionWeeks: {},
            twists: [],
            twistWeeks: {},
            simulation: createDefaultSimulation()
        };
    }
    if (!Array.isArray(currentSeason.alliances)) currentSeason.alliances = [];
    if (!Array.isArray(currentSeason.relationships)) currentSeason.relationships = [];
    if (!currentSeason.competitions || typeof currentSeason.competitions !== "object") currentSeason.competitions = {};
    ["hoh", "pov", "safety", "luxury", "finalHoh", "special"].forEach(k => {
        if (!Array.isArray(currentSeason.competitions[k])) currentSeason.competitions[k] = [];
    });
    if (!currentSeason.competitionWeeks || typeof currentSeason.competitionWeeks !== "object") currentSeason.competitionWeeks = {};
    if (!Array.isArray(currentSeason.twists)) currentSeason.twists = [];
    if (!currentSeason.twistWeeks || typeof currentSeason.twistWeeks !== "object") currentSeason.twistWeeks = {};
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
function renderAlliances() { const c=document.getElementById("alliances-container"); if(!c)return; refreshAdvancedHouseguestOptions(); const gs=getLiveCreatorHouseguests() || collectHouseguests(); const as=getAdvancedArrays().alliances; if(!as.length){c.innerHTML='<div class="empty-state"><p>No alliances created yet.</p></div>';return;} c.innerHTML=as.map(a=>`<div class="advanced-card"><div class="advanced-card-header"><div><h4>${escapeHTML(a.name)}</h4><span class="feature-status">${escapeHTML(a.status||"active")}</span></div><div class="advanced-card-actions"><button type="button" onclick="editAlliance('${escapeAttribute(a.id)}')">Edit</button><button type="button" onclick="deleteAlliance('${escapeAttribute(a.id)}')">Delete</button></div></div><p>${escapeHTML(a.description||"No description.")}</p><strong>Members (${a.members.length})</strong><p>${escapeHTML(a.members.map(id=>getHouseguestDisplayName(id,gs)).join(", "))}</p></div>`).join(""); }

function getWeekNumber(value) {
    const n = Number(String(value || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function ensureWeekCollections(season) {
    if (!season.competitionWeeks || typeof season.competitionWeeks !== "object") season.competitionWeeks = {};
    if (!season.twistWeeks || typeof season.twistWeeks !== "object") season.twistWeeks = {};
    return season;
}

function getWeekCompetitions(week) {
    const s = ensureWeekCollections(getAdvancedArrays());
    const key = String(getWeekNumber(week));
    if (!Array.isArray(s.competitionWeeks[key])) s.competitionWeeks[key] = [];
    return s.competitionWeeks[key];
}

function getWeekTwists(week) {
    const s = ensureWeekCollections(getAdvancedArrays());
    const key = String(getWeekNumber(week));
    if (!Array.isArray(s.twistWeeks[key])) s.twistWeeks[key] = [];
    return s.twistWeeks[key];
}

function populateWeekSelectors(maxWeeks = getSeasonLength()) {
    const count = Math.min(30, Math.max(1, Number(maxWeeks) || 30));
    const options = Array.from({length: count}, (_, i) => `<option value="${i+1}">Week ${i+1}</option>`).join("");
    ["competition-week", "twist-week", "twist-start-week", "twist-end-week", "twist-power-until"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { const old = el.value; el.innerHTML = options; if ([...el.options].some(o => o.value === old)) el.value = old; }
    });
}

function saveCompetition() {
    const s = ensureWeekCollections(getAdvancedArrays());
    const name = getInputValue("competition-name").trim();
    if (!name) return alert("Please enter a competition name.");
    const type = getValue("competition-type") || "hoh";
    const week = getWeekNumber(getValue("competition-week") || 1);
    const obj = {
        id: editingCompetitionId || uid("competition"),
        week,
        name,
        type,
        description: getInputValue("competition-description").trim(),
        primary: getValue("competition-primary") || "physical",
        secondary: getValue("competition-secondary") || "mental"
    };
    Object.keys(s.competitionWeeks).forEach(k => {
        s.competitionWeeks[k] = (s.competitionWeeks[k] || []).filter(x => x.id !== obj.id);
        if (!s.competitionWeeks[k].length) delete s.competitionWeeks[k];
    });
    (s.competitionWeeks[String(week)] || (s.competitionWeeks[String(week)] = [])).push(obj);
    // Keep the legacy type buckets synchronized for backward compatibility.
    ["hoh", "pov", "safety", "luxury", "finalHoh", "special"].forEach(k => {
        if (!Array.isArray(s.competitions[k])) s.competitions[k] = [];
        s.competitions[k] = s.competitions[k].filter(x => x.id !== obj.id);
    });
    s.competitions[type].push(obj);
    editingCompetitionId = null;
    resetCompetitionEditor();
    renderCompetitions();
    persistCurrentSeasonIfSaved();
}

function resetCompetitionEditor() {
    editingCompetitionId = null;
    setValue("competition-name", "");
    setValue("competition-week", "1");
    setValue("competition-type", "hoh");
    setValue("competition-description", "");
    setValue("competition-primary", "physical");
    setValue("competition-secondary", "mental");
    setText("competition-form-title", "Create Competition");
    setText("save-competition-btn", "Add Competition");
}

function findCompetition(id) {
    const s = ensureWeekCollections(getAdvancedArrays());
    for (const arr of Object.values(s.competitionWeeks)) {
        const found = (arr || []).find(x => x.id === id);
        if (found) return found;
    }
    for (const arr of Object.values(s.competitions || {})) {
        const found = (arr || []).find(x => x.id === id);
        if (found) return found;
    }
    return null;
}

function editCompetition(id) {
    const c = findCompetition(id);
    if (!c) return;
    editingCompetitionId = id;
    setValue("competition-name", c.name);
    setValue("competition-week", c.week || 1);
    setValue("competition-type", c.type || "hoh");
    setValue("competition-description", c.description || "");
    setValue("competition-primary", c.primary || "physical");
    setValue("competition-secondary", c.secondary || "mental");
    setText("competition-form-title", "Edit Competition");
    setText("save-competition-btn", "Save Competition");
    document.getElementById("competition-name")?.scrollIntoView({behavior:"smooth", block:"center"});
}

function deleteCompetition(id) {
    if (!confirm("Delete this competition?")) return;
    const s = ensureWeekCollections(getAdvancedArrays());
    Object.keys(s.competitionWeeks).forEach(k => {
        s.competitionWeeks[k] = (s.competitionWeeks[k] || []).filter(c => c.id !== id);
        if (!s.competitionWeeks[k].length) delete s.competitionWeeks[k];
    });
    Object.keys(s.competitions).forEach(k => s.competitions[k] = (s.competitions[k] || []).filter(c => c.id !== id));
    renderCompetitions();
    persistCurrentSeasonIfSaved();
}

function renderCompetitions() {
    const c = document.getElementById("competitions-container");
    if (!c) return;
    const s = ensureWeekCollections(getAdvancedArrays());
    const labels = {hoh:"HOH", pov:"POV", safety:"Safety", luxury:"Luxury", finalHoh:"Final HOH", special:"Special Competition"};
    const legacy = Object.values(s.competitions || {}).flat().filter(x => !Object.values(s.competitionWeeks).some(arr => (arr || []).some(y => y.id === x.id)));
    const allWeeks = {};
    Object.keys(s.competitionWeeks).forEach(k => { if ((s.competitionWeeks[k] || []).length) allWeeks[k] = [...s.competitionWeeks[k]]; });
    if (legacy.length) {
        legacy.forEach(x => { const w = String(x.week || 1); (allWeeks[w] || (allWeeks[w] = [])).push({...x, week:Number(w)}); });
    }
    const weeks = Object.keys(allWeeks).map(Number).sort((a,b)=>a-b);
    if (!weeks.length) {
        c.innerHTML = '<div class="empty-state"><p>No weekly competitions created yet. Add your Week 1 HOH/POV above.</p></div>';
        return;
    }
    c.innerHTML = weeks.map(week => `
        <div class="week-editor-card">
            <div class="week-editor-header"><div><span class="section-label">WEEK ${week}</span><h4>Week ${week}</h4></div><span class="feature-status">${allWeeks[String(week)].length} competition${allWeeks[String(week)].length===1?"":"s"}</span></div>
            <div class="week-item-list">
                ${allWeeks[String(week)].map(x => `<div class="week-item"><div><strong>${escapeHTML(x.name)}</strong><span class="feature-status">${escapeHTML(labels[x.type]||x.type)}</span><p>${escapeHTML(x.description||"No description.")}</p><small>Primary: ${escapeHTML(x.primary||"general")} · Secondary: ${escapeHTML(x.secondary||"general")}</small></div><div class="advanced-card-actions"><button type="button" onclick="editCompetition('${escapeAttribute(x.id)}')">Edit</button><button type="button" onclick="deleteCompetition('${escapeAttribute(x.id)}')">Delete</button></div></div>`).join("")}
            </div>
        </div>`).join("");
}

function loadCompetitions(data) {
    const s = getAdvancedArrays();
    if (data && typeof data === "object" && data.competitionWeeks) {
        s.competitionWeeks = deepClone(data.competitionWeeks);
        s.competitions = deepClone(data.competitions || {hoh:[],pov:[],safety:[],luxury:[],finalHoh:[],special:[]});
    } else {
        // Migrate older library-only competitions into Week 1 unless a week is already stored.
        s.competitions = data && typeof data === "object" ? deepClone(data) : {hoh:[],pov:[],safety:[],luxury:[],finalHoh:[],special:[]};
        ["hoh", "pov", "safety", "luxury", "finalHoh", "special"].forEach(k => { if (!Array.isArray(s.competitions[k])) s.competitions[k] = []; });
        s.competitionWeeks = {};
        Object.values(s.competitions).flat().forEach(x => { const week = getWeekNumber(x.week || 1); const copy = {...x, week}; (s.competitionWeeks[String(week)] || (s.competitionWeeks[String(week)] = [])).push(copy); });
    }
    populateWeekSelectors();
    resetCompetitionEditor();
    renderCompetitions();
}

function saveTwist() {
    const s = ensureWeekCollections(getAdvancedArrays());
    const name = getInputValue("twist-name").trim();
    if (!name) return alert("Please enter a twist name.");
    const maxWeeks = getSeasonLength();
    const startWeek = Math.min(maxWeeks, getWeekNumber(getValue("twist-start-week") || 1));
    const endWeek = Math.max(startWeek, Math.min(maxWeeks, getWeekNumber(getValue("twist-end-week") || startWeek)));
    const powerUntilRaw = getWeekNumber(getValue("twist-power-until") || endWeek);
    const powerUntil = Math.min(maxWeeks, Math.max(startWeek, powerUntilRaw));
    const obj = {
        id: editingTwistId || uid("twist"),
        name,
        startWeek,
        endWeek,
        week: startWeek,
        power: getInputValue("twist-power").trim(),
        powerUntil,
        description: getInputValue("twist-description").trim(),
        timing: startWeek === endWeek ? `week${startWeek}` : `weeks${startWeek}-${endWeek}`,
        active: getChecked("twist-active")
    };
    Object.keys(s.twistWeeks).forEach(k => { s.twistWeeks[k] = (s.twistWeeks[k] || []).filter(t => t.id !== obj.id); if (!s.twistWeeks[k].length) delete s.twistWeeks[k]; });
    for (let w = startWeek; w <= endWeek; w++) (s.twistWeeks[String(w)] || (s.twistWeeks[String(w)] = [])).push({...obj, week:w});
    s.twists = (s.twists || []).filter(t => t.id !== obj.id);
    s.twists.push(obj);
    resetTwistEditor(); renderTwists(); persistCurrentSeasonIfSaved();
}

function resetTwistEditor() {
    editingTwistId = null;
    setValue("twist-name", "");
    setValue("twist-start-week", "1");
    setValue("twist-end-week", "1");
    setValue("twist-power", "");
    setValue("twist-power-until", "1");
    setValue("twist-description", "");
    setChecked("twist-active", true);
    setText("twist-form-title", "Create Twist");
    setText("save-twist-btn", "Add Twist");
}

function findTwist(id) {
    const s = ensureWeekCollections(getAdvancedArrays());
    for (const arr of Object.values(s.twistWeeks)) {
        const found = (arr || []).find(x => x.id === id);
        if (found) return found;
    }
    return (s.twists || []).find(x => x.id === id) || null;
}

function editTwist(id) {
    const t = findTwist(id);
    if (!t) return;
    editingTwistId = id;
    setValue("twist-name", t.name);
    setValue("twist-start-week", t.startWeek || t.week || 1);
    setValue("twist-end-week", t.endWeek || t.week || 1);
    setValue("twist-power", t.power || "");
    setValue("twist-power-until", t.powerUntil || t.endWeek || t.week || 1);
    setValue("twist-description", t.description || "");
    setChecked("twist-active", t.active !== false);
    setText("twist-form-title", "Edit Twist");
    setText("save-twist-btn", "Save Twist");
    document.getElementById("twist-name")?.scrollIntoView({behavior:"smooth",block:"center"});
}

function deleteTwist(id) {
    if (!confirm("Delete this twist?")) return;
    const s = ensureWeekCollections(getAdvancedArrays());
    Object.keys(s.twistWeeks).forEach(k => {
        s.twistWeeks[k] = (s.twistWeeks[k] || []).filter(t => t.id !== id);
        if (!s.twistWeeks[k].length) delete s.twistWeeks[k];
    });
    s.twists = (s.twists || []).filter(t => t.id !== id);
    renderTwists();
    persistCurrentSeasonIfSaved();
}

function renderTwists() {
    const c = document.getElementById("twists-container");
    if (!c) return;
    const s = ensureWeekCollections(getAdvancedArrays());
    const twists = [...(s.twists || [])].sort((a,b) => Number(a.startWeek || a.week || 1) - Number(b.startWeek || b.week || 1));
    if (!twists.length) { c.innerHTML = '<div class="empty-state"><p>No weekly twists created yet. Add a twist above if applicable.</p></div>'; return; }
    c.innerHTML = twists.map(t => {
        const start = Number(t.startWeek || t.week || 1);
        const end = Number(t.endWeek || start);
        const range = start === end ? `Week ${start}` : `Weeks ${start}–${end}`;
        const power = t.power ? `<small><strong>Power:</strong> ${escapeHTML(t.power)} · Usable through Week ${Number(t.powerUntil || end)}</small>` : '<small>No separate power-use deadline set.</small>';
        return `<div class="week-editor-card"><div class="week-editor-header"><div><span class="section-label">${range.toUpperCase()}</span><h4>${escapeHTML(t.name)}</h4></div><span class="feature-status">${t.active===false?"Inactive":"Active"}</span></div><div class="week-item-list"><div class="week-item"><div><p>${escapeHTML(t.description||"No description.")}</p><small><strong>Active period:</strong> ${range}</small>${power}</div><div class="advanced-card-actions"><button type="button" onclick="editTwist('${escapeAttribute(t.id)}')">Edit</button><button type="button" onclick="deleteTwist('${escapeAttribute(t.id)}')">Delete</button></div></div></div></div>`;
    }).join("");
}


function loadTwists(data) {
    const s = getAdvancedArrays();
    if (data && typeof data === "object" && !Array.isArray(data) && data.twistWeeks) {
        s.twistWeeks = deepClone(data.twistWeeks);
        s.twists = deepClone(data.twists || []);
        s.twists = s.twists.map(t => ({...t, startWeek: getWeekNumber(t.startWeek || t.week || 1), endWeek: getWeekNumber(t.endWeek || t.week || 1), powerUntil: getWeekNumber(t.powerUntil || t.endWeek || t.week || 1)}));
    } else {
        s.twists = deepClone(Array.isArray(data) ? data : []);
        s.twistWeeks = {};
        s.twists.forEach(t => {
            const startWeek = getWeekNumber(t.startWeek || t.week || (String(t.timing||"").startsWith("week") ? t.timing : 1));
            const endWeek = Math.max(startWeek, getWeekNumber(t.endWeek || startWeek));
            const obj = {...t, startWeek, endWeek, powerUntil: getWeekNumber(t.powerUntil || endWeek)};
            for (let w=startWeek; w<=endWeek; w++) (s.twistWeeks[String(w)] || (s.twistWeeks[String(w)] = [])).push({...obj, week:w});
        });
    }
    populateWeekSelectors(getSeasonLength());
    resetTwistEditor(); renderTwists();
}

function loadAlliances(data){getAdvancedArrays().alliances=deepClone(Array.isArray(data)?data:[]);refreshAdvancedHouseguestOptions();resetAllianceEditor();renderAlliances();}
function clearAdvancedEditors(){resetAllianceEditor();resetCompetitionEditor();resetTwistEditor();}

function getRelationshipValueSafe(from,to,key){const r=(currentSeason?.relationships||[]).find(x=>x.from===from&&x.to===to);return Number(r?.[key]||0);}
function allianceBond(playerId,targetId){const s=getAdvancedArrays();let score=0; s.alliances.filter(a=>a.status!=="inactive"&&(a.members||[]).includes(playerId)&&(a.members||[]).includes(targetId)).forEach(()=>score+=6);score += getRelationshipValueSafe(playerId,targetId,"trust")*0.7 + getRelationshipValueSafe(playerId,targetId,"loyalty")*0.8 + getRelationshipValueSafe(playerId,targetId,"friendship")*0.35 - getRelationshipValueSafe(playerId,targetId,"rivalry")*1.2;return score;}
function chooseEvictionTarget(nominees, active){if(nominees.length<=1)return nominees[0];const scores=nominees.map(target=>{let votesAgainst=0;active.filter(v=>v.id!==target.id&&v.id!==currentSeason.simulation?.currentHOH).forEach(v=>{const bond=allianceBond(v.id,target.id);const threat=(Number(target.ratings?.strategic||0)+Number(target.ratings?.social||0))*0.25;votesAgainst += Math.max(0,8-bond)+threat+Math.random()*4;});return {target,score:votesAgainst};});scores.sort((a,b)=>b.score-a.score);return scores[0].target;}



/* =========================================================
   CLEAN SIMULATION ENGINE
   One authoritative controller for the actual game.
   ========================================================= */

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
        currentEviction: null,
        pendingEvictionId: null,
        evictionVoteResult: null,
        evictionVotes: {},
        evictionsThisWeek: 0,
        pendingWeekAdvance: false,
        pendingCycle: null,
        viewingWeek: 1,
        isViewingHistory: false,
        liveView: null,
        vetoDrawCounts: {},
        lastVetoDrawnIds: [],
        twistState: {},
        finaleStarted: false,
        finalHOH1: null,
        finalHOH2: null,
        finalHOH3: null,
        finalHOH: null,
        finalEvictionId: null,
        finalists: [],
        juryVotes: {},
        renderingEventKey: null,
        renderingEventLabel: null
    };
}

function ensureSimulationRuntimeState(sim) {
    if (!sim) return sim;
    const defaults = createDefaultSimulation();
    Object.keys(defaults).forEach(k => {
        if (sim[k] === undefined) sim[k] = deepClone(defaults[k]);
    });
    if (!Array.isArray(sim.history)) sim.history = [];
    if (!Array.isArray(sim.finalPlacements)) sim.finalPlacements = [];
    if (!Array.isArray(sim.jury)) sim.jury = [];
    if (!Array.isArray(sim.finalists)) sim.finalists = [];
    if (!Array.isArray(sim.currentNominees)) sim.currentNominees = [];
    if (!Array.isArray(sim.currentPOVPlayers)) sim.currentPOVPlayers = [];
    if (!sim.twistState || typeof sim.twistState !== "object") sim.twistState = {};
    if (!sim.vetoDrawCounts || typeof sim.vetoDrawCounts !== "object") sim.vetoDrawCounts = {};
    if (!Array.isArray(sim.lastVetoDrawnIds)) sim.lastVetoDrawnIds = [];
    if (!sim.evictionVotes || typeof sim.evictionVotes !== "object") sim.evictionVotes = {};
    return sim;
}

function sim() {
    if (!currentSeason) return null;
    if (!currentSeason.simulation) currentSeason.simulation = createDefaultSimulation();
    return ensureSimulationRuntimeState(currentSeason.simulation);
}

function active() {
    return (currentSeason?.houseguests || []).filter(p => p.status !== "evicted" && p.status !== "jury" && p.status !== "out" && p.status !== "eliminated");
}

function playerById(id) {
    return (currentSeason?.houseguests || []).find(p => p.id === id) || null;
}

function playerName(id) {
    const p = playerById(id);
    return p ? (p.name || [p.firstName,p.lastName].filter(Boolean).join(" ") || "Houseguest") : "Unknown";
}

function getActiveHouseguests() { return active(); }
function getHouseguestForSimulation(id) { return playerById(id); }
function getHouseguestDisplayName(idOrPlayer, list = currentSeason?.houseguests || []) {
    const p = typeof idOrPlayer === "object" ? idOrPlayer : list.find(x => x.id === idOrPlayer);
    if (!p) return "Unknown";
    return p.name || [p.firstName,p.lastName].filter(Boolean).join(" ") || "Houseguest";
}
function getHouseguestNumber(id) {
    const p = playerById(id);
    if (!p) return "";
    const m = String(p.id || "").match(/(\d+)$/);
    return m ? m[1] : "";
}
function simulationPortrait(player, size="medium") {
    if (!player) return "";
    const src = player.image || "";
    const alt = escapeAttribute(getHouseguestDisplayName(player));
    const cls = `simulation-portrait simulation-portrait-${size}`;
    if (src) return `<img class="${cls}" src="${escapeAttribute(src)}" alt="${alt}" onerror="this.style.display='none';this.nextElementSibling?.classList.remove('is-hidden')"><span class="portrait-placeholder is-hidden">${escapeHTML((getHouseguestDisplayName(player).match(/[A-Za-z]/)||['?'])[0].toUpperCase())}</span>`;
    return `<div class="${cls} portrait-placeholder">${escapeHTML((getHouseguestDisplayName(player).match(/[A-Za-z]/)||['?'])[0].toUpperCase())}</div>`;
}
function simulationPortraits(ids=[], size="medium") { return ids.map(id => simulationPortrait(playerById(id), size)).join(""); }



function getFinalistsForFinale() {
    const a = active();
    const target = Number(currentSeason?.rules?.finalists || 2);
    return a.slice(0, Math.max(2, Math.min(a.length, target)));
}

function getJuryMembers() {
    const size = Math.max(0, Number(currentSeason?.rules?.jurySize || 0));
    const players = [...(currentSeason?.houseguests || [])]
        .filter(p => p.status === "jury" || (Number.isFinite(Number(p.placement)) && Number(p.placement) >= 3))
        .sort((a,b) => Number(b.placement||0) - Number(a.placement||0));
    if (players.length >= size) return players.slice(0, size);
    return (currentSeason?.houseguests || []).filter(p => p.status === "jury").slice(-size);
}

function normalizeCompetition(c) {
    return c ? {
        id:c.id, name:c.name || "Competition", description:c.description || "",
        primary:c.primary || "general", secondary:c.secondary || "mental", type:c.type || "pov"
    } : null;
}

function chooseCompetitionWinner(players, primary="general", secondary="mental", general="general") {
    if (!players.length) return null;
    const weighted = players.map(p => {
        const r=p.ratings||{};
        const score = Number(r[primary]||r[general]||5)*0.55 + Number(r[secondary]||5)*0.30 + Number(r.general||5)*0.15 + Math.random()*7;
        return {p,score};
    }).sort((a,b)=>b.score-a.score);
    return weighted[0].p;
}

function chooseCompetitionWinnerByCustom(players, competition) {
    return chooseCompetitionWinner(players, competition?.primary || "general", competition?.secondary || "mental", "general");
}

function chooseCustomCompetition(type, week = sim()?.currentWeek || 1) {
    const s=getAdvancedArrays();
    const weekly=(s.competitionWeeks?.[String(week)]||[]).filter(c => c.type === type);
    if (weekly.length) return normalizeCompetition(weekly[Math.floor(Math.random()*weekly.length)]);
    const list=s.competitions?.[type] || [];
    if (list.length) return normalizeCompetition(list[Math.floor(Math.random()*list.length)]);
    return null;
}

function competitionFor(week,type) { return chooseCustomCompetition(type,week); }

function getScheduledTwistsForWeek(week) {
    const source = Array.isArray(currentSeason?.twists) ? currentSeason.twists : [];
    return source.filter(t => {
        if (!t || t.active === false) return false;
        const start=Number(t.startWeek||t.week||1), end=Number(t.endWeek||start);
        return Number(week)>=start && Number(week)<=end;
    });
}

function getWeekEventChain(week=sim()?.currentWeek||1) {
    if (sim()?.finaleStarted) return getFinaleChain();
    const chain=[];
    getScheduledTwistsForWeek(week).forEach(t=>chain.push({key:"twist",label:t.name||"Twist",twistId:t.id}));
    if (currentSeason?.rules?.safetyCompetitionEnabled) chain.push({key:"safety",label:"Safety Competition"});
    chain.push({key:"hoh",label:"HOH Competition"},{key:"nominations",label:"Nomination Ceremony"});
    if (currentSeason?.rules?.vetoEnabled !== false) chain.push({key:"pov-players",label:"Veto Player Selection"},{key:"pov",label:"Veto Competition"},{key:"veto-ceremony",label:"Veto Ceremony"});
    const specials=getWeekCompetitions(week).filter(c=>["special","luxury"].includes(c.type));
    specials.forEach(c=>chain.push({key:"custom-competition",label:c.name||"Special Competition",competitionId:c.id}));
    chain.push({key:"eviction-voting",label:"Eviction Voting"},{key:"eviction",label:"Eviction"});
    return chain;
}

function getFinaleChain() {
    return [
        {key:"final-hoh-1",label:"Final HOH Part 1"},
        {key:"final-hoh-2",label:"Final HOH Part 2"},
        {key:"final-hoh-3",label:"Final HOH Part 3"},
        {key:"final-eviction",label:"Final Eviction"},
        {key:"jury-voting",label:"Jury Voting"},
        {key:"finale-results",label:"Final Results"}
    ];
}

function recordSimulationEvent(key,title,content,week=sim()?.currentWeek||1) {
    const s=sim();
    if (!s) return;
    s.history.push({week:Number(week),event:key,label:title,title,content,at:new Date().toISOString()});
}

function showEvent(title,type,content,options={}) {
    const s=sim();
    const week=Number(options.week||s?.currentWeek||1);
    const titleEl=document.getElementById("event-title"), typeEl=document.getElementById("event-type"), contentEl=document.getElementById("event-content"), weekEl=document.getElementById("simulator-event-week-title");
    if(titleEl) titleEl.textContent=title||"Event";
    if(typeEl) typeEl.textContent=type||"EVENT";
    if(contentEl) contentEl.innerHTML=content||"";
    if(weekEl) weekEl.textContent=week ? `Week ${week}` : "Simulation";
    if(s && options.record !== false && !options.historyView) {
        s.liveView={title,type,content,week};
        if(options.eventKey) recordSimulationEvent(options.eventKey,title,content,week);
    }
    updateSimulatorStatus(s);
}

function getHistoryForWeek(week) { return (sim()?.history||[]).filter(h=>Number(h.week)===Number(week)); }
function showHistoricalSimulationEvent(item) { if(!item)return; showEvent(item.title||item.label,"HISTORY",item.content||"",{week:item.week,historyView:true,record:false}); }
function viewSimulationHistoryEvent(week,sequence) { const items=getHistoryForWeek(week); showHistoricalSimulationEvent(items[Number(sequence)]); }
function viewSimulationWeek(week) { const items=getHistoryForWeek(week); if(items.length) showHistoricalSimulationEvent(items[items.length-1]); sim().isViewingHistory=true; updateProceedButtonForViewMode(); }
function returnToCurrentSimulation() { const s=sim(); if(!s)return; s.isViewingHistory=false; const h=s.liveView; if(h) showEvent(h.title,h.type,h.content,{week:h.week,record:false}); else updateSimulatorStatus(s); updateProceedButtonForViewMode(); }
function updateProceedButtonForViewMode() { const b=document.querySelector(".sim-proceed-button"); if(b) b.textContent=sim()?.isViewingHistory ? "Return to Current" : (sim()?.completed ? "Season Complete" : "Proceed"); }

function renderSimulationWeekNavigation() {
    const c=document.getElementById("sim-week-navigation"); if(!c)return;
    const s=sim(); const max=Math.max(1,getSeasonLength());
    let html="";
    for(let w=1;w<=max;w++) {
        const count=getHistoryForWeek(w).length;
        const cls=`sim-week-nav-item ${w===Number(s?.currentWeek)?"active":""} ${count?"has-history":""}`;
        html+=`<button type="button" class="${cls}" onclick="viewSimulationWeek(${w})">Week ${w}${count?` <span>${count}</span>`:""}</button>`;
    }
    c.innerHTML=html;
}

function memoryWallPlayerHTML(p,compact=false) {
    const status=p.status||"active";
    return `<div class="memory-wall-player ${compact?"compact":""} ${status}">${simulationPortrait(p,compact?"small":"medium")}<div class="memory-wall-name">${escapeHTML(getHouseguestDisplayName(p))}</div>${p.placement?`<div class="memory-wall-placement">${ordinal(p.placement)}</div>`:""}</div>`;
}
function ordinal(n){const x=Number(n); if(x%100>=11&&x%100<=13)return `${x}th`; return `${x}${["th","st","nd","rd"][Math.min(x%10,3)]||"th"}`;}
function renderMemoryWallMini(){const c=document.getElementById("sim-memory-wall-mini");if(!c)return;c.innerHTML=(currentSeason?.houseguests||[]).map(p=>memoryWallPlayerHTML(p,true)).join("");}
function showMemoryWall(){
    const players=currentSeason?.houseguests||[];
    const body=`<div class="full-memory-wall"><div class="memory-wall-grid">${players.map(p=>memoryWallPlayerHTML(p)).join("")}</div><button type="button" class="secondary-button" onclick="closeModal()">Close</button></div>`;
    openModal(body);
}

function updateSimulatorStatus(s=sim()) {
    if(!s)return;
    setText("simulator-season-name",currentSeason?.name||"Big Brother");
    setText("simulator-season-theme",currentSeason?.theme||"Season Theme");
    setText("current-week",s.currentWeek||1);
    setText("sim-season-length",getSeasonLength());
    setText("sim-jury-size",currentSeason?.rules?.jurySize||0);
    setText("current-hoh",playerName(s.currentHOH));
    setText("current-nominees",(s.currentNominees||[]).map(playerName).join(" / ")||"—");
    setText("current-veto",playerName(s.currentPOVWinner)||"—");
    renderMemoryWallMini();
    renderSimulationWeekNavigation();
    updateProceedButtonForViewMode();
}

function renderDynamicGameChain(){
    // The current HTML uses a week navigation rather than a separate chain panel.
    updateSimulatorStatus(sim());
}
function resetGameChain(){ const s=sim(); if(s){s.currentEventIndex=0;s.pendingCycle=null;} updateSimulatorStatus(s); }

function initializeSimulator(season) {
    currentSeason=season||currentSeason;
    if(!currentSeason)return;
    if(!currentSeason.simulation) currentSeason.simulation=createDefaultSimulation();
    const s=ensureSimulationRuntimeState(currentSeason.simulation);
    s.viewingWeek=s.currentWeek||1;
    showPage("simulator-page");
    updateSimulatorStatus(s);
    renderDynamicGameChain();
    if(!s.started) {
        showEvent("Simulation Ready","READY",`<p>Click <strong>Proceed</strong> to begin <strong>${escapeHTML(currentSeason.name||"Big Brother")}</strong>.</p>`,{record:false});
    } else if(s.liveView) {
        showEvent(s.liveView.title,s.liveView.type,s.liveView.content,{week:s.liveView.week,record:false});
    } else {
        showEvent("Continue Simulation","READY","<p>Your saved season is ready to continue.</p>",{record:false});
    }
}

function chooseVetoPlayers(activePlayers,hohId,nominees,required) {
    const s=sim();
    const eligible=activePlayers.filter(p=>p.id!==hohId && !nominees.includes(p.id));
    const chosen=[];
    const counts=s?.vetoDrawCounts||{};
    eligible.sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
    while(chosen.length<Math.min(required,eligible.length)) {
        const pool=eligible.filter(p=>!chosen.includes(p));
        if(!pool.length)break;
        const p=pool[Math.floor(Math.random()*pool.length)];
        chosen.push(p); counts[p.id]=(counts[p.id]||0)+1;
    }
    return chosen;
}



function runTwistEvent(twistId) {
    const s=sim(); const twist=(currentSeason?.twists||[]).find(t=>t.id===twistId); if(!twist)return;
    if(!s.twistState[twist.id])s.twistState[twist.id]={used:false,holderId:null};
    const state=s.twistState[twist.id];
    const eligible=active().filter(p=>p.id!==s.currentHOH);
    if(!state.holderId && eligible.length) state.holderId=eligible[Math.floor(Math.random()*eligible.length)].id;
    const holder=playerById(state.holderId);
    state.used=true;
    const effect=twist.effectType||"display";
    if(effect==="safety" && holder) holder.safetyWins=(holder.safetyWins||0)+1;
    showEvent(twist.name||"Twist","TWIST",`<div class="event-card"><h3>${escapeHTML(twist.name||"Twist")}</h3><p>${escapeHTML(twist.description||"A twist is in effect.")}</p>${holder?`<p><strong>${escapeHTML(holder.name)}</strong> holds the power.</p>`:""}</div>`,{eventKey:"twist"});
}

function runSafetyEvent(){
    const s=sim(); const players=active();
    if(!players.length)return;
    const comp=competitionFor(s.currentWeek,"safety");
    const eligible=players.filter(p=>p.id!==s.currentHOH);
    const winner=chooseCompetitionWinnerByCustom(eligible,comp||{primary:"physical",secondary:"mental"});
    s.currentSafetyWinner=winner?.id||null;
    if(winner)winner.safetyWins=(winner.safetyWins||0)+1;
    showEvent(comp?.name||"Safety Competition","SAFETY",`<div class="competition-result">${winner?simulationPortrait(winner,"medium"):""}<h3>${escapeHTML(comp?.name||"Safety Competition")}</h3><p><strong>${escapeHTML(winner?.name||"No winner")}</strong> wins safety.</p></div>`,{eventKey:"safety"});
}

function applyNominationTwistProtections(eligible){
    const s=sim();
    const protectedIds=new Set([s.currentHOH,s.currentSafetyWinner].filter(Boolean));
    (currentSeason?.twists||[]).forEach(t=>{
        const st=s.twistState?.[t.id];
        if(st?.holderId && t.effectType==="safety" && Number(s.currentWeek)<=Number(t.powerUntil||t.endWeek||999))protectedIds.add(st.holderId);
    });
    return eligible.filter(p=>!protectedIds.has(p.id));
}

function runHOHEvent(){
    const s=sim(); const players=active();
    if(!players.length)return;
    let winner=null;
    const rule=currentSeason?.rules?.startingHOH;
    if(s.currentWeek===1 && rule==="specific" && currentSeason.rules.specificStartingHOH) winner=playerById(currentSeason.rules.specificStartingHOH);
    if(!winner) winner=chooseCompetitionWinner(players, "physical", "mental", "general");
    s.currentHOH=winner?.id||null;
    if(winner)winner.hohWins=(winner.hohWins||0)+1;
    const comp=competitionFor(s.currentWeek,"hoh");
    showEvent(comp?.name||"HOH Competition","HOH",`<div class="competition-result">${winner?simulationPortrait(winner,"medium"):""}<h3>${escapeHTML(comp?.name||"HOH Competition")}</h3><p><strong>${escapeHTML(winner?.name||"No winner")}</strong> is the new Head of Household.</p></div>`,{eventKey:"hoh"});
}

function runNominationEvent(){
    const s=sim(); const players=applyNominationTwistProtections(active());
    const count=Math.max(1,Math.min(Number(currentSeason?.rules?.nomineesPerWeek||2),players.length));
    const nominees=[];
    const forced=(currentSeason?.rules?.customNominees||[]).map(id=>playerById(id)).filter(Boolean);
    forced.forEach(p=>{if(!nominees.some(x=>x.id===p.id)&&p.id!==s.currentHOH)nominees.push(p);});
    while(nominees.length<count){
        const pool=players.filter(p=>!nominees.some(n=>n.id===p.id));
        if(!pool.length)break;
        nominees.push(chooseEvictionTarget(pool,players)||pool[Math.floor(Math.random()*pool.length)]);
    }
    s.currentNominees=nominees.map(p=>p.id); nominees.forEach(p=>p.nominationCount=(p.nominationCount||0)+1);
    showEvent("Nomination Ceremony","NOMINATIONS",`<div class="ceremony-stage"><h3>Nomination Ceremony</h3><div class="ceremony-players">${nominees.map(p=>memoryWallPlayerHTML(p)).join("")}</div><p>${escapeHTML(playerName(s.currentHOH))} has nominated <strong>${escapeHTML(nominees.map(p=>p.name).join(" and "))}</strong> for eviction.</p></div>`,{eventKey:"nominations"});
}

function runPOVPlayersEvent(){
    const s=sim(); const players=active(); const required=Math.max(0,Number(currentSeason?.rules?.vetoPlayers||6));
    if(currentSeason?.rules?.vetoEnabled===false){s.currentPOVPlayers=[];return;}
    const picked=chooseVetoPlayers(players,s.currentHOH,s.currentNominees,required);
    s.currentPOVPlayers=[s.currentHOH,...s.currentNominees,...picked].filter((id,i,a)=>id && a.indexOf(id)===i);
    s.lastVetoDrawnIds=picked.map(p=>p.id);
    showEvent("Veto Player Selection","VETO DRAW",`<h3>Players selected for the Power of Veto</h3><div class="ceremony-players">${s.currentPOVPlayers.map(id=>memoryWallPlayerHTML(playerById(id))).join("")}</div>`,{eventKey:"pov-players"});
}

function runPOVEvent(){
    const s=sim(); const players=(s.currentPOVPlayers||[]).map(playerById).filter(Boolean);
    if(!players.length)return;
    const comp=competitionFor(s.currentWeek,"pov"); const winner=chooseCompetitionWinnerByCustom(players,comp||{primary:"physical",secondary:"mental"});
    s.currentPOVWinner=winner?.id||null; if(winner)winner.povWins=(winner.povWins||0)+1;
    showEvent(comp?.name||"Power of Veto Competition","VETO",`<div class="competition-result">${winner?simulationPortrait(winner,"medium"):""}<h3>${escapeHTML(comp?.name||"Power of Veto Competition")}</h3><p><strong>${escapeHTML(winner?.name||"No winner")}</strong> wins the Power of Veto.</p></div>`,{eventKey:"pov"});
}

function runVetoCeremonyEvent(){
    const s=sim(); const nominees=(s.currentNominees||[]).map(playerById).filter(Boolean); const winner=playerById(s.currentPOVWinner);
    if(!nominees.length)return;
    let removed=null, replacement=null;
    if(winner && nominees.some(p=>p.id===winner.id)) {
        const eligible=active().filter(p=>p.id!==s.currentHOH && !nominees.some(n=>n.id===p.id));
        replacement=eligible.length?chooseEvictionTarget(eligible,eligible):eligible[0];
        if(replacement){removed=nominees.find(p=>p.id!==winner.id)||nominees[0];s.currentNominees=[...nominees.filter(p=>p.id!==removed.id).map(p=>p.id),replacement.id];replacement.nominationCount=(replacement.nominationCount||0)+1;}
    }
    const finalNominees=s.currentNominees.map(playerById).filter(Boolean);
    showEvent("Veto Ceremony","VETO CEREMONY",`<div class="ceremony-stage"><p><strong>${escapeHTML(winner?.name||"The veto holder")}</strong> has ${removed?"used the Power of Veto to remove "+escapeHTML(removed.name)+".":"chosen not to use the Power of Veto."}</p>${replacement?`<p><strong>${escapeHTML(playerName(s.currentHOH))}</strong> names <strong>${escapeHTML(replacement.name)}</strong> as the replacement nominee.</p>`:""}<div class="ceremony-players">${finalNominees.map(p=>memoryWallPlayerHTML(p)).join("")}</div></div>`,{eventKey:"veto-ceremony"});
}

function runCustomCompetitionEvent(competitionId){
    const s=sim(); const c=getWeekCompetitions(s.currentWeek).find(x=>x.id===competitionId); if(!c)return;
    const players=active(); const winner=chooseCompetitionWinnerByCustom(players,c); if(winner)winner.customCompetitionWins=(winner.customCompetitionWins||0)+1;
    showEvent(c.name||"Competition",String(c.type||"SPECIAL").toUpperCase(),`<div class="competition-result">${winner?simulationPortrait(winner,"medium"):""}<h3>${escapeHTML(c.name||"Competition")}</h3><p><strong>${escapeHTML(winner?.name||"No winner")}</strong> wins.</p></div>`,{eventKey:"custom-competition"});
}

function runEvictionVotingEvent(){
    const s=sim(); const nominees=(s.currentNominees||[]).map(playerById).filter(Boolean); const voters=active().filter(p=>p.id!==s.currentHOH && !nominees.some(n=>n.id===p.id));
    const votes={}; nominees.forEach(n=>votes[n.id]=0);
    const voteDetails=[];
    voters.forEach(v=>{
        const target=chooseEvictionTarget(nominees,voters)||nominees[0]; if(!target)return;
        votes[target.id]=(votes[target.id]||0)+1; target.evictionVotesReceived=(target.evictionVotesReceived||0)+1; voteDetails.push({voter:v.id,target:target.id});
    });
    s.evictionVotes= votes;
    const ordered=nominees.slice().sort((a,b)=>(votes[b.id]||0)-(votes[a.id]||0));
    let evicted=ordered[0];
    if(ordered.length>1 && votes[ordered[0].id]===votes[ordered[1].id]) evicted=chooseEvictionTarget(ordered,voters)||ordered[0];
    s.pendingEvictionId=evicted?.id||null;
    s.evictionVoteResult={votes,details:voteDetails,evictedId:s.pendingEvictionId};
    showEvent("Eviction Voting","EVICTION VOTE",`<div class="vote-results">${voteDetails.map(v=>`<p><strong>${escapeHTML(playerName(v.voter))}</strong> votes to evict <strong>${escapeHTML(playerName(v.target))}</strong>.</p>`).join("")}<hr>${nominees.map(n=>`<p>${escapeHTML(n.name)}: <strong>${votes[n.id]||0}</strong> vote${(votes[n.id]||0)===1?"":"s"}</p>`).join("")}<p><strong>${escapeHTML(evicted?.name||"No one")} is evicted.</strong></p></div>`,{eventKey:"eviction-voting"});
}

function placeEvicted(player) {
    if(!player)return;
    const s=sim();
    // Placement is determined by the number of players remaining immediately
    // before the eviction: a 16-person cast's first evictee is 16th, the next
    // is 15th, etc. This also makes the jury boundary deterministic.
    const activeBefore=currentSeason.houseguests.filter(p=>p.status!=="evicted"&&p.status!=="jury"&&p.status!=="out"&&p.status!=="eliminated").length;
    const placement=Math.max(3,activeBefore);
    player.status="evicted"; player.placement=placement; player.weeksInGame=(player.weeksInGame||0); player.evictionWeek=s.currentWeek;
    const jurySize=Number(currentSeason?.rules?.jurySize||0);
    if(currentSeason?.rules?.juryVotingEnabled && jurySize>0 && placement>=3 && placement<=jurySize+2) player.status="jury";
}

function runEvictionEvent(){
    const s=sim(); const evicted=playerById(s.pendingEvictionId || s.evictionVoteResult?.evictedId); if(!evicted)return;
    placeEvicted(evicted); s.currentEviction=evicted.id; s.evictionsThisWeek=(s.evictionsThisWeek||0)+1;
    const placement=evicted.placement;
    showEvent("Eviction","EVICTION",`<div class="eviction-stage">${simulationPortrait(evicted,"large")}<h3>${escapeHTML(evicted.name)} has been evicted.</h3><p>${ordinal(placement)} place.</p></div>`,{eventKey:"eviction"});
    s.currentNominees=[];s.currentPOVPlayers=[];s.currentPOVWinner=null;s.pendingEvictionId=null;
}

function shouldStartFinale(){ return active().length <= Math.max(2,Number(currentSeason?.rules?.finalists||2)); }

function beginFinale(){
    const s=sim(); if(!s || s.completed)return;
    const finalists=active().slice(0,Math.max(2,Number(currentSeason?.rules?.finalists||2))).map(p=>p.id);
    s.finalists=finalists;s.jury=getJuryMembers().map(p=>p.id);s.finaleStarted=true;s.currentPhase="finale";s.currentEventIndex=0;s.finalHOH1=null;s.finalHOH2=null;s.finalHOH3=null;s.finalHOH=null;s.finalEvictionId=null;
    showEvent("Final 3","FINALE","<p>The final three are ready for the Final HOH competition.</p>",{record:false});
}
function beginCleanFinale(){beginFinale();}

function runFinalHOHEvent(){
    const s=sim(); const finalists=(s.finalists||[]).map(playerById).filter(Boolean); const idx=Number(s.currentEventIndex||0);
    let eligible=finalists;
    let label="Final HOH Part 1", field="finalHOH1";
    if(idx===1){label="Final HOH Part 2";field="finalHOH2";eligible=finalists.filter(p=>p.id!==s.finalHOH1);}
    else if(idx===2){label="Final HOH Part 3";field="finalHOH3";eligible=finalists.filter(p=>p.id===s.finalHOH1 || p.id===s.finalHOH2);}
    const comps=currentSeason?.competitions?.finalHoh||[]; const comp=comps[idx]||comps[comps.length-1]||{name:label,primary:"mental",secondary:"endurance"};
    const winner=chooseCompetitionWinnerByCustom(eligible,comp); s[field]=winner?.id||null;
    if(idx===2)s.finalHOH=winner?.id||null;
    showEvent(comp.name||label,"FINAL HOH",`<div class="competition-result">${winner?simulationPortrait(winner,"medium"):""}<h3>${escapeHTML(comp.name||label)}</h3><p><strong>${escapeHTML(winner?.name||"No winner")}</strong> wins ${escapeHTML(label)}.</p></div>`,{eventKey:`final-hoh-${idx+1}`});
}

function runFinalEviction(){
    const s=sim(); const finalists=(s.finalists||[]).map(playerById).filter(Boolean); if(finalists.length<=2){s.finalEvictionId=null;return;}
    const hoh=playerById(s.finalHOH); const target=finalists.find(p=>p.id!==s.finalHOH) || finalists[Math.floor(Math.random()*finalists.length)];
    s.finalEvictionId=target?.id||null; if(target){placeEvicted(target);target.status="evicted";target.placement=3;}
    s.finalists=finalists.filter(p=>p.id!==target?.id).map(p=>p.id);
    showEvent("Final Eviction","FINAL EVICTION",`<div class="eviction-stage">${target?simulationPortrait(target,"large"):""}<h3>${escapeHTML(target?.name||"No one")} finishes in 3rd place.</h3><p>Final HOH: <strong>${escapeHTML(hoh?.name||"—")}</strong></p></div>`,{eventKey:"final-eviction"});
}

function runJuryVoting(){
    const s=sim(); const finalists=(s.finalists||[]).map(playerById).filter(Boolean); const jury=getJuryMembers(); const votes={}; finalists.forEach(p=>votes[p.id]=0);
    jury.forEach(j=>{
        const scores=finalists.map(p=>{
            const bond=allianceBond(j.id,p.id); const r=p.ratings||{}; return {p,score:bond+Number(r.social||5)*0.6+Number(r.strategic||5)*0.45+Math.random()*8};
        }).sort((a,b)=>b.score-a.score); if(scores[0])votes[scores[0].p.id]=(votes[scores[0].p.id]||0)+1;
    });
    const ranked=finalists.slice().sort((a,b)=>(votes[b.id]||0)-(votes[a.id]||0)); const winner=ranked[0],runner=ranked[1];
    s.juryVotes=votes;s.winner=winner?.id||null;s.runnerUp=runner?.id||null;
    showEvent("Jury Voting","JURY",`<div class="vote-results"><h3>Final Jury Vote</h3>${jury.map(j=>{const target=finalists.slice().sort((a,b)=>{const ba=allianceBond(j.id,a.id)+Math.random()*3,bb=allianceBond(j.id,b.id)+Math.random()*3;return bb-ba;})[0];return `<p><strong>${escapeHTML(j.name)}</strong> votes for <strong>${escapeHTML(target?.name||"—")}</strong>.</p>`}).join("")}<hr>${ranked.map(p=>`<p><strong>${escapeHTML(p.name)}</strong>: ${votes[p.id]||0}</p>`).join("")}</div>`,{eventKey:"jury-voting"});
}

function assignFinalPlacements(){
    const s=sim(); const all=currentSeason.houseguests||[]; const finals=(s.finalists||[]).map(playerById).filter(Boolean); const winner=playerById(s.winner),runner=playerById(s.runnerUp);
    if(winner){winner.status="winner";winner.placement=1;}
    if(runner){runner.status="runner-up";runner.placement=2;}
    finals.filter(p=>p.id!==s.winner&&p.id!==s.runnerUp).forEach(p=>{if(!p.placement)p.placement=3;p.status="evicted";});
    const evicted=all.filter(p=>p.status==="evicted"&&p.placement==null).sort((a,b)=>(b.evictionWeek||0)-(a.evictionWeek||0));
    let next=3; finals.forEach(p=>{if(p.placement)next=Math.max(next,p.placement+1);});
    evicted.forEach(p=>{if(!p.placement)p.placement=next++;});
    all.filter(p=>p.id!==s.winner&&p.id!==s.runnerUp&&p.placement==null).forEach(p=>p.placement=next++);
    s.finalPlacements=all.slice().sort((a,b)=>Number(a.placement||99)-Number(b.placement||99)).map(p=>({id:p.id,name:p.name,placement:p.placement}));
}

function renderFinalPlacements(){
    const c=document.getElementById("final-placements"); if(!c)return; const list=(sim()?.finalPlacements||[]).slice().sort((a,b)=>Number(a.placement)-Number(b.placement));
    c.innerHTML=`<div class="final-placement-wall">${list.map(x=>memoryWallPlayerHTML(playerById(x.id)||{id:x.id,name:x.name,placement:x.placement},false)).join("")}</div>`;
}
function renderFinalJuryResults(){
    const c=document.getElementById("final-jury-results");if(!c)return;const s=sim();const votes=s.juryVotes||{};c.innerHTML=Object.entries(votes).map(([id,n])=>`<div class="jury-result-row"><strong>${escapeHTML(playerName(id))}</strong><span>${n} vote${Number(n)===1?"":"s"}</span></div>`).join("")||"<p>No jury vote recorded.</p>";
}
function renderSeasonStatistics(){
    const c=document.getElementById("season-statistics");if(!c)return;const ps=currentSeason?.houseguests||[];c.innerHTML=`<div class="statistics-grid">${ps.map(p=>`<div class="stat-row"><strong>${escapeHTML(p.name)}</strong><span>HOH ${p.hohWins||0}</span><span>POV ${p.povWins||0}</span><span>Noms ${p.nominationCount||0}</span></div>`).join("")}</div>`;
}

function runFinaleResults(){
    const s=sim(); assignFinalPlacements(); s.completed=true;s.currentPhase="complete";s.currentEventIndex=0;persistCurrentSeason();showResults();
}
function runFinaleResultsEvent(){runFinaleResults();}
function finalizeSeason(){runFinaleResults();}

function runNextEvent(){
    const s=sim(); if(!s || s.completed)return;
    if(s.isViewingHistory){returnToCurrentSimulation();return;}
    if(!s.started){s.started=true;s.currentWeek=1;s.currentEventIndex=0;s.currentPhase="week";s.evictionsThisWeek=0;recordSimulationEvent("start","Season Started","<p>The season has begun.</p>",1);}
    if(!s.finaleStarted && shouldStartFinale() && active().length<=3){beginFinale();}
    const chain=s.finaleStarted?getFinaleChain():getWeekEventChain(s.currentWeek);
    if(s.currentEventIndex>=chain.length){
        if(s.finaleStarted){return;}
        const doubleWeeks=currentSeason?.rules?.doubleEvictionEnabled ? (currentSeason.rules.doubleEvictionWeeks||[]) : [];
        const isDouble=(Array.isArray(doubleWeeks)&&doubleWeeks.map(Number).includes(Number(s.currentWeek))) || (s.evictionsThisWeek>1);
        if(isDouble && s.evictionsThisWeek<2 && active().length>3){s.currentNominees=[];s.currentPOVPlayers=[];s.currentPOVWinner=null;s.evictionsThisWeek++;s.currentEventIndex=0;return runNextEvent();}
        if(active().length<=3){beginFinale();return runNextEvent();}
        s.currentWeek=Math.min(getSeasonLength(),s.currentWeek+1);s.currentEventIndex=0;s.evictionsThisWeek=0;s.currentHOH=null;s.currentSafetyWinner=null;s.currentPhase="week";persistCurrentSeason();return runNextEvent();
    }
    const ev=chain[s.currentEventIndex];
    s.renderingEventKey=ev.key;s.renderingEventLabel=ev.label;
    try{
        switch(ev.key){
            case "twist": runTwistEvent(ev.twistId);break;
            case "safety": runSafetyEvent();break;
            case "hoh": runHOHEvent();break;
            case "nominations": runNominationEvent();break;
            case "pov-players": runPOVPlayersEvent();break;
            case "pov": runPOVEvent();break;
            case "veto-ceremony": runVetoCeremonyEvent();break;
            case "custom-competition": runCustomCompetitionEvent(ev.competitionId);break;
            case "eviction-voting": runEvictionVotingEvent();break;
            case "eviction": runEvictionEvent();break;
            case "final-hoh-1": case "final-hoh-2": case "final-hoh-3": runFinalHOHEvent();break;
            case "final-eviction": runFinalEviction();break;
            case "jury-voting": runJuryVoting();break;
            case "finale-results": runFinaleResults();break;
            default: showEvent("Event","EVENT","<p>Unknown event.</p>",{record:false});
        }
    }catch(error){
        console.error("Simulation event error",error);
        showEvent("Simulation Error","ERROR",`<p>${escapeHTML(error.message||String(error))}</p><p>You can continue with Proceed.</p>`,{record:false});
    }
    s.currentEventIndex++;
    s.liveView={title:document.getElementById("event-title")?.textContent||ev.label,type:document.getElementById("event-type")?.textContent||"EVENT",content:document.getElementById("event-content")?.innerHTML||"",week:s.currentWeek};
    persistCurrentSeason();
    updateSimulatorStatus(s);
}

function showResults(){
    const s=sim(); if(!s)return; assignFinalPlacements();
    setText("results-season-name",currentSeason?.name||"Big Brother");setText("winner-name",playerName(s.winner)||"—");setText("runner-up-name",playerName(s.runnerUp)||"—");
    renderFinalPlacements();renderFinalJuryResults();renderSeasonStatistics();showPage("results-page");
}

function resimulateSeason(){
    if(!currentSeason)return;
    currentSeason=deepClone(currentSeason);
    currentSeason.houseguests=(currentSeason.houseguests||[]).map(p=>({...p,status:"active",placement:null,weeksInGame:0,hohWins:0,povWins:0,safetyWins:0,nominationCount:0,evictionVotesReceived:0,customCompetitionWins:0}));
    currentSeason.simulation=createDefaultSimulation();
    showPage("simulator-page");initializeSimulator(currentSeason);persistCurrentSeason();
}

function resetGame(){resimulateSeason();}

function getHistoryNavigation(){return renderSimulationWeekNavigation();}

// Rebind inline handlers after every script in index.html has loaded. This keeps
// the clean engine authoritative even if legacy fix files are still present.
document.addEventListener("DOMContentLoaded",()=>{
    window.runNextEvent=runNextEvent;
    window.showResults=showResults;
    window.openSeason=openSeason;
    window.initializeSimulator=initializeSimulator;
    window.resimulateSeason=resimulateSeason;
    window.showMemoryWall=showMemoryWall;
    window.viewSimulationWeek=viewSimulationWeek;
    window.viewSimulationHistoryEvent=viewSimulationHistoryEvent;
    window.returnToCurrentSimulation=returnToCurrentSimulation;
    window.renderSimulationWeekNavigation=renderSimulationWeekNavigation;
    if(currentSeason?.simulation?.started) initializeSimulator(currentSeason);
});

// Explicitly expose the public API used by the existing HTML and creator.
Object.assign(window, {
    addHouseguest, removeHouseguest, updateHouseguestCount, updateHouseguestImage,
    saveSeason, editSeason, openSeason, deleteSeason, createNewSeason,
    runNextEvent, showResults, closeModal, openModal,
    addRelationship, editRelationship, deleteRelationship, updateRelationshipDisplay,
    saveAlliance, editAlliance, deleteAlliance, saveCompetition, editCompetition, deleteCompetition,
    saveTwist, editTwist, deleteTwist, resetSeasonCreator, showMemoryWall,
    resimulateSeason, viewSimulationWeek, viewSimulationHistoryEvent, returnToCurrentSimulation
});
