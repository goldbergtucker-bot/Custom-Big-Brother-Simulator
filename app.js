"use strict";

/* =========================================================
   BIG BROTHER SIMULATOR
   APP CONTROLLER — VERSION 0.1
   ========================================================= */

/*
    CURRENT FEATURES
    ---------------------------------------------------------
    ✓ Page navigation
    ✓ Season creation
    ✓ Houseguest creation
    ✓ Houseguest deletion
    ✓ Houseguest image previews
    ✓ Season logo preview
    ✓ Season background URL
    ✓ Houseguest ratings
    ✓ Save seasons to localStorage
    ✓ Load saved seasons
    ✓ Delete saved seasons
    ✓ Open saved seasons
    ✓ Basic simulator preparation
    ✓ Basic results preparation

    FUTURE FEATURES
    ---------------------------------------------------------
    • Full simulation engine
    • HOH competitions
    • Nominations
    • POV
    • Veto ceremony
    • Evictions
    • Alliances
    • Dynamic relationships
    • Custom competitions
    • Custom twists
    • Season rules
    • Final jury
    • Season statistics
    • Season recap
*/


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const STORAGE_KEY = "bigBrotherSimulatorSeasons";

let savedSeasons = [];

let currentSeason = null;

let editingSeasonId = null;

let currentHouseguestId = 0;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadSeasonsFromStorage();

    renderSavedSeasons();

    setupSeasonLogoPreview();

    setupSeasonBackgroundPreview();

    updateHouseguestCount();

});


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        page.classList.remove("active");
    });


    const selectedPage = document.getElementById(pageId);

    if (!selectedPage) {
        console.error(`Page not found: ${pageId}`);
        return;
    }


    selectedPage.classList.add("active");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   SAVED SEASONS — STORAGE
   ========================================================= */

function loadSeasonsFromStorage() {

    try {

        const storedSeasons =
            localStorage.getItem(STORAGE_KEY);

        if (!storedSeasons) {

            savedSeasons = [];

            return;
        }


        const parsedSeasons =
            JSON.parse(storedSeasons);


        if (Array.isArray(parsedSeasons)) {

            savedSeasons = parsedSeasons;

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


/* ---------------------------------------------------------
   Save seasons to browser
   --------------------------------------------------------- */

function saveSeasonsToStorage() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedSeasons)
        );

        return true;

    } catch (error) {

        console.error(
            "Could not save seasons:",
            error
        );

        alert(
            "The season could not be saved. Your browser may have storage disabled or full."
        );

        return false;

    }

}


/* =========================================================
   SAVED SEASONS — DISPLAY
   ========================================================= */

function renderSavedSeasons() {

    const container =
        document.getElementById(
            "saved-seasons-container"
        );


    if (!container) {
        return;
    }


    if (savedSeasons.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">🏠</div>

                <h3>No Seasons Yet</h3>

                <p>
                    Create your first custom Big Brother season
                    to get started.
                </p>

                <button
                    class="primary-button"
                    onclick="showPage('creator-page')">
                    CREATE YOUR FIRST SEASON
                </button>

            </div>

        `;

        return;
    }


    container.innerHTML = "";


    savedSeasons.forEach(season => {

        const card =
            createSeasonCard(season);

        container.appendChild(card);

    });

}


/* =========================================================
   CREATE SAVED SEASON CARD
   ========================================================= */

function createSeasonCard(season) {

    const card =
        document.createElement("div");

    card.className =
        "saved-season-card";


    const logoHTML =
        season.logo
            ? `
                <img
                    src="${escapeAttribute(season.logo)}"
                    alt="${escapeAttribute(season.name)} logo"
                    onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=&quot;saved-season-logo-placeholder&quot;>🏠</div>';">
              `
            : `
                <div class="saved-season-logo-placeholder">
                    🏠
                </div>
              `;


    card.innerHTML = `

        <div class="saved-season-logo">
            ${logoHTML}
        </div>


        <div class="saved-season-info">

            <h3>
                ${escapeHTML(
                    season.name || "Untitled Season"
                )}
            </h3>

            <div class="saved-season-theme">
                ${
                    escapeHTML(
                        season.theme || "Custom Season"
                    )
                }
            </div>


            <div class="saved-season-actions">

                <button
                    onclick="openSeason('${season.id}')">
                    Open
                </button>

                <button
                    onclick="editSeason('${season.id}')">
                    Edit
                </button>

                <button
                    onclick="deleteSeason('${season.id}')">
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

function resetSeasonCreator() {

    editingSeasonId = null;

    currentSeason = null;

    document.getElementById("season-name").value = "";

    document.getElementById("season-theme").value = "";

    document.getElementById("season-description").value = "";

    document.getElementById("season-logo").value = "";

    document.getElementById("season-background").value = "";


    const houseguestEditor =
        document.getElementById(
            "houseguest-editor"
        );


    houseguestEditor.innerHTML = "";


    updateHouseguestCount();


    const logoPreview =
        document.getElementById(
            "season-logo-preview"
        );


    if (logoPreview) {

        logoPreview.classList.add("hidden");

    }

}


/* ---------------------------------------------------------
   Create new season button helper
   --------------------------------------------------------- */

function createNewSeason() {

    resetSeasonCreator();

    showPage("creator-page");

}


/* =========================================================
   HOUSEGUESTS
   ========================================================= */

function addHouseguest(data = null) {

    currentHouseguestId++;


    const id =
        data?.id ||
        `houseguest-${Date.now()}-${currentHouseguestId}`;


    const editor =
        document.getElementById(
            "houseguest-editor"
        );


    if (!editor) {
        return;
    }


    const card =
        document.createElement("div");


    card.className =
        "houseguest-card";


    card.dataset.houseguestId = id;


    const name =
        data?.name || "";


    const image =
        data?.image || "";


    const age =
        data?.age || "";


    const bio =
        data?.bio || "";


    const general =
        data?.ratings?.general ?? 5;


    const physical =
        data?.ratings?.physical ?? 5;


    const mental =
        data?.ratings?.mental ?? 5;


    const social =
        data?.ratings?.social ?? 5;


    const strategic =
        data?.ratings?.strategic ?? 5;


    card.innerHTML = `

        <div class="houseguest-card-header">

            <span class="houseguest-number">
                HOUSEGUEST
            </span>

            <button
                class="remove-houseguest"
                title="Remove houseguest"
                onclick="removeHouseguest('${id}')">
                ×
            </button>

        </div>


        <div
            class="houseguest-image-preview"
            id="preview-${id}">

            ${
                image
                    ? `
                        <img
                            src="${escapeAttribute(image)}"
                            alt="Houseguest photo"
                            onerror="showHouseguestPlaceholder('${id}')">
                      `
                    : `
                        <div class="houseguest-placeholder">
                            👤
                        </div>
                      `
            }

        </div>


        <div class="houseguest-fields">


            <div class="houseguest-field">

                <label>Name</label>

                <input
                    type="text"
                    class="hg-name"
                    placeholder="Houseguest name"
                    value="${escapeAttribute(name)}">

            </div>


            <div class="houseguest-field">

                <label>Photo URL</label>

                <input
                    type="url"
                    class="hg-image"
                    placeholder="https://i.imgur.com/example.jpg"
                    value="${escapeAttribute(image)}"
                    oninput="updateHouseguestImage('${id}', this.value)">

            </div>


            <div class="houseguest-field">

                <label>Age</label>

                <input
                    type="number"
                    class="hg-age"
                    min="18"
                    max="100"
                    placeholder="25"
                    value="${escapeAttribute(age)}">

            </div>


            <div class="houseguest-field">

                <label>Bio</label>

                <input
                    type="text"
                    class="hg-bio"
                    placeholder="Short description"
                    value="${escapeAttribute(bio)}">

            </div>


            <div class="houseguest-field">

                <label>Ratings</label>

                <div class="rating-grid">


                    <div class="rating-field">

                        <input
                            type="number"
                            class="hg-general"
                            min="1"
                            max="10"
                            value="${general}"
                            title="General">

                    </div>


                    <div class="rating-field">

                        <input
                            type="number"
                            class="hg-physical"
                            min="1"
                            max="10"
                            value="${physical}"
                            title="Physical">

                    </div>


                    <div class="rating-field">

                        <input
                            type="number"
                            class="hg-mental"
                            min="1"
                            max="10"
                            value="${mental}"
                            title="Mental">

                    </div>


                    <div class="rating-field">

                        <input
                            type="number"
                            class="hg-social"
                            min="1"
                            max="10"
                            value="${social}"
                            title="Social">

                    </div>


                    <div class="rating-field">

                        <input
                            type="number"
                            class="hg-strategic"
                            min="1"
                            max="10"
                            value="${strategic}"
                            title="Strategic">

                    </div>


                </div>

            </div>


        </div>

    `;


    editor.appendChild(card);


    updateHouseguestCount();

}


/* =========================================================
   REMOVE HOUSEGUEST
   ========================================================= */

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
            "Remove this houseguest from the season?"
        );


    if (!confirmed) {
        return;
    }


    card.remove();


    updateHouseguestCount();

}


/* =========================================================
   UPDATE HOUSEGUEST COUNT
   ========================================================= */

function updateHouseguestCount() {

    const cards =
        document.querySelectorAll(
            "#houseguest-editor .houseguest-card"
        );


    const count =
        document.getElementById(
            "houseguest-count"
        );


    if (count) {

        count.textContent =
            cards.length;

    }

}


/* =========================================================
   HOUSEGUEST IMAGE PREVIEW
   ========================================================= */

function updateHouseguestImage(id, url) {

    const preview =
        document.getElementById(
            `preview-${id}`
        );


    if (!preview) {
        return;
    }


    if (!url.trim()) {

        preview.innerHTML = `

            <div class="houseguest-placeholder">
                👤
            </div>

        `;

        return;
    }


    preview.innerHTML = `

        <img
            src="${escapeAttribute(url.trim())}"
            alt="Houseguest photo"
            onerror="showHouseguestPlaceholder('${id}')">

    `;

}


/* ---------------------------------------------------------
   Broken image fallback
   --------------------------------------------------------- */

function showHouseguestPlaceholder(id) {

    const preview =
        document.getElementById(
            `preview-${id}`
        );


    if (!preview) {
        return;
    }


    preview.innerHTML = `

        <div class="houseguest-placeholder">
            👤
        </div>

    `;

}


/* =========================================================
   SEASON LOGO PREVIEW
   ========================================================= */

function setupSeasonLogoPreview() {

    const input =
        document.getElementById(
            "season-logo"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        updateSeasonLogoPreview
    );

}


/* ---------------------------------------------------------
   Update logo
   --------------------------------------------------------- */

function updateSeasonLogoPreview() {

    const input =
        document.getElementById(
            "season-logo"
        );


    const preview =
        document.getElementById(
            "season-logo-preview"
        );


    const image =
        document.getElementById(
            "season-logo-preview-image"
        );


    if (!input || !preview || !image) {
        return;
    }


    const url =
        input.value.trim();


    if (!url) {

        preview.classList.add("hidden");

        image.src = "";

        return;
    }


    image.src = url;


    image.onload = () => {

        preview.classList.remove("hidden");

    };


    image.onerror = () => {

        preview.classList.add("hidden");

    };

}


/* =========================================================
   BACKGROUND IMAGE PREVIEW / APPLICATION
   ========================================================= */

function setupSeasonBackgroundPreview() {

    const input =
        document.getElementById(
            "season-background"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        updateBackgroundPreview
    );

}


/* ---------------------------------------------------------
   Apply background
   --------------------------------------------------------- */

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


    if (!url) {

        document.body.style.backgroundImage =
            "";

        return;

    }


    /*
        We don't permanently apply the image
        to the whole site yet.

        This preview simply lets us verify
        that the URL is being accepted.
    */

}


/* =========================================================
   COLLECT HOUSEGUEST DATA
   ========================================================= */

function collectHouseguests() {

    const cards =
        document.querySelectorAll(
            "#houseguest-editor .houseguest-card"
        );


    const houseguests = [];


    cards.forEach(card => {

        const houseguest = {

            id:
                card.dataset.houseguestId,

            name:
                card.querySelector(
                    ".hg-name"
                )?.value.trim() || "",

            image:
                card.querySelector(
                    ".hg-image"
                )?.value.trim() || "",

            age:
                card.querySelector(
                    ".hg-age"
                )?.value || "",

            bio:
                card.querySelector(
                    ".hg-bio"
                )?.value.trim() || "",

            ratings: {

                general:
                    getRatingValue(
                        card,
                        ".hg-general"
                    ),

                physical:
                    getRatingValue(
                        card,
                        ".hg-physical"
                    ),

                mental:
                    getRatingValue(
                        card,
                        ".hg-mental"
                    ),

                social:
                    getRatingValue(
                        card,
                        ".hg-social"
                    ),

                strategic:
                    getRatingValue(
                        card,
                        ".hg-strategic"
                    )

            },

            status: "active",

            placement: null,

            weeksPlayed: 0,

            competitionWins: 0,

            hohWins: 0,

            vetoWins: 0,

            nominations: 0,

            evictionVotesReceived: 0

        };


        houseguests.push(houseguest);

    });


    return houseguests;

}


/* ---------------------------------------------------------
   Rating helper
   --------------------------------------------------------- */

function getRatingValue(card, selector) {

    const input =
        card.querySelector(selector);


    if (!input) {
        return 5;
    }


    let value =
        parseInt(input.value, 10);


    if (Number.isNaN(value)) {
        value = 5;
    }


    value =
        Math.max(
            1,
            Math.min(10, value)
        );


    return value;

}


/* =========================================================
   SAVE SEASON
   ========================================================= */

function saveSeason() {

    const name =
        document.getElementById(
            "season-name"
        )?.value.trim();


    const theme =
        document.getElementById(
            "season-theme"
        )?.value.trim();


    const description =
        document.getElementById(
            "season-description"
        )?.value.trim();


    const logo =
        document.getElementById(
            "season-logo"
        )?.value.trim();


    const background =
        document.getElementById(
            "season-background"
        )?.value.trim();


    /*
        Basic validation
    */

    if (!name) {

        alert(
            "Please enter a name for your season."
        );

        return;

    }


    const houseguests =
        collectHouseguests();


    if (houseguests.length === 0) {

        alert(
            "Please add at least one houseguest."
        );

        return;

    }


    /*
        Build season object
    */

    const season = {

        id:
            editingSeasonId ||
            `season-${Date.now()}`,

        name,

        theme,

        description,

        logo,

        background,

        houseguests,

        /*
            These will be expanded later.
        */

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

        rules: {

            finalists: 2,

            jurySize: 7,

            vetoEnabled: true,

            safetyCompetitionEnabled: false,

            battleBackEnabled: false,

            doubleEvictionEnabled: false

        },

        /*
            Simulation state
        */

        simulation: {

            started: false,

            completed: false,

            currentWeek: 1,

            currentPhase: "setup",

            history: [],

            finalPlacements: [],

            winner: null,

            runnerUp: null

        },

        createdAt:
            editingSeasonId
                ? findSeason(editingSeasonId)?.createdAt ||
                  new Date().toISOString()
                : new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };


    /*
        Update existing season
        or create new one.
    */

    if (editingSeasonId) {

        const index =
            savedSeasons.findIndex(
                savedSeason =>
                    savedSeason.id === editingSeasonId
            );


        if (index !== -1) {

            savedSeasons[index] =
                season;

        } else {

            savedSeasons.push(season);

        }

    } else {

        savedSeasons.push(season);

    }


    /*
        Save to localStorage
    */

    const success =
        saveSeasonsToStorage();


    if (!success) {
        return;
    }


    currentSeason =
        season;


    editingSeasonId = null;


    renderSavedSeasons();


    alert(
        `"${season.name}" has been saved!`
    );


    showPage("home-page");

}


/* =========================================================
   FIND SEASON
   ========================================================= */

function findSeason(id) {

    return savedSeasons.find(
        season => season.id === id
    ) || null;

}


/* =========================================================
   OPEN SEASON
   ========================================================= */

function openSeason(id) {

    const season =
        findSeason(id);


    if (!season) {

        alert(
            "That season could not be found."
        );

        return;

    }


    currentSeason =
        season;


    /*
        For now, opening a season takes
        us to the simulator.

        The real simulation engine will
        be connected here later.
    */

    loadSeasonIntoSimulator(
        season
    );


    showPage(
        "simulator-page"
    );

}


/* =========================================================
   EDIT SEASON
   ========================================================= */

function editSeason(id) {

    const season =
        findSeason(id);


    if (!season) {

        alert(
            "That season could not be found."
        );

        return;

    }


    editingSeasonId =
        season.id;


    currentSeason =
        season;


    /*
        Load season information
    */

    document.getElementById(
        "season-name"
    ).value =
        season.name || "";


    document.getElementById(
        "season-theme"
    ).value =
        season.theme || "";


    document.getElementById(
        "season-description"
    ).value =
        season.description || "";


    document.getElementById(
        "season-logo"
    ).value =
        season.logo || "";


    document.getElementById(
        "season-background"
    ).value =
        season.background || "";


    /*
        Clear existing cast
    */

    const editor =
        document.getElementById(
            "houseguest-editor"
        );


    editor.innerHTML = "";


    /*
        Load houseguests
    */

    if (
        Array.isArray(
            season.houseguests
        )
    ) {

        season.houseguests.forEach(
            houseguest => {

                addHouseguest(
                    houseguest
                );

            }
        );

    }


    updateHouseguestCount();


    updateSeasonLogoPreview();


    showPage(
        "creator-page"
    );

}


/* =========================================================
   DELETE SEASON
   ========================================================= */

function deleteSeason(id) {

    const season =
        findSeason(id);


    if (!season) {
        return;
    }


    const confirmed =
        confirm(
            `Are you sure you want to delete "${season.name}"? This cannot be undone.`
        );


    if (!confirmed) {
        return;
    }


    savedSeasons =
        savedSeasons.filter(
            savedSeason =>
                savedSeason.id !== id
        );


    saveSeasonsToStorage();


    renderSavedSeasons();


    if (
        currentSeason &&
        currentSeason.id === id
    ) {

        currentSeason = null;

    }

}


/* =========================================================
   LOAD SEASON INTO SIMULATOR
   ========================================================= */

function loadSeasonIntoSimulator(
    season
) {

    const seasonName =
        document.getElementById(
            "simulator-season-name"
        );


    const seasonTheme =
        document.getElementById(
            "simulator-season-theme"
        );


    const currentWeek =
        document.getElementById(
            "current-week"
        );


    const currentHoh =
        document.getElementById(
            "current-hoh"
        );


    const currentNominees =
        document.getElementById(
            "current-nominees"
        );


    const currentVeto =
        document.getElementById(
            "current-veto"
        );


    if (seasonName) {

        seasonName.textContent =
            season.name ||
            "Big Brother";

    }


    if (seasonTheme) {

        seasonTheme.textContent =
            season.theme ||
            "Season Simulation";

    }


    if (currentWeek) {

        currentWeek.textContent =
            season.simulation?.currentWeek ||
            1;

    }


    if (currentHoh) {

        currentHoh.textContent =
            "—";

    }


    if (currentNominees) {

        currentNominees.textContent =
            "—";

    }


    if (currentVeto) {

        currentVeto.textContent =
            "—";

    }


    /*
        Reset event display
    */

    const eventType =
        document.getElementById(
            "event-type"
        );


    const eventTitle =
        document.getElementById(
            "event-title"
        );


    const eventContent =
        document.getElementById(
            "event-content"
        );


    if (eventType) {

        eventType.textContent =
            "SEASON READY";

    }


    if (eventTitle) {

        eventTitle.textContent =
            `${season.name} is ready to begin`;

    }


    if (eventContent) {

        eventContent.innerHTML = `

            <p>
                ${season.houseguests.length}
                houseguests are ready to enter the game.
            </p>

        `;

    }

}


/* =========================================================
   BASIC SIMULATION PLACEHOLDER
   ========================================================= */

function runNextEvent() {

    if (!currentSeason) {

        alert(
            "Please open a season first."
        );

        return;

    }


    /*
        The actual simulation engine will
        replace this function later.

        For now, we simply demonstrate
        the event chain.
    */

    const phases = [

        {
            type: "HEAD OF HOUSEHOLD",
            title: "The Houseguests are competing for HOH!",
            content:
                "The HOH competition engine will be connected here."
        },

        {
            type: "NOMINATIONS",
            title: "It's time for the nomination ceremony.",
            content:
                "The nomination engine will determine the nominees."
        },

        {
            type: "POV PLAYERS",
            title: "The Power of Veto players are selected.",
            content:
                "The POV selection engine will determine who competes."
        },

        {
            type: "POWER OF VETO",
            title: "The Power of Veto competition begins!",
            content:
                "The POV competition engine will determine the winner."
        },

        {
            type: "VETO CEREMONY",
            title: "It's time for the Veto Ceremony.",
            content:
                "The veto decision engine will determine whether the veto is used."
        },

        {
            type: "EVICTION",
            title: "It's eviction night!",
            content:
                "The eviction and voting engine will determine who leaves."
        }

    ];


    if (
        !currentSeason.simulation
    ) {

        currentSeason.simulation = {

            started: true,

            completed: false,

            currentWeek: 1,

            currentPhase: "hoh",

            history: [],

            finalPlacements: [],

            winner: null,

            runnerUp: null

        };

    }


    let phaseIndex =
        phases.findIndex(
            phase =>
                phase.type ===
                currentSeason.simulation.currentPhase
                    ?.toUpperCase()
        );


    if (phaseIndex === -1) {

        phaseIndex = 0;

    }


    const phase =
        phases[phaseIndex];


    const eventType =
        document.getElementById(
            "event-type"
        );


    const eventTitle =
        document.getElementById(
            "event-title"
        );


    const eventContent =
        document.getElementById(
            "event-content"
        );


    if (eventType) {

        eventType.textContent =
            phase.type;

    }


    if (eventTitle) {

        eventTitle.textContent =
            phase.title;

    }


    if (eventContent) {

        eventContent.innerHTML = `

            <p>
                ${phase.content}
            </p>

        `;

    }


    /*
        Advance placeholder phase
    */

    const nextPhase =
        phases[
            (phaseIndex + 1) %
            phases.length
        ];


    currentSeason.simulation.currentPhase =
        nextPhase.type.toLowerCase();


    /*
        Once we reach eviction,
        eventually this will increment
        the week.

        The real engine will replace
        this behavior.
    */

    if (
        phase.type === "EVICTION"
    ) {

        currentSeason.simulation.currentWeek++;

        const week =
            document.getElementById(
                "current-week"
            );


        if (week) {

            week.textContent =
                currentSeason.simulation.currentWeek;

        }

    }


    saveCurrentSeasonState();

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


    saveSeasonsToStorage();

}


/* =========================================================
   RESULTS PLACEHOLDER
   ========================================================= */

function showResults() {

    if (!currentSeason) {
        return;
    }


    const resultsName =
        document.getElementById(
            "results-season-name"
        );


    if (resultsName) {

        resultsName.textContent =
            currentSeason.name;

    }


    const winner =
        document.getElementById(
            "winner-name"
        );


    if (winner) {

        winner.textContent =
            currentSeason.simulation?.winner ||
            "Winner will appear here";

    }


    showPage(
        "results-page"
    );

}


/* =========================================================
   SCROLL TO SAVED SEASONS
   ========================================================= */

function scrollToSavedSeasons() {

    showPage("home-page");


    setTimeout(() => {

        const section =
            document.getElementById(
                "saved-seasons"
            );


        if (section) {

            section.scrollIntoView({
                behavior: "smooth"
            });

        }

    }, 50);

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


    modal.classList.remove(
        "hidden"
    );

}


function closeModal(event) {

    if (
        event &&
        event.target &&
        event.target.id !== "modal"
    ) {

        return;

    }


    const modal =
        document.getElementById(
            "modal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* ---------------------------------------------------------
   Attribute escaping
   --------------------------------------------------------- */

function escapeAttribute(value) {

    return escapeHTML(value);

}


/* =========================================================
   DEBUGGING HELPERS
   ========================================================= */

/*
    These functions are intentionally exposed
    globally so they can be used from the
    HTML buttons.
*/


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

window.openSeason =
    openSeason;

window.editSeason =
    editSeason;

window.deleteSeason =
    deleteSeason;

window.runNextEvent =
    runNextEvent;

window.showResults =
    showResults;

window.scrollToSavedSeasons =
    scrollToSavedSeasons;

window.openModal =
    openModal;

window.closeModal =
    closeModal;


/* =========================================================
   DEVELOPMENT MESSAGE
   ========================================================= */

console.log(
    "Big Brother Simulator initialized."
);

console.log(
    `Saved seasons: ${savedSeasons.length}`
);