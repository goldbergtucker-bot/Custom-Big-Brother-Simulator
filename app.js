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
        evictionsThisWeek: 0,
        pendingWeekAdvance: false,
        viewingWeek: 1

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


function getHouseguestForSimulation(id) {
    return (currentSeason?.houseguests || []).find(p => p.id === id) || null;
}

function simulationPortrait(player, size = "medium") {
    if (!player) return "";
    const name = getHouseguestDisplayName(player.id, currentSeason?.houseguests || []);
    const image = String(player.image || "").trim();
    const cls = `sim-portrait sim-portrait-${size}`;
    if (image) {
        return `<div class="${cls}"><img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}" onerror="this.style.display='none';this.parentElement.classList.add('no-image');"><span>${escapeHTML(name)}</span></div>`;
    }
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "?";
    return `<div class="${cls} no-image"><div class="sim-portrait-placeholder">${escapeHTML(initials)}</div><span>${escapeHTML(name)}</span></div>`;
}

function simulationPortraits(ids = [], size = "medium") {
    const players = (ids || []).map(getHouseguestForSimulation).filter(Boolean);
    return `<div class="sim-portrait-grid">${players.map(p => simulationPortrait(p, size)).join("")}</div>`;
}

function getCompetitionForWeekType(week, type) {
    const wanted=String(type||"").toLowerCase();
    return getWeekCompetitions(week).find(c => String(c.type||"").toLowerCase() === wanted) || null;
}

function showEvent(title, type, content, options = {}) {
    const titleEl = document.getElementById("event-title");
    const typeEl = document.getElementById("event-type");
    const contentEl = document.getElementById("event-content");
    if (titleEl) titleEl.textContent = title || "Event";
    if (typeEl) typeEl.textContent = type || "EVENT";
    if (contentEl) contentEl.innerHTML = content || "";

    const sim = currentSeason?.simulation;
    const displayWeek = Number(options.week || sim?.currentWeek || 1);
    const weekTitle = document.getElementById("simulator-event-week-title");
    if (weekTitle) weekTitle.textContent = `Week ${displayWeek}`;

    // Save a viewable snapshot for BrantSteele-style back navigation.
    if (sim && !options.skipHistory && sim.renderingEventKey) {
        if (!Array.isArray(sim.history)) sim.history = [];
        const sequence = sim.history.filter(h => Number(h.week) === displayWeek).length;
        sim.history.push({
            week: displayWeek,
            event: sim.renderingEventKey,
            label: sim.renderingEventLabel || title || "Event",
            title: title || "Event",
            type: type || "EVENT",
            content: content || "",
            sequence,
            timestamp: Date.now()
        });
        sim.renderingEventKey = null;
        sim.renderingEventLabel = null;
    }

    renderSimulationWeekNavigation();
}

function getHistoryForWeek(week) {
    const history = currentSeason?.simulation?.history || [];
    return history.filter(item => Number(item.week) === Number(week));
}

function viewSimulationWeek(week) {
    if (!currentSeason?.simulation) return;
    const sim = currentSeason.simulation;
    const targetWeek = Math.max(1, Math.min(getSeasonLength(currentSeason), Number(week) || 1));
    sim.viewingWeek = targetWeek;
    const items = getHistoryForWeek(targetWeek);

    if (items.length) {
        const latest = items[items.length - 1];
        showHistoricalSimulationEvent(latest);
    } else if (targetWeek === Number(sim.currentWeek || 1)) {
        showEvent(`Week ${targetWeek}`, "WEEK", `<p>Week ${targetWeek} is currently in progress. Choose an event from the left or press <strong>Proceed</strong> to continue.</p>`, {skipHistory:true, week:targetWeek});
    } else {
        showEvent(`Week ${targetWeek}`, "WEEK", `<p>No events have been played for Week ${targetWeek} yet.</p>`, {skipHistory:true, week:targetWeek});
    }
}

function showHistoricalSimulationEvent(item) {
    if (!item) return;
    const sim = currentSeason?.simulation;
    if (sim) sim.viewingWeek = Number(item.week || sim.currentWeek || 1);
    showEvent(item.title || item.label || "Event", item.type || "EVENT", item.content || "", {skipHistory:true, week:item.week});
}

function viewSimulationHistoryEvent(week, sequence) {
    const item = getHistoryForWeek(week).find(h => Number(h.sequence) === Number(sequence));
    if (item) showHistoricalSimulationEvent(item);
}

function renderSimulationWeekNavigation() {
    const container = document.getElementById("sim-week-navigation");
    if (!container || !currentSeason) return;
    const maxWeeks = getSeasonLength(currentSeason);
    const sim = currentSeason.simulation || createDefaultSimulation();
    const currentWeek = Number(sim.currentWeek || 1);
    const viewingWeek = Number(sim.viewingWeek || currentWeek);
    const html = [];

    for (let w = 1; w <= maxWeeks; w++) {
        const isCurrent = w === currentWeek;
        const isViewing = w === viewingWeek;
        const historyItems = getHistoryForWeek(w);
        html.push(`<div class="sim-week-block ${isCurrent ? "current" : ""} ${isViewing ? "viewing" : ""}">`);
        html.push(`<button type="button" class="sim-week-label" onclick="viewSimulationWeek(${w})">Week ${w}</button>`);

        if (isViewing) {
            html.push(`<div class="sim-event-list">`);
            if (historyItems.length) {
                historyItems.forEach(item => {
                    html.push(`<button type="button" class="sim-event-nav completed" onclick="viewSimulationHistoryEvent(${w}, ${Number(item.sequence)})"><span>${escapeHTML(item.label || item.title || "Event")}</span></button>`);
                });
            }

            if (isCurrent && !sim.pendingWeekAdvance) {
                const chain = getWeekEventChain(currentWeek);
                const active = Number(sim.currentEventIndex || 0);
                chain.slice(active).forEach((item, offset) => {
                    const state = offset === 0 ? "active" : "pending";
                    html.push(`<div class="sim-event-nav ${state}"><span>${escapeHTML(item.label)}</span></div>`);
                });
            }
            html.push(`</div>`);
        }
        html.push(`</div>`);
    }
    container.innerHTML = html.join("");
}

function recordSimulationEvent(key, title) {
    // Retained for backwards compatibility. Event snapshots are now recorded by showEvent().
}

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

    if (!Number(simulation.viewingWeek)) simulation.viewingWeek = Number(simulation.currentWeek || 1);


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

    if (simulation.currentWeek > getSeasonLength(season)) { simulation.currentWeek = getSeasonLength(season); }
    setText("current-week", simulation.currentWeek || 1);
    setText("sim-season-length", getSeasonLength(season));
    setText("sim-jury-size", season.rules?.jurySize ?? 7);
    renderSimulationWeekNavigation();
    renderDynamicGameChain();

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


function getWeekEventChain(week = currentSeason?.simulation?.currentWeek || 1) {
    const sim = currentSeason?.simulation;
    if (sim?.currentPhase === "finale" || sim?.finaleStarted) return getFinaleChain();
    const chain = [];
    getScheduledTwistsForWeek(week).forEach(t => chain.push({key:"twist", label:t.name || "Twist", twistId:t.id}));
    const hoh = getCompetitionForWeekType(week, "hoh");
    const pov = getCompetitionForWeekType(week, "pov");
    chain.push({key:"hoh", label:hoh?.name || "HOH Competition"});

    // Safety competitions happen BEFORE nominations so the winner can actually
    // be protected during the nomination ceremony, matching the normal BB flow.
    getWeekCompetitions(week)
        .filter(c => String(c.type || "").toLowerCase() === "safety")
        .forEach(c => chain.push({key:"custom-competition", label:c.name || "Safety Competition", competitionId:c.id, competitionType:"safety"}));

    // If the season-wide Safety rule is enabled but the creator did not add a
    // custom Safety competition for this week, still provide a working default.
    if (currentSeason?.rules?.safetyCompetitionEnabled === true &&
        !getWeekCompetitions(week).some(c => String(c.type || "").toLowerCase() === "safety")) {
        chain.push({key:"default-safety", label:"Safety Competition", competitionType:"safety"});
    }

    chain.push({key:"nominations", label:"Nomination Ceremony"});
    chain.push({key:"pov-players", label:"Veto Selections"});
    chain.push({key:"pov", label:pov?.name || "POV Competition"});
    chain.push({key:"veto-ceremony", label:"Veto Ceremony"});
    getWeekCompetitions(week)
        .filter(c => ["special", "luxury"].includes(String(c.type || "").toLowerCase()))
        .forEach(c => chain.push({key:"custom-competition", label:c.name || "Special Competition", competitionId:c.id, competitionType:String(c.type || "").toLowerCase()}));
    chain.push({key:"eviction-voting", label:"Eviction Voting"}, {key:"eviction", label:"Eviction"});
    return chain;
}

function saveSimulationSnapshot(item) {
    const sim = ensureFinaleState(currentSeason?.simulation);
    if (!item) return;
    if (!Array.isArray(sim.history)) sim.history = [];
    const week = Number(item.week || sim.currentWeek || 1);
    const key = `${week}|${item.event || item.label || item.title}`;
    const existing = sim.history.find(h => h.snapshotKey === key && h.content === item.content);
    if (!existing) {
        const sequence = sim.history.filter(h => Number(h.week) === week).length;
        sim.history.push({...item, sequence, snapshotKey:key, timestamp:Date.now()});
    }
    sim.weekHistory = sim.history;
}

function showEvent(title, type, content, options = {}) {
    const titleEl = document.getElementById("event-title");
    const typeEl = document.getElementById("event-type");
    const contentEl = document.getElementById("event-content");
    const sim = ensureFinaleState(currentSeason?.simulation);
    const displayWeek = Number(options.week || sim?.currentWeek || 1);
    const historyView = options.historyView === true;
    if (titleEl) titleEl.textContent = title || "Event";
    if (typeEl) typeEl.textContent = type || "EVENT";
    if (contentEl) contentEl.innerHTML = content || "";
    const weekTitle = document.getElementById("simulator-event-week-title");
    if (weekTitle) weekTitle.textContent = `Week ${displayWeek}`;
    if (sim && !historyView && options.skipLiveView !== true) {
        sim.liveView = {title:title || "Event", type:type || "EVENT", content:content || "", week:displayWeek};
    }
    if (sim && !options.skipHistory && sim.renderingEventKey) {
        saveSimulationSnapshot({week:displayWeek,event:sim.renderingEventKey,label:sim.renderingEventLabel || title,title:title || "Event",type:type || "EVENT",content:content || ""});
        sim.renderingEventKey = null;
        sim.renderingEventLabel = null;
    }
    renderSimulationWeekNavigation();
    renderMemoryWallMini();
    updateProceedButtonForViewMode();
}

function renderSimulationWeekNavigation() {
    const container = document.getElementById("sim-week-navigation");
    if (!container || !currentSeason) return;
    const sim = ensureFinaleState(currentSeason.simulation || createDefaultSimulation());
    const maxWeeks = getSeasonLength(currentSeason);
    const currentWeek = Number(sim.currentWeek || 1);
    const viewingWeek = Number(sim.viewingWeek || currentWeek);
    const html = [];
    for (let w=1; w<=maxWeeks; w++) {
        const isCurrent=w===currentWeek, isViewing=w===viewingWeek, isPast=w<currentWeek;
        const items=(sim.history||[]).filter(h=>Number(h.week)===w);
        html.push(`<div class="sim-week-block ${isCurrent?'current':''} ${isViewing?'viewing':''} ${isPast?'past':''}">`);
        html.push(`<button type="button" class="sim-week-label" data-sim-week="${w}">Week ${w}</button>`);
        if (isViewing) {
            html.push(`<div class="sim-event-list">`);
            if (items.length) items.forEach((item,i)=>html.push(`<button type="button" class="sim-event-nav completed" data-history-week="${w}" data-history-index="${i}"><span>${escapeHTML(item.label || item.title || 'Event')}</span></button>`));
            if (isCurrent && !sim.isViewingHistory && !sim.pendingWeekAdvance && !sim.pendingCycle && sim.currentPhase !== 'finale') {
                const chain=getWeekEventChain(currentWeek), active=Number(sim.currentEventIndex||0);
                chain.slice(active).forEach((item,i)=>html.push(`<div class="sim-event-nav ${i===0?'active':'pending'}"><span>${escapeHTML(item.label)}</span></div>`));
            }
            html.push(`</div>`);
        }
        html.push(`</div>`);
    }
    container.innerHTML=html.join('');
    container.querySelectorAll('[data-sim-week]').forEach(btn=>btn.addEventListener('click',()=>viewSimulationWeek(Number(btn.dataset.simWeek))));
    container.querySelectorAll('[data-history-week]').forEach(btn=>btn.addEventListener('click',()=>viewSimulationHistoryEvent(Number(btn.dataset.historyWeek),Number(btn.dataset.historyIndex))));
    updateProceedButtonForViewMode();
}

function getHistoryForWeek(week) {
    const sim=ensureFinaleState(currentSeason?.simulation);
    return (sim.history||[]).filter(item=>Number(item.week)===Number(week));
}

function viewSimulationWeek(week) {
    const sim=ensureFinaleState(currentSeason?.simulation);
    const target=Math.max(1,Math.min(getSeasonLength(currentSeason),Number(week)||1));
    sim.viewingWeek=target;
    const items=getHistoryForWeek(target);
    if (items.length) {
        sim.isViewingHistory=true;
        showHistoricalSimulationEvent(items[items.length-1]);
    } else if (target===Number(sim.currentWeek||1)) {
        returnToCurrentSimulation();
    } else {
        sim.isViewingHistory=true;
        showEvent(`Week ${target}`,"WEEK",`<button type="button" class="secondary-button sim-history-return" onclick="returnToCurrentSimulation()">Return to Current Game</button><p>Week ${target} has not been played yet.</p>`,{skipHistory:true,skipLiveView:true,historyView:true,week:target});
    }
    updateProceedButtonForViewMode();
}

function viewSimulationHistoryEvent(week, index) {
    const items=getHistoryForWeek(week);
    const item=items[Number(index)];
    if (item) showHistoricalSimulationEvent(item);
}

function showHistoricalSimulationEvent(item) {
    const sim=ensureFinaleState(currentSeason?.simulation);
    sim.viewingWeek=Number(item.week||sim.currentWeek||1);
    sim.isViewingHistory=true;
    showEvent(item.title||item.label||'Event',item.type||'EVENT',`<button type="button" class="secondary-button sim-history-return" onclick="returnToCurrentSimulation()">Return to Current Game</button>${item.content||''}`,{skipHistory:true,skipLiveView:true,historyView:true,week:item.week});
    updateProceedButtonForViewMode();
}

function returnToCurrentSimulation() {
    const sim=ensureFinaleState(currentSeason?.simulation);
    sim.isViewingHistory=false;
    sim.viewingWeek=Number(sim.currentWeek||1);
    const live=sim.liveView;
    if(live) showEvent(live.title,live.type,live.content,{skipHistory:true,skipLiveView:true,week:live.week});
    else showEvent(`Week ${sim.currentWeek}`,'WEEK',`<p>Week ${sim.currentWeek} is currently in progress.</p>`,{skipHistory:true,skipLiveView:true,week:sim.currentWeek});
    updateProceedButtonForViewMode();
}

function updateProceedButtonForViewMode() {
    const btn=document.querySelector('.sim-proceed-button');
    const sim=currentSeason?.simulation;
    if(btn) btn.textContent=sim?.isViewingHistory?'Return to Current Game':'Proceed';
}

function runNextEvent() {
    if (!currentSeason) { alert('Please open a saved season first.'); return; }
    const sim=ensureFinaleState(currentSeason.simulation || (currentSeason.simulation=createDefaultSimulation()));
    if (sim.isViewingHistory) { returnToCurrentSimulation(); return; }

    if (sim.pendingWeekAdvance) {
        const next=Number(sim.currentWeek||1)+1;
        if(next>getSeasonLength(currentSeason)){ beginFinale(); return; }
        sim.currentWeek=next; sim.viewingWeek=next; sim.pendingWeekAdvance=false; sim.evictionsThisWeek=0;
        sim.currentEventIndex=0; sim.currentHOH=null; sim.currentNominees=[]; sim.currentPOVPlayers=[]; sim.currentPOVWinner=null; sim.currentEviction=null; sim.pendingEvictionId=null; sim.evictionVoteResult=null;
        sim.currentPhase='week';
        setText('current-week',next); updateSimulatorStatus(sim); resetGameChain(0);
        showEvent(`Week ${next}`,'WEEK',`<p>Week ${next} is now beginning.</p>`,{skipHistory:true,week:next});
        persistCurrentSeason(); return;
    }

    if (sim.currentPhase==='finale' || sim.finaleStarted) {
        const chain=getFinaleChain(), index=Number(sim.currentEventIndex||0), event=chain[index];
        if(!event){ beginFinale(); return; }
        sim.renderingEventKey=event.key; sim.renderingEventLabel=event.label;
        if(event.key==='final-hoh') runFinalHOHEvent();
        else if(event.key==='jury-voting') runJuryVotingEvent();
        else if(event.key==='finale-results') runFinaleResultsEvent();
        persistCurrentSeason(); return;
    }

    const chain=getWeekEventChain(sim.currentWeek), index=Number(sim.currentEventIndex||0), event=chain[index];
    if(!event){ sim.pendingWeekAdvance=true; runNextEvent(); return; }
    sim.renderingEventKey=event.key; sim.renderingEventLabel=event.label;
    switch(event.key){
        case 'twist': runTwistEvent(event.twistId); break;
        case 'hoh': runHOHEvent(); break;
        case 'nominations': runNominationEvent(); break;
        case 'pov-players': runPOVPlayersEvent(); break;
        case 'pov': runPOVEvent(); break;
        case 'veto-ceremony': runVetoCeremonyEvent(); break;
        case 'custom-competition': runCustomCompetitionEvent(event.competitionId); break;
        case 'eviction-voting': runEvictionVotingEvent(); break;
        case 'eviction': runEvictionEvent(); break;
        default: sim.currentEventIndex++; break;
    }
    persistCurrentSeason(); renderSimulationWeekNavigation();
}

function runTwistEvent(twistId) {
    const sim=ensureFinaleState(currentSeason.simulation), twist=(currentSeason.twists||[]).find(t=>t.id===twistId);
    sim.currentEventIndex++;
    if(!twist){ showEvent('Twist','TWIST','<p>No twist information is available.</p>'); return; }
    let holder=null;
    const effect=twist.effectType||'display';
    if(effect!=='display') {
        const active=getActiveHouseguests();
        holder=active[Math.floor(Math.random()*active.length)] || null;
        if(holder){ sim.twistState[twist.id]={holderId:holder.id,used:false,awardedWeek:sim.currentWeek}; }
    }
    const powerLine=twist.power?`<p><strong>Power:</strong> ${escapeHTML(twist.power)}${twist.powerUntil?` (usable through Week ${twist.powerUntil})`:''}</p>`:'';
    showEvent(twist.name||'Twist','TWIST',`<div class="twist-event-card"><h3>${escapeHTML(twist.name||'Twist')}</h3>${powerLine}${holder?`${simulationPortrait(holder,'large')}<p><strong>${escapeHTML(getHouseguestDisplayName(holder.id,currentSeason.houseguests))}</strong> received the power.</p>`:''}<p>${escapeHTML(twist.description||'')}</p></div>`);
    resetGameChain(sim.currentEventIndex);
}

function beginFinale() {
    const sim=ensureFinaleState(currentSeason.simulation);
    sim.finaleStarted=true; sim.currentPhase='finale'; sim.currentEventIndex=0; sim.viewingWeek=getSeasonLength(currentSeason);
    const active=getActiveHouseguests();
    sim.finalists=active.map(p=>p.id);
    sim.jury=getJuryMembers();
    resetGameChain(0);
    showEvent('Finale','FINALE',`<p>The regular season is complete.</p>${simulationPortraits(active.map(p=>p.id),'large')}<p><strong>${active.length} finalists remain.</strong> Press <strong>Proceed</strong> to continue to the finale.</p>`,{week:getSeasonLength(currentSeason)});
    persistCurrentSeason();
}

function runFinalHOHEvent() {
    const sim=ensureFinaleState(currentSeason.simulation), finalists=getFinalistsForFinale();
    if(finalists.length<3){ sim.currentEventIndex++; resetGameChain(sim.currentEventIndex); showEvent('Final HOH','FINAL HOH',`<p>There are only two finalists, so the Final HOH competition is skipped.</p>`); return; }
    const comp=(currentSeason.competitions?.finalHoh||[])[0] || null;
    const winner=comp?chooseCompetitionWinnerByCustom(finalists,comp):chooseCompetitionWinner(finalists,'mental','social','general');
    sim.finalHOH=winner.id; sim.currentEventIndex++;
    resetGameChain(sim.currentEventIndex);
    showEvent(comp?.name||'Final HOH','FINAL HOH',`${simulationPortrait(winner,'large')}<p><strong>${escapeHTML(getHouseguestDisplayName(winner.id,currentSeason.houseguests))}</strong> has won <strong>${escapeHTML(comp?.name||'Final HOH')}</strong>.</p><p>The Final HOH will determine the final two.</p>`);
}

function runJuryVotingEvent() {
    const sim=ensureFinaleState(currentSeason.simulation);
    let finalists=getFinalistsForFinale();
    if(finalists.length>2){
        const finalHOH=getHouseguestForSimulation(sim.finalHOH) || finalists[0];
        const eligible=finalists.filter(p=>p.id!==finalHOH.id);
        // Final HOH chooses the other finalist; for simulation purposes choose the strongest social bond.
        const chosen=eligible.sort((a,b)=>allianceBond(finalHOH.id,b.id)-allianceBond(finalHOH.id,a.id))[0] || eligible[0];
        const third=eligible.find(p=>p.id!==chosen.id);
        if(third){ third.status='evicted'; third.placement=3; }
        finalists=[finalHOH,chosen].filter(Boolean);
        sim.finalists=finalists.map(p=>p.id);
    }
    if (!Array.isArray(sim.jury) || sim.jury.length === 0) sim.jury=getJuryMembers();
    const votes=[];
    sim.jury.forEach(jid=>{
        const juror=getHouseguestForSimulation(jid); if(!juror) return;
        const scored=finalists.map(f=>({f,score:Number(f.ratings?.social||0)*0.4+Number(f.ratings?.strategic||0)*0.35+Number(f.ratings?.general||0)*0.15+Number(f.ratings?.mental||0)*0.1+allianceBond(jid,f.id)*0.15+Math.random()*3})).sort((a,b)=>b.score-a.score);
        votes.push({juror:jid,vote:scored[0]?.f.id||finalists[0]?.id});
    });
    const counts={}; finalists.forEach(f=>counts[f.id]=0); votes.forEach(v=>counts[v.vote]=(counts[v.vote]||0)+1);
    sim.juryVotes=votes; sim.finaleVoteResults={votes,counts}; sim.currentEventIndex++;
    resetGameChain(sim.currentEventIndex);
    const rows=votes.map(v=>`<div class="jury-vote-row">${simulationPortrait(getHouseguestForSimulation(v.juror),'small')}<strong>${escapeHTML(getHouseguestDisplayName(v.juror,currentSeason.houseguests))}</strong><span>votes for</span><strong>${escapeHTML(getHouseguestDisplayName(v.vote,currentSeason.houseguests))}</strong></div>`).join('');
    showEvent('Jury Voting','JURY VOTING',`<div class="jury-finalists">${simulationPortraits(finalists.map(p=>p.id),'large')}</div><h3>The Jury Votes</h3><div class="jury-vote-list">${rows||'<p>No jury members were eligible to vote.</p>'}</div>`);
}

function runFinaleResultsEvent() {
    const sim=ensureFinaleState(currentSeason.simulation), finalists=(sim.finalists||[]).map(getHouseguestForSimulation).filter(Boolean), counts=sim.finaleVoteResults?.counts||{};
    const ranked=finalists.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
    const winner=ranked[0], runner=ranked[1];
    sim.winner=winner?.id||null; sim.runnerUp=runner?.id||null; sim.completed=true;
    if(winner) { winner.status='winner'; winner.placement=1; }
    if(runner) { runner.status='runner-up'; runner.placement=2; }
    const other=(currentSeason.houseguests||[]).filter(p=>p.status==='evicted').sort((a,b)=>Number(b.placement||0)-Number(a.placement||0));
    sim.finalPlacements=[...(winner?[{id:winner.id,name:getHouseguestDisplayName(winner.id,currentSeason.houseguests),placement:1}]:[]),...(runner?[{id:runner.id,name:getHouseguestDisplayName(runner.id,currentSeason.houseguests),placement:2}]:[]),...other.map(p=>({id:p.id,name:getHouseguestDisplayName(p.id,currentSeason.houseguests),placement:Number(p.placement||0)})).sort((a,b)=>a.placement-b.placement)];
    sim.currentEventIndex=0;
    persistCurrentSeason();
    showEvent('Final Results','FINAL RESULTS',`<div class="final-results-cards">${winner?`${simulationPortrait(winner,'large')}<h2>${escapeHTML(getHouseguestDisplayName(winner.id,currentSeason.houseguests))}</h2><p class="final-winner-label">WINNER — ${counts[winner.id]||0} JURY VOTES</p>`:''}${runner?`${simulationPortrait(runner,'large')}<p class="final-runner-label">RUNNER-UP — ${counts[runner.id]||0} JURY VOTES</p>`:''}</div><div class="final-jury-tally">${finalists.map(f=>`<div><strong>${escapeHTML(getHouseguestDisplayName(f.id,currentSeason.houseguests))}</strong><span>${counts[f.id]||0} vote${(counts[f.id]||0)===1?'':'s'}</span></div>`).join('')}</div><button type="button" class="primary-button" onclick="showResults()">View Full Results</button>`);
}

function finalizeSeason(finalists) {
    // Finale is now an explicit event sequence. Do not jump straight to the results page.
    const sim=ensureFinaleState(currentSeason.simulation);
    if(sim.completed) return;
    const active=finalists?.length?finalists:getActiveHouseguests();
    sim.finalists=active.map(p=>p.id); sim.jury=getJuryMembers(); sim.finaleStarted=true; sim.currentPhase='finale'; sim.currentEventIndex=0; sim.viewingWeek=getSeasonLength(currentSeason);
    renderSimulationWeekNavigation();
    showEvent('Finale','FINALE',`<p>The final houseguests have reached the finale.</p>${simulationPortraits(active.map(p=>p.id),'large')}<p>Press <strong>Proceed</strong> to begin the finale.</p>`,{week:getSeasonLength(currentSeason)});
    persistCurrentSeason();
}

function showResults() {
    if(!currentSeason) return;
    setText('results-season-name',currentSeason.name||'Big Brother');
    const sim=ensureFinaleState(currentSeason.simulation);
    const winner=getHouseguestForSimulation(sim.winner) || (currentSeason.houseguests||[]).find(p=>p.name===sim.winner);
    setText('winner-name',winner?getHouseguestDisplayName(winner.id,currentSeason.houseguests):'—');
    const runner=getHouseguestForSimulation(sim.runnerUp) || (currentSeason.houseguests||[]).find(p=>p.name===sim.runnerUp);
    let runnerEl=document.getElementById('runner-up-name'); if(runnerEl) runnerEl.textContent=runner?getHouseguestDisplayName(runner.id,currentSeason.houseguests):'—';
    renderFinalPlacements(); renderSeasonStatistics(); renderFinalJuryResults(); showPage('results-page');
}

function renderFinalJuryResults() {
    const c=document.getElementById('final-jury-results'); if(!c) return;
    const sim=ensureFinaleState(currentSeason?.simulation), results=sim.finaleVoteResults;
    if(!results){c.innerHTML='<div class="empty-state"><p>No jury vote has been completed yet.</p></div>';return;}
    const rows=(results.votes||[]).map(v=>`<div class="final-jury-row"><span>${escapeHTML(getHouseguestDisplayName(v.juror,currentSeason.houseguests))}</span><strong>→</strong><span>${escapeHTML(getHouseguestDisplayName(v.vote,currentSeason.houseguests))}</span></div>`).join('');
    const tally=Object.entries(results.counts||{}).map(([id,n])=>`<div class="final-jury-tally-row"><span>${escapeHTML(getHouseguestDisplayName(id,currentSeason.houseguests))}</span><strong>${n}</strong></div>`).join('');
    c.innerHTML=`<div class="final-jury-tally">${tally}</div><h3>Individual Jury Votes</h3><div class="final-jury-votes">${rows}</div>`;
}


/* =========================================================
   RE-SIMULATE SEASON — ROBUST FINAL IMPLEMENTATION
   Preserves the season definition and creates a completely fresh
   simulation runtime. Exposed explicitly on window so inline HTML
   buttons always resolve it on GitHub Pages.
   ========================================================= */
function resimulateSeason() {
    try {
        // If the current season disappeared from memory, recover the most
        // recently saved season. This makes the results-page button resilient
        // after navigation/reload.
        if (!currentSeason) {
            if (Array.isArray(savedSeasons) && savedSeasons.length) {
                currentSeason = savedSeasons[savedSeasons.length - 1];
            }
        }

        if (!currentSeason) {
            alert("There is no season available to re-simulate. Please load a season first.");
            return false;
        }

        const season = currentSeason;
        if (!Array.isArray(season.houseguests) || season.houseguests.length < 2) {
            alert("At least two houseguests are required to re-simulate the season.");
            return false;
        }

        // Do NOT call startNewSeason(), resetGame(), RESET, or any setup
        // routine here. Those routines can wipe the user's season definition.
        // We only reset fields that belong to the completed simulation.
        const preservedGuests = season.houseguests.map(player => {
            const copy = deepClone(player);

            // Runtime/player result fields.
            copy.status = "active";
            copy.placement = null;
            copy.hohWins = 0;
            copy.povWins = 0;
            copy.safetyWins = 0;
            copy.luxuryWins = 0;
            copy.finalHohWins = 0;
            copy.evictionVotes = 0;
            copy.nominationCount = 0;
            copy.vetoCount = 0;
            copy.juryVotes = 0;

            // Remove common transient flags if an earlier simulation created them.
            delete copy.isJury;
            delete copy.juryStatus;
            delete copy.eliminated;
            delete copy.evicted;
            delete copy.winner;
            delete copy.runnerUp;

            return copy;
        });

        // Preserve every season-configuration object by reference/value and
        // replace ONLY the simulation object.
        season.houseguests = preservedGuests;
        const freshSimulation = createDefaultSimulation();
        season.simulation = ensureFinaleState(freshSimulation);

        const sim = season.simulation;
        sim.started = true;
        sim.completed = false;
        sim.currentWeek = 1;
        sim.viewingWeek = 1;
        sim.currentPhase = "week";
        sim.currentEventIndex = 0;
        sim.currentHOH = null;
        sim.currentNominees = [];
        sim.currentPOVPlayers = [];
        sim.currentPOVWinner = null;
        sim.currentSafetyWinner = null;
        sim.currentEviction = null;
        sim.pendingEvictionId = null;
        sim.evictionVoteResult = null;
        sim.evictionsThisWeek = 0;
        sim.pendingWeekAdvance = false;
        sim.finaleStarted = false;
        sim.finalists = [];
        sim.jury = [];
        sim.juryVotes = [];
        sim.finaleVoteResults = null;
        sim.finalPlacements = [];
        sim.winner = null;
        sim.runnerUp = null;
        sim.history = [];
        sim.twistState = {};
        sim.vetoDrawCounts = {};
        sim.lastVetoDrawnIds = [];
        sim.isViewingHistory = false;
        sim.liveView = null;
        sim.pendingCycle = null;

        currentSeason = season;
        persistCurrentSeason();

        // Refresh all simulation UI.
        setText("current-week", "1");
        setText("simulator-season-name", season.name || "Big Brother");
        setText("simulator-season-theme", season.theme || "Custom Season");
        setText("sim-season-length", getSeasonLength(season));
        setText("sim-jury-size", season.rules?.jurySize ?? 7);
        updateSimulatorStatus(sim);
        renderSimulationWeekNavigation();
        renderMemoryWallMini();
        resetGameChain(0);
        showPage("simulator-page");

        // Show the restart state without adding a fake historical event.
        showEvent(
            "Week 1",
            "NEW SIMULATION",
            `<p>The season setup has been preserved.</p><p>Press <strong>Proceed</strong> to begin a new randomized simulation.</p>`,
            {skipHistory: true, skipLiveView: true, week: 1}
        );
        updateProceedButtonForViewMode();

        return true;
    } catch (error) {
        console.error("RE-SIMULATE SEASON ERROR:", error);
        alert("The season could not be re-simulated. Please refresh the page and try again.");
        return false;
    }
}

// Explicit global exports are intentional: the simulator uses inline onclick
// handlers in index.html, and this guarantees the function is available there.
window.resimulateSeason = resimulateSeason;
window.showResults = showResults;

/* =========================================================
   CLEAN SIMULATION ENGINE v1
   Single authoritative state machine.  This intentionally overrides the
   older event functions above so the editor/configuration code can remain
   backward-compatible while simulation state has one owner.
   ========================================================= */
(function installCleanSimulationEngine(){
    function sim(){
        if (!currentSeason) return null;
        currentSeason.simulation = ensureFinaleState(currentSeason.simulation || createDefaultSimulation());
        return currentSeason.simulation;
    }

    function active(){ return getActiveHouseguests(); }
    function name(id){ return getHouseguestDisplayName(id, currentSeason?.houseguests || []); }
    function player(id){ return getHouseguestForSimulation(id); }
    function isDoubleWeek(week){
        return currentSeason?.rules?.doubleEvictionEnabled === true &&
            (currentSeason.rules.doubleEvictionWeeks || []).map(Number).includes(Number(week));
    }

    function resetCycle(s, week, cycle){
        if (week != null) s.currentWeek = Number(week);
        s.cycle = Number(cycle || 1);
        s.evictionsThisWeek = Number(s.evictionsThisWeek || 0);
        s.currentEventIndex = 0;
        s.currentHOH = null;
        s.currentNominees = [];
        s.currentPOVPlayers = [];
        s.currentPOVWinner = null;
        s.currentSafetyWinner = null;
        s.currentEviction = null;
        s.pendingEvictionId = null;
        s.evictionVoteResult = null;
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;
        s.viewingWeek = Number(s.currentWeek || 1);
        s.isViewingHistory = false;
        s.currentPhase = "week";
    }

    function cycleChain(s){
        const week = Number(s.currentWeek || 1);
        const chain = [];
        // Twists are awarded once at the beginning of the week's first cycle.
        if (Number(s.cycle || 1) === 1) {
            getScheduledTwistsForWeek(week).forEach(t => chain.push({key:"twist", label:t.name || "Twist", twistId:t.id}));
        }
        const hoh = getCompetitionForWeekType(week, "hoh");
        const pov = getCompetitionForWeekType(week, "pov");
        chain.push({key:"hoh", label:hoh?.name || "HOH Competition"});
        chain.push({key:"nominations", label:"Nomination Ceremony"});
        chain.push({key:"pov-players", label:"Veto Selections"});
        chain.push({key:"pov", label:pov?.name || "Power of Veto"});
        chain.push({key:"veto-ceremony", label:"Veto Ceremony"});

        // Special/safety/luxury competitions run once per week, before voting.
        if (Number(s.cycle || 1) === 1) {
            getWeekCompetitions(week)
                .filter(c => ["special","safety","luxury"].includes(String(c.type || "").toLowerCase()))
                .forEach(c => chain.push({key:"custom-competition", label:c.name || "Special Competition", competitionId:c.id}));
        }
        chain.push({key:"eviction-voting", label:"Eviction Voting"});
        chain.push({key:"eviction", label:"Eviction"});
        return chain;
    }

    function finalChain(){
        const s=sim();
        const finalists=(s?.finalists||[]).map(player).filter(Boolean);
        const chain=[];
        if (finalists.length >= 3) chain.push({key:"final-hoh",label:"Final HOH"});
        chain.push({key:"jury-voting",label:"Jury Voting"},{key:"finale-results",label:"Final Results"});
        return chain;
    }

    function record(s, event, title, type, content, week){
        if (!Array.isArray(s.history)) s.history=[];
        const w=Number(week ?? s.currentWeek ?? 1);
        const cycle=Number(s.cycle || 1);
        const sequence=s.history.length;
        s.history.push({
            week:w, cycle, event, label:eventLabel(event,title), title, type,
            content, sequence, timestamp:Date.now()
        });
        s.weekHistory=s.history;
    }
    function eventLabel(event,title){
        const map={"twist":"Twist","hoh":"HOH Competition","nominations":"Nomination Ceremony","pov-players":"Veto Selections","pov":"POV Competition","veto-ceremony":"Veto Ceremony","custom-competition":"Special Competition","eviction-voting":"Eviction Voting","eviction":"Eviction","final-hoh":"Final HOH","jury-voting":"Jury Voting","finale-results":"Final Results"};
        return map[event] || title || "Event";
    }
    function display(s,title,type,content,event,opts={}){
        showEvent(title,type,content,{skipHistory:true,skipLiveView:false,week:Number(opts.week ?? s.currentWeek ?? 1)});
        record(s,event,title,type,content,Number(opts.week ?? s.currentWeek ?? 1));
        s.liveView={title,type,content,week:Number(opts.week ?? s.currentWeek ?? 1)};
        s.currentEventIndex=Number(s.currentEventIndex || 0)+1;
        updateSimulatorStatus(s);
        renderSimulationWeekNavigation();
        renderMemoryWallMini();
        persistCurrentSeason();
    }

    function chooseWinner(players, comp, fallbackPrimary, fallbackSecondary){
        if (!players.length) return null;
        if (comp) return chooseCompetitionWinnerByCustom(players,comp);
        return chooseCompetitionWinner(players,fallbackPrimary,fallbackSecondary,"general");
    }

    function runCleanTwist(twistId){
        const s=sim(), t=(currentSeason.twists||[]).find(x=>x.id===twistId);
        if(!t){ display(s,"Twist","TWIST","<p>No twist information is available.</p>","twist"); return; }
        const effect=t.effectType||"display";
        let holder=null;
        if(effect!=="display"){
            const pool=active(); holder=pool[Math.floor(Math.random()*pool.length)]||null;
            if(holder) s.twistState[t.id]={holderId:holder.id,used:false,awardedWeek:s.currentWeek};
        }
        const content=`<div class="twist-event-card"><h3>${escapeHTML(t.name||"Twist")}</h3>${t.power?`<p><strong>Power:</strong> ${escapeHTML(t.power)}${t.powerUntil?` (usable through Week ${t.powerUntil})`:""}</p>`:""}${holder?`${simulationPortrait(holder,"large")}<p><strong>${escapeHTML(name(holder.id))}</strong> received the power.</p>`:""}<p>${escapeHTML(t.description||"")}</p></div>`;
        display(s,t.name||"Twist","TWIST",content,"twist");
    }

    function runCleanHOH(){
        const s=sim(), pool=active();
        if(!pool.length) return;
        let winner=null;
        if(Number(s.currentWeek)===1 && currentSeason.rules?.startingHOH==="specific" && currentSeason.rules?.specificStartingHOH)
            winner=pool.find(p=>p.id===currentSeason.rules.specificStartingHOH)||null;
        const comp=getCompetitionForWeekType(s.currentWeek,"hoh");
        winner=winner||chooseWinner(pool,comp,"physical","mental");
        if(!winner) return;
        s.currentHOH=winner.id; winner.hohWins=Number(winner.hohWins||0)+1;
        const content=`${simulationPortrait(winner,"large")}<p><strong>${escapeHTML(name(winner.id))}</strong> has won <strong>${escapeHTML(comp?.name||"Head of Household")}</strong>.</p>${comp?.description?`<p class="event-description">${escapeHTML(comp.description)}</p>`:""}`;
        display(s,comp?.name||"Head of Household","HOH COMPETITION",content,"hoh");
    }

    function runCleanNominations(){
        const s=sim(), pool=active().filter(p=>p.id!==s.currentHOH);
        let protectedIds=new Set();
        getUsableTwistStates(s.currentWeek,"immunity").forEach(x=>protectedIds.add(x.state.holderId));
        // A Safety Competition winner is immune from the nomination ceremony.
        if (s.currentSafetyWinner) protectedIds.add(s.currentSafetyWinner);
        const eligible=pool.filter(p=>!protectedIds.has(p.id));
        let noms=[];
        const hoh=player(s.currentHOH);
        const ordered=eligible.slice().sort((a,b)=>allianceBond(s.currentHOH,b.id)-allianceBond(s.currentHOH,a.id));
        // Lower bond = more likely target, with a small random component.
        const ranked=ordered.sort((a,b)=>(allianceBond(s.currentHOH,a.id)+Math.random()*12)-(allianceBond(s.currentHOH,b.id)+Math.random()*12));
        noms=ranked.slice(0,Math.min(2,ranked.length)).map(p=>p.id);
        // Nomination Void cancels the initial pair and forces replacements.
        const voidPower=getUsableTwistStates(s.currentWeek,"nominationVoid").find(x=>noms.includes(x.state.holderId));
        if(voidPower){
            voidPower.state.used=true;
            const replacementPool=eligible.filter(p=>!noms.includes(p.id));
            noms=replacementPool.sort((a,b)=>Math.random()-.5).slice(0,2).map(p=>p.id);
        }
        s.currentNominees=noms;
        const nomineeText=noms.map(id=>`<div class="nominee-card">${simulationPortrait(player(id),"large")}<strong>${escapeHTML(name(id))}</strong></div>`).join("");
        const note=voidPower?`<p><strong>${escapeHTML(voidPower.twist.name)}</strong> was activated, so the original nominations were voided and replacement nominees were selected.</p>`:"";
        display(s,"Nomination Ceremony","NOMINATION CEREMONY",`<div class="nomination-result">${simulationPortrait(hoh,"large")}<p><strong>${escapeHTML(name(s.currentHOH))}</strong> has nominated:</p><div class="nominee-grid">${nomineeText}</div>${note}</div>`,"nominations");
    }

    function runCleanPOVPlayers(){
        const s=sim();
        if(currentSeason.rules?.vetoEnabled===false){s.currentPOVPlayers=[];display(s,"Power of Veto Disabled","VETO SELECTIONS","<p>The Power of Veto is disabled for this season.</p>","pov-players");return;}
        const pool=active(), count=Math.min(Number(currentSeason.rules?.vetoPlayers||6),pool.length);
        const selected=chooseVetoPlayers(pool,s.currentHOH,s.currentNominees,count);
        s.currentPOVPlayers=selected.map(p=>p.id);
        display(s,"Power of Veto Players","VETO SELECTIONS",`<p>The following houseguests will compete:</p>${simulationPortraits(s.currentPOVPlayers,"medium")}<p><strong>${escapeHTML(selected.map(p=>name(p.id)).join(", "))}</strong></p>`,"pov-players");
    }

    function runCleanPOV(){
        const s=sim();
        if(currentSeason.rules?.vetoEnabled===false){s.currentPOVWinner=null;display(s,"Power of Veto Disabled","POV RESULTS","<p>The Power of Veto is disabled for this season.</p>","pov");return;}
        const players=s.currentPOVPlayers.map(player).filter(Boolean);
        const comp=chooseCustomCompetition("pov") || getCompetitionForWeekType(s.currentWeek,"pov");
        const winner=chooseWinner(players,comp,"physical","mental");
        s.currentPOVWinner=winner?.id||null;
        if(winner) winner.povWins=Number(winner.povWins||0)+1;
        display(s,comp?.name||"Power of Veto","POV RESULTS",winner?`${simulationPortrait(winner,"large")}<p><strong>${escapeHTML(name(winner.id))}</strong> has won <strong>${escapeHTML(comp?.name||"the Power of Veto")}</strong>.</p>${comp?.description?`<p class="event-description">${escapeHTML(comp.description)}</p>`:""}`:"<p>No eligible Power of Veto winner was available.</p>","pov");
    }

    function runCleanVeto(){
        const s=sim(), veto=s.currentPOVWinner, original=[...(s.currentNominees||[])];
        if(currentSeason.rules?.vetoEnabled===false){display(s,"Veto Ceremony","VETO CEREMONY","<p>The Power of Veto is disabled for this season.</p>","veto-ceremony");return;}
        let used=false,replacement=null,note="";
        if(veto && original.includes(veto)){
            const pool=active().filter(p=>p.id!==s.currentHOH&&!original.includes(p.id));
            if(pool.length){
                const diamond=getUsableTwistStates(s.currentWeek,"diamondPOV").find(x=>x.state.holderId===veto);
                replacement=diamond?pool.slice().sort((a,b)=>allianceBond(veto,a.id)-allianceBond(veto,b.id))[0]:randomItem(pool);
                if(diamond){diamond.state.used=true;note=`<p><strong>${escapeHTML(diamond.twist.name)}</strong> upgraded the veto to a Diamond Power of Veto, allowing the veto holder to choose the replacement.</p>`;}
                const idx=s.currentNominees.indexOf(veto); if(idx>=0&&replacement){s.currentNominees[idx]=replacement.id;used=true;}
            }
        }
        const nominees=s.currentNominees.map(player).filter(Boolean);
        let statement="No Power of Veto holder was available.";
        if(veto){
            statement=used ? `<strong>${escapeHTML(name(veto))}</strong> used the Power of Veto.${replacement ? ` <strong>${escapeHTML(name(replacement.id))}</strong> is the replacement nominee.` : ""}` : `<strong>${escapeHTML(name(veto))}</strong> did not use the Power of Veto.`;
        }
        const content=`<div class="ceremony-leaders"><div class="ceremony-role-section"><h3>Head of Household</h3>${simulationPortrait(player(s.currentHOH),"large")}</div><div class="ceremony-role-section"><h3>Power of Veto Holder</h3>${simulationPortrait(player(veto),"large")}</div></div>${note}<p class="ceremony-statement">${statement}</p><div class="ceremony-role-section"><h3>Final Nominees</h3>${simulationPortraits(nominees.map(p=>p.id),"large")}</div>`;
        display(s,"Veto Ceremony","VETO CEREMONY",content,"veto-ceremony");
    }

    function runCleanDefaultSafety(){
        const s=sim(), players=active().filter(p=>p.id!==s.currentHOH);
        if(!players.length){display(s,"Safety Competition","SAFETY COMPETITION","<p>No eligible players were available.</p>","custom-competition");return;}
        const winner=chooseWinner(players,null,"physical","mental");
        s.currentSafetyWinner=winner?.id||null;
        if(winner) winner.safetyWins=Number(winner.safetyWins||0)+1;
        display(s,"Safety Competition","SAFETY COMPETITION",winner?`${simulationPortrait(winner,"large")}<p><strong>${escapeHTML(name(winner.id))}</strong> has won the <strong>Safety Competition</strong> and is safe from the nomination ceremony.</p>`:"<p>No winner was available.</p>","custom-competition");
    }

    function runCleanSpecial(compId){
        const s=sim(), players=active(), comp=getWeekCompetitions(s.currentWeek).find(c=>c.id===compId);
        if(!comp||!players.length){display(s,"Special Competition","SPECIAL COMPETITION","<p>No eligible players were available.</p>","custom-competition");return;}
        const winner=chooseWinner(players.filter(p=>p.id!==s.currentHOH),comp,"physical","mental");
        if(winner && String(comp.type).toLowerCase()==="safety") {
            winner.safetyWins=Number(winner.safetyWins||0)+1;
            s.currentSafetyWinner=winner.id;
        }
        display(s,comp.name||"Special Competition","SPECIAL COMPETITION",`${winner?simulationPortrait(winner,"large"):""}<p>${winner?`<strong>${escapeHTML(name(winner.id))}</strong> has won <strong>${escapeHTML(comp.name||"the competition")}</strong>.`:"No winner was available."}</p>${comp.description?`<p>${escapeHTML(comp.description)}</p>`:""}`,"custom-competition");
    }

    function runCleanEvictionVoting(){
        const s=sim(), pool=active(), nominees=s.currentNominees.map(player).filter(Boolean);
        if(nominees.length<2){s.pendingEvictionId=nominees[0]?.id||null;display(s,"Eviction Voting","EVICTION VOTING","<p>There are not enough nominees for a standard eviction vote.</p>","eviction-voting");return;}
        const voters=pool.filter(p=>p.id!==s.currentHOH&&!s.currentNominees.includes(p.id));
        const votes=[];
        voters.forEach(v=>{
            const ranked=nominees.map(t=>({t,score:(10-allianceBond(v.id,t.id))+Math.random()*5})).sort((a,b)=>b.score-a.score);
            votes.push({voter:v.id,target:ranked[0].t.id});
        });
        const counts={};nominees.forEach(n=>counts[n.id]=0);votes.forEach(v=>counts[v.target]=(counts[v.target]||0)+1);
        let target=nominees.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0))[0];
        s.pendingEvictionId=target.id;s.evictionVoteResult={target:target.id,targetVotes:counts[target.id]||0,counts,votes,totalVotes:votes.length};
        const rows=votes.map(v=>`<div class="vote-row"><span>${escapeHTML(name(v.voter))}</span><strong>votes to evict</strong><span>${escapeHTML(name(v.target))}</span></div>`).join("");
        display(s,"Eviction Voting","EVICTION VOTING",`<div class="eviction-vote-result">${simulationPortrait(target,"large")}<h3>${escapeHTML(name(target.id))} is currently set to be evicted.</h3><p>${escapeHTML(name(target.id))}: <strong>${counts[target.id]||0}</strong> votes</p>${nominees.filter(n=>n.id!==target.id).map(n=>`<p>${escapeHTML(name(n.id))}: <strong>${counts[n.id]||0}</strong> votes</p>`).join("")}</div><div class="live-vote-list"><h3>Live Vote</h3>${rows||"<p>No eligible voters.</p>"}</div>` ,"eviction-voting");
    }

    function runCleanEviction(){
        const s=sim(), week=Number(s.currentWeek), nominees=s.currentNominees||[], hex=getUsableTwistStates(week,"haltingHex").find(x=>nominees.includes(x.state.holderId));
        if(hex){
            hex.state.used=true;s.pendingEvictionId=null;s.evictionVoteResult=null;
            const content=`${simulationPortrait(player(hex.state.holderId),"large")}<p><strong>${escapeHTML(hex.twist.name)}</strong> has been used. The Week ${week} eviction is cancelled.</p>`;
            display(s,"Halting Hex","EVICTION HALTED",content,"eviction");
            finishCycleAfterEviction(false);
            return;
        }
        const before=active().length;
        const target=player(s.pendingEvictionId) || nominees.map(player).filter(Boolean)[0];
        if(!target){display(s,"Eviction","EVICTION","<p>No houseguest could be evicted.</p>","eviction");finishCycleAfterEviction(false);return;}
        target.status="evicted";target.placement=before;s.currentEviction=target.id;
        s.evictionsThisWeek=Number(s.evictionsThisWeek||0)+1;
        const votes=s.evictionVoteResult?.targetVotes ?? 0;
        display(s,"Eviction","EVICTION",`${simulationPortrait(target,"large")}<p><strong>${escapeHTML(name(target.id))}</strong> has been evicted from the Big Brother house.</p>${s.evictionVoteResult?`<p>Final vote: <strong>${votes}</strong> vote(s) to evict.</p>`:""}`,"eviction");
        finishCycleAfterEviction(true);
    }

    function finishCycleAfterEviction(evicted){
        const s=sim(), week=Number(s.currentWeek), remaining=active();
        s.currentNominees=[];s.currentPOVPlayers=[];s.currentPOVWinner=null;s.pendingEvictionId=null;s.evictionVoteResult=null;
        if(remaining.length<=2){beginCleanFinale();return;}
        if(isDoubleWeek(week) && Number(s.evictionsThisWeek)<2 && remaining.length>2){
            s.pendingCycle="double";s.cycle=2;s.currentEventIndex=0;s.currentHOH=null;s.currentNominees=[];s.currentPOVPlayers=[];s.currentPOVWinner=null;
            showEvent("Double Eviction","DOUBLE EVICTION",`<p>${evicted?"The first eviction is complete.":"The eviction was halted."}</p><p>There will be an <strong>immediate Head of Household competition</strong>. This is still <strong>Week ${week}</strong>.</p>`,{skipHistory:true,week});
            record(s,"double-transition","Double Eviction","DOUBLE EVICTION",document.getElementById("event-content")?.innerHTML||"",week);
            s.liveView={title:"Double Eviction",type:"DOUBLE EVICTION",content:document.getElementById("event-content")?.innerHTML||"",week};
            persistCurrentSeason();renderSimulationWeekNavigation();return;
        }
        if(week>=getSeasonLength(currentSeason)){beginCleanFinale();return;}
        s.pendingWeekAdvance=true;s.pendingCycle="nextWeek";
        showEvent("Week Complete","WEEK",`<p>Week ${week} is complete.</p><p>Press <strong>Proceed</strong> to begin Week ${week+1}.</p>`,{skipHistory:true,week});
        record(s,"week-complete","Week Complete","WEEK",document.getElementById("event-content")?.innerHTML||"",week);
        s.liveView={title:"Week Complete",type:"WEEK",content:document.getElementById("event-content")?.innerHTML||"",week};
        persistCurrentSeason();renderSimulationWeekNavigation();
    }

    function beginCleanFinale(){
        const s=sim();if(s.completed)return;
        s.finalists=active().map(p=>p.id);s.jury=getJuryMembers();s.finaleStarted=true;s.currentPhase="finale";s.currentEventIndex=0;s.viewingWeek=getSeasonLength(currentSeason);s.isViewingHistory=false;
        showEvent("Finale","FINALE",`<p>The regular season is complete.</p>${simulationPortraits(s.finalists,"large")}<p><strong>${s.finalists.length} finalists remain.</strong> Press <strong>Proceed</strong> to continue.</p>`,{skipHistory:true,week:getSeasonLength(currentSeason)});
        persistCurrentSeason();renderSimulationWeekNavigation();
    }

    function runCleanFinalHOH(){
        const s=sim(), finalists=s.finalists.map(player).filter(Boolean);
        if(finalists.length<3){s.currentEventIndex++;runCleanJuryVoting();return;}
        const comp=(currentSeason.competitions?.finalHoh||[])[0]||getWeekCompetitions(s.currentWeek).find(c=>String(c.type).toLowerCase()==="final hoh");
        const winner=chooseWinner(finalists,comp,"mental","physical");s.finalHOH=winner.id;winner.finalHohWins=Number(winner.finalHohWins||0)+1;
        display(s,comp?.name||"Final HOH","FINAL HOH",`${simulationPortrait(winner,"large")}<p><strong>${escapeHTML(name(winner.id))}</strong> has won <strong>${escapeHTML(comp?.name||"the Final HOH")}</strong>.</p><p>The Final HOH will choose the second finalist.</p>`,"final-hoh",{week:getSeasonLength(currentSeason)});
    }

    function runCleanJuryVoting(){
        const s=sim();let finalists=s.finalists.map(player).filter(Boolean);
        if(finalists.length>2){
            const hoh=player(s.finalHOH)||finalists[0], choices=finalists.filter(p=>p.id!==hoh.id);
            const chosen=choices.slice().sort((a,b)=>allianceBond(hoh.id,b.id)-allianceBond(hoh.id,a.id))[0]||choices[0];
            choices.filter(p=>p.id!==chosen.id).forEach(p=>{p.status="evicted";p.placement=3;});
            finalists=[hoh,chosen];s.finalists=finalists.map(p=>p.id);
        }
        if(!Array.isArray(s.jury)||!s.jury.length)s.jury=getJuryMembers();
        const votes=[];s.jury.forEach(jid=>{const juror=player(jid);if(!juror)return;const ranked=finalists.map(f=>({f,score:Number(f.ratings?.social||0)*.4+Number(f.ratings?.strategic||0)*.35+Number(f.ratings?.general||0)*.15+Number(f.ratings?.mental||0)*.1+allianceBond(jid,f.id)*.15+Math.random()*3})).sort((a,b)=>b.score-a.score);votes.push({juror:jid,vote:ranked[0].f.id});});
        const counts={};finalists.forEach(f=>counts[f.id]=0);votes.forEach(v=>counts[v.vote]=(counts[v.vote]||0)+1);s.juryVotes=votes;s.finaleVoteResults={votes,counts};
        const rows=votes.map(v=>`<div class="jury-vote-row">${simulationPortrait(player(v.juror),"small")}<strong>${escapeHTML(name(v.juror))}</strong><span>votes for</span><strong>${escapeHTML(name(v.vote))}</strong></div>`).join("");
        display(s,"Jury Voting","JURY VOTING",`${simulationPortraits(finalists.map(p=>p.id),"large")}<h3>The Jury Votes</h3><div class="jury-vote-list">${rows||"<p>No jury members were eligible to vote.</p>"}</div>` ,"jury-voting",{week:getSeasonLength(currentSeason)});
    }

    function runCleanFinalResults(){
        const s=sim(), finalists=s.finalists.map(player).filter(Boolean), counts=s.finaleVoteResults?.counts||{};
        const ranked=finalists.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));const winner=ranked[0],runner=ranked[1];
        s.winner=winner?.id||null;s.runnerUp=runner?.id||null;s.completed=true;s.currentPhase="complete";s.currentEventIndex=0;
        if(winner){winner.status="winner";winner.placement=1;}if(runner){runner.status="runner-up";runner.placement=2;}
        const others=currentSeason.houseguests.filter(p=>p.status==="evicted").map(p=>({id:p.id,name:name(p.id),placement:Number(p.placement||0)})).filter(x=>x.placement>2).sort((a,b)=>a.placement-b.placement);
        s.finalPlacements=[...(winner?[{id:winner.id,name:name(winner.id),placement:1}]:[]),...(runner?[{id:runner.id,name:name(runner.id),placement:2}]:[]),...others];
        display(s,"Final Results","FINAL RESULTS",`${winner?`${simulationPortrait(winner,"large")}<h2>${escapeHTML(name(winner.id))}</h2><p class="final-winner-label">WINNER — ${counts[winner.id]||0} JURY VOTES</p>`:""}${runner?`${simulationPortrait(runner,"large")}<p class="final-runner-label">RUNNER-UP — ${counts[runner.id]||0} JURY VOTES</p>`:""}<div class="final-jury-tally">${finalists.map(f=>`<div><strong>${escapeHTML(name(f.id))}</strong><span>${counts[f.id]||0} vote${(counts[f.id]||0)===1?"":"s"}</span></div>`).join("")}</div><button type="button" class="primary-button" onclick="showResults()">View Full Results</button>`,"finale-results",{week:getSeasonLength(currentSeason)});
        // display() increments the index; completed seasons must be idle at 0.
        s.currentEventIndex=0;persistCurrentSeason();
    }

    function cleanRunNextEvent(){
        if(!currentSeason){alert("Please open a saved season first.");return;}
        const s=sim();
        if(s.isViewingHistory){returnToCurrentSimulation();return;}
        if(s.completed){showResults();return;}

        if(s.pendingWeekAdvance){
            const next=Number(s.currentWeek)+1;
            if(next>getSeasonLength(currentSeason)){beginCleanFinale();return;}
            resetCycle(s,next,1);setText("current-week",next);updateSimulatorStatus(s);resetGameChain(0);
            showEvent(`Week ${next}`,"WEEK",`<p>Week ${next} is now beginning.</p>`,{skipHistory:true,week:next});
            s.liveView={title:`Week ${next}`,type:"WEEK",content:document.getElementById("event-content")?.innerHTML||"",week:next};
            persistCurrentSeason();renderSimulationWeekNavigation();return;
        }
        if(s.pendingCycle==="double"){s.pendingCycle=null;s.currentEventIndex=0;s.currentPhase="week";}
        if(s.currentPhase==="finale"||s.finaleStarted){
            const chain=finalChain(),event=chain[Number(s.currentEventIndex||0)];
            if(!event){runCleanFinalResults();return;}
            if(event.key==="final-hoh")runCleanFinalHOH();else if(event.key==="jury-voting")runCleanJuryVoting();else runCleanFinalResults();
            return;
        }
        const chain=cycleChain(s), event=chain[Number(s.currentEventIndex||0)];
        if(!event){finishCycleAfterEviction(false);return;}
        switch(event.key){
            case "twist":runCleanTwist(event.twistId);break;
            case "hoh":runCleanHOH();break;
            case "default-safety":runCleanDefaultSafety();break;
            case "nominations":runCleanNominations();break;
            case "pov-players":runCleanPOVPlayers();break;
            case "pov":runCleanPOV();break;
            case "veto-ceremony":runCleanVeto();break;
            case "custom-competition":runCleanSpecial(event.competitionId);break;
            case "eviction-voting":runCleanEvictionVoting();break;
            case "eviction":runCleanEviction();break;
        }
    }

    function cleanResimulateSeason(){
        if(!currentSeason){alert("There is no season loaded to re-simulate.");return false;}
        const season=currentSeason;
        if(!Array.isArray(season.houseguests)||season.houseguests.length<2){alert("At least two houseguests are required.");return false;}
        season.houseguests=season.houseguests.map(p=>{
            const q=deepClone(p);q.status="active";q.placement=null;q.hohWins=0;q.povWins=0;q.safetyWins=0;q.luxuryWins=0;q.finalHohWins=0;q.evictionVotes=0;q.nominationCount=0;q.vetoCount=0;q.juryVotes=0;
            ["isJury","juryStatus","eliminated","evicted","winner","runnerUp"].forEach(k=>delete q[k]);return q;
        });
        season.simulation=createDefaultSimulation();const s=season.simulation;s.started=true;s.currentPhase="week";s.currentWeek=1;s.viewingWeek=1;s.history=[];s.weekHistory=[];s.twistState={};s.isViewingHistory=false;s.liveView=null;
        currentSeason=season;persistCurrentSeason();setText("current-week",1);setText("simulator-season-name",season.name||"Big Brother");setText("simulator-season-theme",season.theme||"Custom Season");setText("sim-season-length",getSeasonLength(season));setText("sim-jury-size",season.rules?.jurySize??7);updateSimulatorStatus(s);resetGameChain(0);renderMemoryWallMini();renderSimulationWeekNavigation();showPage("simulator-page");showEvent("Week 1","NEW SIMULATION","<p>Your season configuration has been preserved.</p><p>Press <strong>Proceed</strong> to begin a completely new randomized simulation.</p>",{skipHistory:true,week:1});return true;
    }

    // One authoritative set of public simulation functions.
    window.runNextEvent=cleanRunNextEvent;
    window.resimulateSeason=cleanResimulateSeason;
    window.runHOHEvent=runCleanHOH;
    window.runDefaultSafetyEvent=runCleanDefaultSafety;
    window.runNominationEvent=runCleanNominations;
    window.runPOVPlayersEvent=runCleanPOVPlayers;
    window.runPOVEvent=runCleanPOV;
    window.runVetoCeremonyEvent=runCleanVeto;
    window.runCustomCompetitionEvent=runCleanSpecial;
    window.runEvictionVotingEvent=runCleanEvictionVoting;
    window.runEvictionEvent=runCleanEviction;
    window.beginFinale=beginCleanFinale;
    window.runFinalHOHEvent=runCleanFinalHOH;
    window.runJuryVotingEvent=runCleanJuryVoting;
    window.runFinaleResultsEvent=runCleanFinalResults;
    window.finalizeSeason=beginCleanFinale;
})();

/* =========================================================
   FINAL STABILITY PATCH — 2026-09-09
   Keeps the existing BrantSteele-style UI and simulation engine intact,
   while making Proceed resilient to stale/partially-saved simulation state.
   In particular, a completed Veto Player draw can never leave the game
   stranded on the Veto Selections screen.
   ========================================================= */
(function installProceedRecoveryPatch(){
    const originalProceed = window.runNextEvent;
    if (typeof originalProceed !== "function") return;

    function getSim(){
        if (!window.currentSeason && typeof currentSeason !== "undefined") window.currentSeason = currentSeason;
        const season = window.currentSeason || (typeof currentSeason !== "undefined" ? currentSeason : null);
        if (!season) return null;
        if (!season.simulation) season.simulation = createDefaultSimulation();
        return ensureFinaleState(season.simulation);
    }

    function activeEvent(s){
        if (!s) return null;
        const chain = (typeof cycleChain === "function") ? cycleChain(s) : getWeekEventChain(s.currentWeek);
        return chain[Number(s.currentEventIndex || 0)] || null;
    }

    window.runNextEvent = function(){
        const s = getSim();
        if (!s) return originalProceed();

        /*
         * Recovery for the exact reported failure:
         * if Veto Selections has already successfully populated the six
         * players but the event pointer is still sitting on that step,
         * move the pointer to the POV competition before continuing.
         */
        const event = activeEvent(s);
        if (event?.key === "pov-players" && Array.isArray(s.currentPOVPlayers) && s.currentPOVPlayers.length > 0){
            s.currentEventIndex = Number(s.currentEventIndex || 0) + 1;
            s.currentPhase = "week";
            if (typeof resetGameChain === "function") resetGameChain(s.currentEventIndex);
            if (typeof persistCurrentSeason === "function") persistCurrentSeason();
        }

        try {
            return originalProceed();
        } catch (error) {
            console.error("Big Brother Simulator Proceed recovery:", error);

            /*
             * If the normal state machine throws while moving past Veto
             * Selections, recover directly into the next event instead of
             * leaving the interface frozen.
             */
            const current = getSim();
            const next = activeEvent(current);
            if (next?.key === "pov" && typeof window.runPOVEvent === "function") {
                try {
                    window.runPOVEvent();
                    return;
                } catch (recoveryError) {
                    console.error("POV recovery failed:", recoveryError);
                }
            }

            alert("The simulator encountered an error while advancing. The current game state was preserved. Please press Proceed again to continue.");
        }
    };
})();

/* =========================================================
   FINAL INLINE-HANDLER EXPORTS — 2026-09-09
   ========================================================= */
window.resetRelationshipMatrix = resetRelationshipMatrix;
window.showMemoryWall = showMemoryWall;
window.showPage = showPage;
window.runNextEvent = window.runNextEvent || runNextEvent;
