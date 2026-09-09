/*
 * =========================================================
 * BIG BROTHER SIMULATOR
 * APPLICATION CONTROLLER
 *
 * Version 0.3
 *
 * Current systems:
 * - Season creation
 * - Custom season information
 * - Custom houseguests
 * - Houseguest images
 * - Houseguest ratings
 * - Season Rules & Settings
 * - Saved seasons
 * - Edit seasons
 * - Delete seasons
 * - Chain-by-chain simulator foundation
 *
 * Next major systems:
 * - Relationships
 * - Alliances
 * - Competitions
 * - Twists
 * - Real simulation engine
 * - Jury
 * - Finale
 * - Statistics
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
    {
        id: "hoh",
        label: "HOH",
        type: "HEAD OF HOUSEHOLD"
    },
    {
        id: "nominations",
        label: "Nominations",
        type: "NOMINATIONS"
    },
    {
        id: "pov-players",
        label: "POV Players",
        type: "POWER OF VETO"
    },
    {
        id: "pov",
        label: "POV",
        type: "POWER OF VETO"
    },
    {
        id: "veto-ceremony",
        label: "Veto Ceremony",
        type: "VETO CEREMONY"
    },
    {
        id: "eviction",
        label: "Eviction",
        type: "EVICTION"
    }
];


/* =========================================================
   APPLICATION STATE
   ========================================================= */

let savedSeasons = [];
let currentSeason = null;
let editingSeasonId = null;
let currentHouseguestId = 0;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadSavedSeasons();

    renderSavedSeasons();

    setupImagePreviews();

    setupRuleControls();

    initializeHouseguestCount();

});


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        page.classList.remove("active-page");
    });

    const page = document.getElementById(pageId);

    if (page) {
        page.classList.add("active-page");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (pageId === "saved-seasons-page") {
        renderSavedSeasons();
    }
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function loadSavedSeasons() {

    try {

        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            savedSeasons = [];
            return;
        }

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
            savedSeasons = parsed;
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

        alert(
            "The season could not be saved. Your browser may have storage disabled."
        );
    }
}


/* =========================================================
   SAVED SEASONS
   ========================================================= */

function renderSavedSeasons() {

    const homeContainer =
        document.getElementById(
            "saved-seasons-container"
        );

    const savedPageContainer =
        document.getElementById(
            "all-saved-seasons-container"
        );

    const containers = [
        homeContainer,
        savedPageContainer
    ].filter(Boolean);

    containers.forEach(container => {

        container.innerHTML = "";

        if (savedSeasons.length === 0) {

            container.innerHTML = `
                <div class="empty-state">

                    <h3>No Saved Seasons</h3>

                    <p>
                        Create your first custom Big Brother season
                        to get started.
                    </p>

                </div>
            `;

            return;
        }

        savedSeasons.forEach(season => {

            container.appendChild(
                createSeasonCard(season)
            );

        });

    });
}


function createSeasonCard(season) {

    const card =
        document.createElement("div");

    card.className = "saved-season-card";

    const logo =
        season.logo ||
        "";

    const imageHTML = logo
        ? `
            <img
                src="${escapeHTML(logo)}"
                alt="${escapeHTML(season.name || "Season")} logo"
                onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=&quot;saved-season-image-placeholder&quot;>NO IMAGE</span>';"
            >
        `
        : `
            <span class="saved-season-image-placeholder">
                NO IMAGE
            </span>
        `;

    const houseguestCount =
        Array.isArray(season.houseguests)
            ? season.houseguests.length
            : 0;

    const finalists =
        season.rules?.finalists || 2;

    card.innerHTML = `

        <div class="saved-season-image">
            ${imageHTML}
        </div>

        <div class="saved-season-content">

            <h3>
                ${escapeHTML(
                    season.name || "Untitled Season"
                )}
            </h3>

            <div class="saved-season-theme">
                ${escapeHTML(
                    season.theme || "Custom Season"
                )}
            </div>

            <div class="saved-season-meta">

                ${houseguestCount} Houseguests
                · Final ${finalists}

            </div>

            <div class="saved-season-actions">

                <button
                    class="button button-secondary"
                    type="button"
                    onclick="editSeason('${season.id}')"
                >
                    Edit
                </button>

                <button
                    class="button button-primary"
                    type="button"
                    onclick="openSeason('${season.id}')"
                >
                    Play
                </button>

                <button
                    class="button button-secondary"
                    type="button"
                    onclick="deleteSeason('${season.id}')"
                >
                    Delete
                </button>

            </div>

        </div>
    `;

    return card;
}


/* =========================================================
   CREATE NEW SEASON
   ========================================================= */

function createNewSeason() {

    editingSeasonId = null;

    resetSeasonCreator();

    showPage("creator-page");
}


function resetSeasonCreator() {

    const name =
        document.getElementById("season-name");

    const theme =
        document.getElementById("season-theme");

    const description =
        document.getElementById(
            "season-description"
        );

    const logo =
        document.getElementById("season-logo");

    const background =
        document.getElementById(
            "season-background"
        );

    if (name) name.value = "";

    if (theme) theme.value = "";

    if (description) description.value = "";

    if (logo) logo.value = "";

    if (background) background.value = "";


    const editor =
        document.getElementById(
            "houseguest-editor"
        );

    if (editor) {
        editor.innerHTML = "";
    }


    currentHouseguestId = 0;


    const count =
        document.getElementById(
            "houseguest-count"
        );

    if (count) {
        count.value = 16;
    }


    resetSeasonRules();

    updateHouseguestCount();

    updateLogoPreview();

}


/* =========================================================
   HOUSEGUEST COUNT
   ========================================================= */

function initializeHouseguestCount() {

    const count =
        document.getElementById(
            "houseguest-count"
        );

    if (!count) {
        return;
    }

    count.addEventListener(
        "change",
        updateHouseguestCount
    );

    count.addEventListener(
        "input",
        updateHouseguestCount
    );

    updateHouseguestCount();
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

    let desiredCount =
        parseInt(countInput.value, 10);

    if (Number.isNaN(desiredCount)) {
        desiredCount = 16;
    }

    desiredCount =
        Math.max(
            2,
            Math.min(50, desiredCount)
        );

    countInput.value = desiredCount;

    const existingCards =
        editor.querySelectorAll(
            ".houseguest-card"
        );

    const existingCount =
        existingCards.length;


    if (desiredCount > existingCount) {

        for (
            let i = existingCount;
            i < desiredCount;
            i++
        ) {

            addHouseguest();
        }

    } else if (desiredCount < existingCount) {

        for (
            let i = existingCount;
            i > desiredCount;
            i--
        ) {

            const cards =
                editor.querySelectorAll(
                    ".houseguest-card"
                );

            const lastCard =
                cards[cards.length - 1];

            if (lastCard) {
                lastCard.remove();
            }
        }

        updateHouseguestNumbers();
    }
}


/* =========================================================
   HOUSEGUEST CREATION
   ========================================================= */

function addHouseguest(data = null) {

    const editor =
        document.getElementById(
            "houseguest-editor"
        );

    if (!editor) {
        return;
    }

    currentHouseguestId++;

    const id =
        currentHouseguestId;

    const houseguest =
        data || createDefaultHouseguest();


    const card =
        document.createElement("div");

    card.className =
        "houseguest-card";

    card.dataset.houseguestId = id;


    card.innerHTML = `

        <div class="houseguest-card-header">

            <div>
                <span>
                    HOUSEGUEST
                </span>

                <h3 class="houseguest-number">
                    Houseguest ${id}
                </h3>
            </div>

            <button
                type="button"
                class="button button-secondary"
                onclick="removeHouseguest(${id})"
            >
                Remove
            </button>

        </div>


        <div class="houseguest-photo-section">

            <div
                class="houseguest-photo-preview"
                id="houseguest-photo-preview-${id}"
            >

                ${
                    houseguest.image
                        ? `
                            <img
                                src="${escapeHTML(houseguest.image)}"
                                alt="${escapeHTML(houseguest.name || "Houseguest")}"
                                onerror="showHouseguestPlaceholder(${id})"
                            >
                        `
                        : `
                            <span class="houseguest-photo-placeholder">
                                NO PHOTO
                            </span>
                        `
                }

            </div>


            <div class="houseguest-basic-info">

                <div class="form-group">

                    <label>
                        Name
                    </label>

                    <input
                        type="text"
                        class="hg-name"
                        value="${escapeAttribute(
                            houseguest.name || ""
                        )}"
                        placeholder="Houseguest name"
                    >

                </div>


                <div class="form-group">

                    <label>
                        Image URL
                    </label>

                    <input
                        type="url"
                        class="hg-image"
                        value="${escapeAttribute(
                            houseguest.image || ""
                        )}"
                        placeholder="https://i.imgur.com/..."
                        oninput="updateHouseguestImage(${id}, this.value)"
                    >

                </div>


                <div class="form-group">

                    <label>
                        Age
                    </label>

                    <input
                        type="number"
                        class="hg-age"
                        value="${escapeAttribute(
                            houseguest.age || ""
                        )}"
                        min="18"
                        max="100"
                        placeholder="Age"
                    >

                </div>


                <div class="form-group">

                    <label>
                        Occupation
                    </label>

                    <input
                        type="text"
                        class="hg-occupation"
                        value="${escapeAttribute(
                            houseguest.occupation || ""
                        )}"
                        placeholder="Occupation"
                    >

                </div>

            </div>

        </div>


        <div class="houseguest-ratings">

            <h4>
                Player Ratings
            </h4>


            <div class="ratings-grid">

                ${createRatingInput(
                    id,
                    "general",
                    "General",
                    houseguest.ratings?.general ?? 5
                )}

                ${createRatingInput(
                    id,
                    "physical",
                    "Physical",
                    houseguest.ratings?.physical ?? 5
                )}

                ${createRatingInput(
                    id,
                    "mental",
                    "Mental",
                    houseguest.ratings?.mental ?? 5
                )}

                ${createRatingInput(
                    id,
                    "social",
                    "Social",
                    houseguest.ratings?.social ?? 5
                )}

                ${createRatingInput(
                    id,
                    "strategic",
                    "Strategic",
                    houseguest.ratings?.strategic ?? 5
                )}

            </div>

        </div>

    `;


    editor.appendChild(card);

    updateHouseguestNumbers();
}


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

        }

    };
}


function createRatingInput(
    id,
    key,
    label,
    value
) {

    return `

        <div class="rating-group">

            <label>
                ${label}
            </label>

            <input
                type="number"
                class="hg-rating"
                data-rating="${key}"
                value="${escapeAttribute(value)}"
                min="1"
                max="10"
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

    card.remove();

    const count =
        document.getElementById(
            "houseguest-count"
        );

    if (count) {

        const total =
            document.querySelectorAll(
                ".houseguest-card"
            ).length;

        count.value = total;
    }

    updateHouseguestNumbers();
}


function updateHouseguestNumbers() {

    const cards =
        document.querySelectorAll(
            ".houseguest-card"
        );

    cards.forEach((card, index) => {

        const number =
            card.querySelector(
                ".houseguest-number"
            );

        if (number) {

            number.textContent =
                `Houseguest ${index + 1}`;
        }

    });
}


/* =========================================================
   HOUSEGUEST IMAGES
   ========================================================= */

function updateHouseguestImage(id, url) {

    const preview =
        document.getElementById(
            `houseguest-photo-preview-${id}`
        );

    if (!preview) {
        return;
    }

    if (!url.trim()) {

        showHouseguestPlaceholder(id);

        return;
    }

    preview.innerHTML = `

        <img
            src="${escapeAttribute(url.trim())}"
            alt="Houseguest"
            onerror="showHouseguestPlaceholder(${id})"
        >

    `;
}


function showHouseguestPlaceholder(id) {

    const preview =
        document.getElementById(
            `houseguest-photo-preview-${id}`
        );

    if (!preview) {
        return;
    }

    preview.innerHTML = `

        <span class="houseguest-photo-placeholder">
            NO PHOTO
        </span>

    `;
}


/* =========================================================
   COLLECT HOUSEGUEST DATA
   ========================================================= */

function collectHouseguests() {

    const cards =
        document.querySelectorAll(
            ".houseguest-card"
        );

    const houseguests = [];

    cards.forEach((card, index) => {

        const name =
            card.querySelector(
                ".hg-name"
            )?.value.trim() || "";

        const image =
            card.querySelector(
                ".hg-image"
            )?.value.trim() || "";

        const age =
            card.querySelector(
                ".hg-age"
            )?.value || "";

        const occupation =
            card.querySelector(
                ".hg-occupation"
            )?.value.trim() || "";


        const ratings = {};


        card.querySelectorAll(
            ".hg-rating"
        ).forEach(input => {

            const key =
                input.dataset.rating;

            ratings[key] =
                getRatingValue(
                    input.value
                );
        });


        houseguests.push({

            id:
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

        });

    });

    return houseguests;
}


function getRatingValue(value) {

    let number =
        parseInt(value, 10);

    if (Number.isNaN(number)) {
        number = 5;
    }

    return Math.max(
        1,
        Math.min(10, number)
    );
}


/* =========================================================
   IMAGE PREVIEWS
   ========================================================= */

function setupImagePreviews() {

    const logo =
        document.getElementById(
            "season-logo"
        );

    const background =
        document.getElementById(
            "season-background"
        );


    if (logo) {

        logo.addEventListener(
            "input",
            updateLogoPreview
        );

    }


    if (background) {

        background.addEventListener(
            "input",
            updateBackgroundPreview
        );

    }
}


function updateLogoPreview() {

    const input =
        document.getElementById(
            "season-logo"
        );

    const container =
        document.getElementById(
            "season-logo-preview"
        );

    const image =
        document.getElementById(
            "season-logo-preview-image"
        );

    if (!input || !container || !image) {
        return;
    }

    const url =
        input.value.trim();


    if (!url) {

        container.style.display =
            "none";

        image.src = "";

        return;
    }


    image.onload = () => {

        container.style.display =
            "block";
    };


    image.onerror = () => {

        container.style.display =
            "none";
    };


    image.src = url;
}


function updateBackgroundPreview() {

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
            `url("${url}")`;

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

    setSelectValue(
        "rule-finalists",
        "2"
    );

    setInputValue(
        "rule-jury-size",
        "7"
    );

    setCheckboxValue(
        "rule-veto-enabled",
        true
    );

    setCheckboxValue(
        "rule-safety-enabled",
        false
    );

    setCheckboxValue(
        "rule-battle-back",
        false
    );

    setCheckboxValue(
        "rule-double-eviction",
        false
    );

    setSelectValue(
        "rule-nominees",
        "2"
    );

    setInputValue(
        "rule-custom-nominees",
        "2"
    );

    setSelectValue(
        "rule-veto-players",
        "6"
    );

    setInputValue(
        "rule-custom-veto-players",
        "6"
    );

    setSelectValue(
        "rule-eviction-type",
        "house"
    );

    setSelectValue(
        "rule-starting-hoh",
        "random"
    );

    setSelectValue(
        "rule-specific-hoh",
        ""
    );

    setCheckboxValue(
        "rule-jury-voting",
        true
    );


    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();
}


function collectSeasonRules() {

    let nominees =
        document.getElementById(
            "rule-nominees"
        )?.value || "2";


    if (nominees === "custom") {

        nominees =
            getSafeNumber(
                "rule-custom-nominees",
                2,
                1,
                10
            );

    } else {

        nominees =
            parseInt(
                nominees,
                10
            );
    }


    let vetoPlayers =
        document.getElementById(
            "rule-veto-players"
        )?.value || "6";


    if (vetoPlayers === "custom") {

        vetoPlayers =
            getSafeNumber(
                "rule-custom-veto-players",
                6,
                3,
                15
            );

    } else {

        vetoPlayers =
            parseInt(
                vetoPlayers,
                10
            );
    }


    return {

        finalists:
            getSafeNumber(
                "rule-finalists",
                2,
                2,
                3
            ),

        jurySize:
            getSafeNumber(
                "rule-jury-size",
                7,
                0,
                30
            ),

        vetoEnabled:
            getCheckboxValue(
                "rule-veto-enabled",
                true
            ),

        safetyCompetitionEnabled:
            getCheckboxValue(
                "rule-safety-enabled",
                false
            ),

        battleBackEnabled:
            getCheckboxValue(
                "rule-battle-back",
                false
            ),

        doubleEvictionEnabled:
            getCheckboxValue(
                "rule-double-eviction",
                false
            ),

        nomineesPerWeek:
            nominees,

        vetoPlayers:
            vetoPlayers,

        evictionType:
            getSelectValue(
                "rule-eviction-type",
                "house"
            ),

        startingHOH:
            getSelectValue(
                "rule-starting-hoh",
                "random"
            ),

        specificStartingHOH:
            getSelectValue(
                "rule-specific-hoh",
                ""
            ),

        juryVotingEnabled:
            getCheckboxValue(
                "rule-jury-voting",
                true
            )

    };
}


/* =========================================================
   RULE VISIBILITY
   ========================================================= */

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
            ? "flex"
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
            ? "flex"
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
            ? "flex"
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

    const previousValue =
        select.value;


    select.innerHTML = `

        <option value="">
            Select Houseguest
        </option>

    `;


    const houseguests =
        collectHouseguests();


    houseguests.forEach(
        (houseguest, index) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                houseguest.id;

            option.textContent =
                houseguest.name ||
                `Houseguest ${index + 1}`;

            select.appendChild(option);

        }
    );


    const stillExists =
        Array.from(
            select.options
        ).some(
            option =>
                option.value === previousValue
        );


    if (stillExists) {

        select.value =
            previousValue;
    }
}


/* =========================================================
   SAVE SEASON
   ========================================================= */

function saveSeason() {

    const name =
        document.getElementById(
            "season-name"
        )?.value.trim() || "";

    const theme =
        document.getElementById(
            "season-theme"
        )?.value.trim() || "";

    const description =
        document.getElementById(
            "season-description"
        )?.value.trim() || "";

    const logo =
        document.getElementById(
            "season-logo"
        )?.value.trim() || "";

    const background =
        document.getElementById(
            "season-background"
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
            "A season needs at least two houseguests."
        );

        return;
    }


    const rules =
        collectSeasonRules();


    let season;


    if (editingSeasonId) {

        const existing =
            savedSeasons.find(
                season =>
                    season.id === editingSeasonId
            );


        if (!existing) {

            alert(
                "The season you were editing could not be found."
            );

            return;
        }


        season = {

            ...existing,

            name,

            theme,

            description,

            logo,

            background,

            houseguests,

            rules,

            updatedAt:
                new Date().toISOString()

        };


        const index =
            savedSeasons.findIndex(
                item =>
                    item.id === editingSeasonId
            );


        savedSeasons[index] =
            season;

    } else {

        season = {

            id:
                generateId(),

            name,

            theme,

            description,

            logo,

            background,

            houseguests,

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

            rules,

            simulation: {

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
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        };


        savedSeasons.push(season);
    }


    persistSavedSeasons();

    currentSeason =
        season;


    editingSeasonId =
        null;


    renderSavedSeasons();


    alert(
        `"${name}" has been saved successfully.`
    );


    showPage(
        "saved-seasons-page"
    );
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


    loadSeasonIntoCreator(
        season
    );


    showPage(
        "creator-page"
    );
}


function loadSeasonIntoCreator(season) {

    setInputValue(
        "season-name",
        season.name || ""
    );

    setInputValue(
        "season-theme",
        season.theme || ""
    );

    setInputValue(
        "season-description",
        season.description || ""
    );

    setInputValue(
        "season-logo",
        season.logo || ""
    );

    setInputValue(
        "season-background",
        season.background || ""
    );


    const editor =
        document.getElementById(
            "houseguest-editor"
        );

    if (editor) {
        editor.innerHTML = "";
    }


    currentHouseguestId = 0;


    const houseguests =
        Array.isArray(
            season.houseguests
        )
            ? season.houseguests
            : [];


    const count =
        document.getElementById(
            "houseguest-count"
        );

    if (count) {
        count.value =
            Math.max(
                2,
                houseguests.length
            );
    }


    houseguests.forEach(
        houseguest => {

            addHouseguest(
                houseguest
            );

        }
    );


    loadSeasonRules(
        season.rules
    );


    updateHouseguestCount();

    updateLogoPreview();

    updateBackgroundPreview();

    updateSpecificHOHVisibility();
}


function loadSeasonRules(rules = {}) {

    const defaults = {

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

    };


    const settings = {
        ...defaults,
        ...rules
    };


    setSelectValue(
        "rule-finalists",
        String(settings.finalists)
    );


    setInputValue(
        "rule-jury-size",
        settings.jurySize
    );


    setCheckboxValue(
        "rule-veto-enabled",
        settings.vetoEnabled
    );


    setCheckboxValue(
        "rule-safety-enabled",
        settings.safetyCompetitionEnabled
    );


    setCheckboxValue(
        "rule-battle-back",
        settings.battleBackEnabled
    );


    setCheckboxValue(
        "rule-double-eviction",
        settings.doubleEvictionEnabled
    );


    const nomineeValue =
        String(
            settings.nomineesPerWeek
        );


    if (
        nomineeValue === "2" ||
        nomineeValue === "3"
    ) {

        setSelectValue(
            "rule-nominees",
            nomineeValue
        );

    } else {

        setSelectValue(
            "rule-nominees",
            "custom"
        );

        setInputValue(
            "rule-custom-nominees",
            settings.nomineesPerWeek
        );
    }


    const vetoValue =
        String(
            settings.vetoPlayers
        );


    if (
        vetoValue === "6" ||
        vetoValue === "7"
    ) {

        setSelectValue(
            "rule-veto-players",
            vetoValue
        );

    } else {

        setSelectValue(
            "rule-veto-players",
            "custom"
        );

        setInputValue(
            "rule-custom-veto-players",
            settings.vetoPlayers
        );
    }


    setSelectValue(
        "rule-eviction-type",
        settings.evictionType
    );


    setSelectValue(
        "rule-starting-hoh",
        settings.startingHOH
    );


    setCheckboxValue(
        "rule-jury-voting",
        settings.juryVotingEnabled
    );


    updateCustomNomineesVisibility();

    updateCustomVetoPlayersVisibility();

    updateSpecificHOHVisibility();


    setTimeout(() => {

        setSelectValue(
            "rule-specific-hoh",
            settings.specificStartingHOH || ""
        );

    }, 0);
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
        season;


    /*
     * If the simulation has never started,
     * initialize its setup state.
     */

    if (!season.simulation) {

        season.simulation = {

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


    loadSimulator(
        season
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
            `Are you sure you want to delete "${season.name}"?`
        );


    if (!confirmed) {
        return;
    }


    savedSeasons =
        savedSeasons.filter(
            item =>
                item.id !== id
        );


    persistSavedSeasons();

    renderSavedSeasons();


    if (
        currentSeason &&
        currentSeason.id === id
    ) {

        currentSeason =
            null;
    }
}


/* =========================================================
   SIMULATOR LOADING
   ========================================================= */

function loadSimulator(season) {

    document.getElementById(
        "simulator-season-name"
    ).textContent =
        season.name || "Season";


    document.getElementById(
        "simulator-season-theme"
    ).textContent =
        season.theme || "Custom Season";


    if (
        season.background
    ) {

        document.getElementById(
            "simulator-page"
        ).style.backgroundImage =
            `url("${season.background}")`;

        document.getElementById(
            "simulator-page"
        ).style.backgroundSize =
            "cover";

        document.getElementById(
            "simulator-page"
        ).style.backgroundAttachment =
            "fixed";
    }


    updateSimulatorStatus();

    resetGameChainVisuals();

    displaySimulationEvent(
        "hoh"
    );
}


/* =========================================================
   SIMULATOR STATUS
   ========================================================= */

function updateSimulatorStatus() {

    if (!currentSeason) {
        return;
    }


    const simulation =
        currentSeason.simulation || {};


    const week =
        simulation.currentWeek || 1;


    document.getElementById(
        "current-week"
    ).textContent =
        week;


    document.getElementById(
        "current-hoh"
    ).textContent =
        getHouseguestName(
            simulation.currentHOH
        );


    document.getElementById(
        "current-nominees"
    ).textContent =
        formatHouseguestList(
            simulation.currentNominees
        );


    document.getElementById(
        "current-veto"
    ).textContent =
        getHouseguestName(
            simulation.currentPOVWinner
        );
}


/* =========================================================
   GAME CHAIN
   ========================================================= */

function resetGameChainVisuals() {

    const steps =
        document.querySelectorAll(
            ".chain-step"
        );


    steps.forEach(
        step => {

            step.classList.remove(
                "active"
            );

            step.classList.remove(
                "completed"
            );

        }
    );


    if (steps[0]) {

        steps[0].classList.add(
            "active"
        );
    }
}


function markChainStep(eventId) {

    const currentIndex =
        EVENT_CHAIN.findIndex(
            event =>
                event.id === eventId
        );


    const steps =
        document.querySelectorAll(
            ".chain-step"
        );


    steps.forEach(
        (step, index) => {

            step.classList.remove(
                "active"
            );

            step.classList.remove(
                "completed"
            );


            if (index < currentIndex) {

                step.classList.add(
                    "completed"
                );

            }


            if (index === currentIndex) {

                step.classList.add(
                    "active"
                );

            }

        }
    );
}


/* =========================================================
   RUN NEXT EVENT
   ========================================================= */

function runNextEvent() {

    if (!currentSeason) {
        return;
    }


    const simulation =
        currentSeason.simulation;


    if (!simulation) {
        return;
    }


    simulation.started =
        true;


    const event =
        EVENT_CHAIN[
            simulation.currentEventIndex
        ];


    if (!event) {
        return;
    }


    /*
     * FOUNDATION ONLY
     *
     * For now we display the chain.
     *
     * The actual simulation decisions will
     * be implemented in the Simulation Engine stage.
     */

    displaySimulationEvent(
        event.id
    );


    /*
     * Move to the next event.
     */

    if (
        simulation.currentEventIndex <
        EVENT_CHAIN.length - 1
    ) {

        simulation.currentEventIndex++;

    } else {

        /*
         * End of weekly chain.
         *
         * For now, advance to the next week.
         */

        simulation.currentWeek++;

        simulation.currentEventIndex = 0;

        simulation.currentPhase =
            "weekly";

    }


    saveCurrentSeasonState();

    updateSimulatorStatus();


    /*
     * Highlight the next step.
     */

    const nextEvent =
        EVENT_CHAIN[
            simulation.currentEventIndex
        ];


    if (nextEvent) {

        markChainStep(
            nextEvent.id
        );
    }
}


/* =========================================================
   DISPLAY SIMULATION EVENT
   ========================================================= */

function displaySimulationEvent(
    eventId
) {

    const event =
        EVENT_CHAIN.find(
            item =>
                item.id === eventId
        );


    if (!event) {
        return;
    }


    const type =
        document.getElementById(
            "event-type"
        );

    const title =
        document.getElementById(
            "event-title"
        );

    const content =
        document.getElementById(
            "event-content"
        );


    type.textContent =
        event.type;


    title.textContent =
        getEventTitle(
            eventId
        );


    content.innerHTML =
        getEventContent(
            eventId
        );


    markChainStep(
        eventId
    );
}


function getEventTitle(eventId) {

    switch (eventId) {

        case "hoh":
            return "The HOH Competition";

        case "nominations":
            return "Nomination Ceremony";

        case "pov-players":
            return "POV Players Are Selected";

        case "pov":
            return "The Power of Veto Competition";

        case "veto-ceremony":
            return "The Veto Ceremony";

        case "eviction":
            return "Eviction";

        default:
            return "Big Brother";
    }
}


function getEventContent(eventId) {

    if (!currentSeason) {

        return `
            <p>
                The simulation is ready to begin.
            </p>
        `;
    }


    const rules =
        currentSeason.rules || {};


    switch (eventId) {

        case "hoh":

            return `

                <p>
                    The houseguests are competing for
                    Head of Household.
                </p>

                <p>
                    Starting HOH:
                    <strong>
                        ${
                            rules.startingHOH === "specific"
                                ? getHouseguestName(
                                    rules.specificStartingHOH
                                )
                                : "Random Houseguest"
                        }
                    </strong>
                </p>

            `;


        case "nominations":

            return `

                <p>
                    The Head of Household will nominate
                    <strong>
                        ${
                            rules.nomineesPerWeek || 2
                        }
                    </strong>
                    houseguest${
                        (rules.nomineesPerWeek || 2) === 1
                            ? ""
                            : "s"
                    } for eviction.
                </p>

            `;


        case "pov-players":

            if (
                rules.vetoEnabled === false
            ) {

                return `

                    <p>
                        The Power of Veto is disabled
                        for this season.
                    </p>

                `;
            }


            return `

                <p>
                    <strong>
                        ${
                            rules.vetoPlayers || 6
                        }
                    </strong>
                    houseguests will compete in
                    the Power of Veto competition.
                </p>

            `;


        case "pov":

            if (
                rules.vetoEnabled === false
            ) {

                return `

                    <p>
                        There is no Power of Veto
                        competition this season.
                    </p>

                `;
            }


            return `

                <p>
                    The houseguests compete for the
                    Power of Veto.
                </p>

            `;


        case "veto-ceremony":

            if (
                rules.vetoEnabled === false
            ) {

                return `

                    <p>
                        Because the Power of Veto is
                        disabled, there is no veto
                        ceremony.
                    </p>

                `;
            }


            return `

                <p>
                    The Power of Veto winner decides
                    whether to use the Veto.
                </p>

            `;


        case "eviction":

            return `

                <p>
                    The house will vote to evict
                    a houseguest.
                </p>

                <p>
                    Voting method:
                    <strong>
                        ${
                            getEvictionTypeLabel(
                                rules.evictionType
                            )
                        }
                    </strong>
                </p>

            `;


        default:

            return `
                <p>
                    The simulation is continuing.
                </p>
            `;
    }
}


function getEvictionTypeLabel(type) {

    switch (type) {

        case "public":
            return "Public Vote";

        case "custom":
            return "Custom";

        case "house":
        default:
            return "House Vote";
    }
}


/* =========================================================
   SAVE CURRENT SIMULATION STATE
   ========================================================= */

function saveCurrentSeasonState() {

    if (!currentSeason) {
        return;
    }


    const index =
        savedSeasons.findIndex(
            season =>
                season.id === currentSeason.id
        );


    if (index === -1) {
        return;
    }


    savedSeasons[index] =
        currentSeason;


    persistSavedSeasons();
}


/* =========================================================
   RESULTS
   ========================================================= */

function showResults() {

    if (!currentSeason) {
        return;
    }


    const simulation =
        currentSeason.simulation || {};


    document.getElementById(
        "results-season-name"
    ).textContent =
        currentSeason.name || "Season Results";


    document.getElementById(
        "winner-name"
    ).textContent =
        getHouseguestName(
            simulation.winner
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


    if (!container || !currentSeason) {
        return;
    }


    const placements =
        currentSeason.simulation
            ?.finalPlacements || [];


    container.innerHTML = "";


    if (placements.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    No Final Placements Yet
                </h3>

                <p>
                    Complete the simulation to see
                    the final results.
                </p>

            </div>

        `;

        return;
    }


    placements.forEach(
        (placement, index) => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "placement-row";


            row.innerHTML = `

                <span class="placement-number">
                    ${index + 1}
                </span>

                <span class="placement-name">
                    ${
                        getHouseguestName(
                            placement
                        )
                    }
                </span>

                <span class="placement-status">
                    ${
                        index === 0
                            ? "WINNER"
                            : index === 1
                                ? "RUNNER-UP"
                                : "PLACED"
                    }
                </span>

            `;


            container.appendChild(
                row
            );

        }
    );
}


function renderSeasonStatistics() {

    const container =
        document.getElementById(
            "season-statistics"
        );


    if (!container || !currentSeason) {
        return;
    }


    const houseguests =
        currentSeason.houseguests || [];


    const totalHOHWins =
        houseguests.reduce(
            (total, hg) =>
                total +
                (hg.hohWins || 0),
            0
        );


    const totalPOVWins =
        houseguests.reduce(
            (total, hg) =>
                total +
                (hg.povWins || 0),
            0
        );


    const totalNominations =
        houseguests.reduce(
            (total, hg) =>
                total +
                (hg.nominationCount || 0),
            0
        );


    const stats = [

        {
            label: "Houseguests",
            value: houseguests.length
        },

        {
            label: "HOH Wins",
            value: totalHOHWins
        },

        {
            label: "POV Wins",
            value: totalPOVWins
        },

        {
            label: "Nominations",
            value: totalNominations
        }

    ];


    container.innerHTML = "";


    stats.forEach(stat => {

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "stat-card";


        card.innerHTML = `

            <strong>
                ${escapeHTML(stat.label)}
            </strong>

            <span>
                ${escapeHTML(stat.value)}
            </span>

        `;


        container.appendChild(
            card
        );

    });
}


/* =========================================================
   HOUSEGUEST HELPERS
   ========================================================= */

function getHouseguestName(id) {

    if (!id || !currentSeason) {
        return "—";
    }


    const houseguest =
        currentSeason.houseguests?.find(
            hg =>
                hg.id === id
        );


    return houseguest?.name ||
        "Unknown";
}


function formatHouseguestList(ids) {

    if (
        !Array.isArray(ids) ||
        ids.length === 0
    ) {

        return "—";
    }


    return ids
        .map(id =>
            getHouseguestName(id)
        )
        .join(", ");
}


/* =========================================================
   GENERAL INPUT HELPERS
   ========================================================= */

function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value ?? "";
    }
}


function setSelectValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }


    const exists =
        Array.from(
            element.options
        ).some(
            option =>
                option.value === String(value)
        );


    if (exists) {

        element.value =
            String(value);

    } else {

        element.selectedIndex =
            0;
    }
}


function setCheckboxValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.checked =
            Boolean(value);
    }
}


function getSelectValue(
    id,
    fallback
) {

    const element =
        document.getElementById(id);

    return element
        ? element.value
        : fallback;
}


function getCheckboxValue(
    id,
    fallback
) {

    const element =
        document.getElementById(id);

    return element
        ? element.checked
        : fallback;
}


function getSafeNumber(
    id,
    fallback,
    min,
    max
) {

    const element =
        document.getElementById(id);

    let value =
        parseInt(
            element?.value,
            10
        );


    if (Number.isNaN(value)) {
        value = fallback;
    }


    return Math.max(
        min,
        Math.min(max, value)
    );
}


/* =========================================================
   ID GENERATOR
   ========================================================= */

function generateId() {

    return (
        "season-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

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


function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(content) {

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


    modal.style.display =
        "flex";
}


function closeModal() {

    const modal =
        document.getElementById(
            "modal"
        );


    if (modal) {

        modal.style.display =
            "none";
    }
}


/* =========================================================
   GLOBAL FUNCTION EXPORTS
   ========================================================= */

window.showPage =
    showPage;

window.createNewSeason =
    createNewSeason;

window.addHouseguest =
    addHouseguest;

window.removeHouseguest =
    removeHouseguest;

window.updateHouseguestImage =
    updateHouseguestImage;

window.showHouseguestPlaceholder =
    showHouseguestPlaceholder;

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

window.openModal =
    openModal;

window.closeModal =
    closeModal;
