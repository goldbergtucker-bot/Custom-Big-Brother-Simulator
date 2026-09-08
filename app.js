/*
 * =========================================================
 * BIG BROTHER SIMULATOR
 * APP CONTROLLER
 * =========================================================
 *
 * Version: 0.2
 *
 * Current systems:
 * - Home page
 * - Season creation
 * - Season editing
 * - Season deletion
 * - LocalStorage persistence
 * - Houseguest editor
 * - Houseguest photos
 * - Houseguest ratings
 * - Season logo preview
 * - Season background preview
 * - Basic simulator framework
 * - BrantSteele-style event chain foundation
 *
 * Future systems:
 * - Season rules
 * - Relationships
 * - Alliances
 * - Competitions
 * - Twists
 * - Full simulation engine
 * - Jury voting
 * - End-of-season statistics
 */


/* =========================================================
   GLOBAL CONSTANTS
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
        title: "Head of Household"
    },
    {
        id: "nominations",
        label: "Nominations",
        title: "Nomination Ceremony"
    },
    {
        id: "pov-players",
        label: "POV Players",
        title: "Power of Veto Players"
    },
    {
        id: "pov",
        label: "POV",
        title: "Power of Veto Competition"
    },
    {
        id: "veto-ceremony",
        label: "Veto Ceremony",
        title: "Veto Ceremony"
    },
    {
        id: "eviction",
        label: "Eviction",
        title: "Eviction"
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

    loadSeasonsFromStorage();

    renderSavedSeasons();

    setupSeasonLogoPreview();

    setupSeasonBackgroundPreview();

    updateHouseguestCount();

    setupImageErrorHandling();

});


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function showPage(pageId) {

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        page.classList.remove("active-page");
    });


    const targetPage = document.getElementById(pageId);

    if (!targetPage) {
        console.warn(`Page not found: ${pageId}`);
        return;
    }


    targetPage.classList.add("active-page");

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
            "The season could not be saved. Your browser may have local storage disabled or full."
        );
    }
}


/* =========================================================
   SAVED SEASONS
   ========================================================= */

function renderSavedSeasons() {

    const container =
        document.getElementById(
            "saved-seasons-container"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (savedSeasons.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <h3>No Saved Seasons Yet</h3>

                <p>
                    Create your first custom Big Brother
                    season to get started.
                </p>

                <button
                    class="primary-button"
                    type="button"
                    onclick="createNewSeason()"
                >
                    Create Your First Season
                </button>
            </div>
        `;

        return;
    }


    savedSeasons.forEach(season => {

        container.appendChild(
            createSeasonCard(season)
        );

    });
}


function createSeasonCard(season) {

    const card =
        document.createElement("div");

    card.className = "season-card";


    const houseguestCount =
        Array.isArray(season.houseguests)
            ? season.houseguests.length
            : 0;


    const logo =
        season.logo
            ? `
                <img
                    src="${escapeAttribute(season.logo)}"
                    alt="${escapeAttribute(season.name || "Season logo")}"
                    onerror="this.style.display='none'"
                >
            `
            : "";


    card.innerHTML = `

        <div class="season-card-image">

            ${
                logo ||
                `<span style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    width:100%;
                    height:100%;
                    color:#555a67;
                    font-size:12px;
                    font-weight:800;
                ">
                    NO LOGO
                </span>`
            }

        </div>


        <div class="season-card-body">

            <h3>
                ${escapeHTML(
                    season.name || "Unnamed Season"
                )}
            </h3>


            <p>
                ${
                    escapeHTML(
                        season.theme || "Custom Season"
                    )
                }
            </p>


            <p>
                ${houseguestCount} Houseguest${
                    houseguestCount === 1 ? "" : "s"
                }
            </p>


            <div class="season-card-actions">

                <button
                    type="button"
                    onclick="openSeason('${escapeAttribute(season.id)}')"
                >
                    Simulate
                </button>

                <button
                    type="button"
                    onclick="editSeason('${escapeAttribute(season.id)}')"
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="deleteSeason('${escapeAttribute(season.id)}')"
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


/* =========================================================
   RESET SEASON CREATOR
   ========================================================= */

function resetSeasonCreator() {

    const nameInput =
        document.getElementById("season-name");

    const themeInput =
        document.getElementById("season-theme");

    const descriptionInput =
        document.getElementById("season-description");

    const logoInput =
        document.getElementById("season-logo");

    const backgroundInput =
        document.getElementById("season-background");

    const editor =
        document.getElementById("houseguest-editor");


    if (nameInput) {
        nameInput.value = "";
    }

    if (themeInput) {
        themeInput.value = "";
    }

    if (descriptionInput) {
        descriptionInput.value = "";
    }

    if (logoInput) {
        logoInput.value = "";
    }

    if (backgroundInput) {
        backgroundInput.value = "";
    }


    if (editor) {
        editor.innerHTML = "";
    }


    currentHouseguestId = 0;

    updateHouseguestCount();

    updateSeasonLogoPreview();

    updateBackgroundPreview();

}


/* =========================================================
   HOUSEGUEST EDITOR
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


    const id = currentHouseguestId;


    const houseguest =
        data || createDefaultHouseguest();


    const card =
        document.createElement("div");


    card.className = "houseguest-card";

    card.dataset.houseguestId = id;


    const imageUrl =
        houseguest.image ||
        houseguest.photo ||
        "";


    card.innerHTML = `

        <!-- =========================================
             CARD HEADER
             ========================================= -->

        <div class="houseguest-card-header">

            <div class="houseguest-card-title">

                <span class="houseguest-number">
                    ${editor.children.length + 1}
                </span>

                <h3>
                    Houseguest
                </h3>

            </div>


            <button
                class="remove-houseguest-button"
                type="button"
                onclick="removeHouseguest(${id})"
            >
                Remove
            </button>

        </div>


        <!-- =========================================
             PHOTO + URL
             ========================================= -->

        <div class="houseguest-photo-section">

            <div
                class="houseguest-photo-preview"
                id="houseguest-photo-preview-${id}"
            >

                ${
                    imageUrl
                    ?
                    `
                        <img
                            src="${escapeAttribute(imageUrl)}"
                            alt="Houseguest photo"
                            onerror="showHouseguestPlaceholder(${id})"
                        >
                    `
                    :
                    `
                        <div class="houseguest-photo-placeholder">
                            PHOTO
                        </div>
                    `
                }

            </div>


            <div class="houseguest-basic-info">

                <div class="form-group">

                    <label for="houseguest-name-${id}">
                        Name
                    </label>

                    <input
                        type="text"
                        id="houseguest-name-${id}"
                        class="houseguest-name"
                        placeholder="Houseguest name"
                        value="${escapeAttribute(
                            houseguest.name || ""
                        )}"
                    >

                </div>


                <div class="form-group">

                    <label for="houseguest-age-${id}">
                        Age
                    </label>

                    <input
                        type="number"
                        id="houseguest-age-${id}"
                        class="houseguest-age"
                        min="18"
                        max="100"
                        placeholder="Age"
                        value="${escapeAttribute(
                            houseguest.age ?? ""
                        )}"
                    >

                </div>


                <div class="form-group form-group-full">

                    <label for="houseguest-occupation-${id}">
                        Occupation
                    </label>

                    <input
                        type="text"
                        id="houseguest-occupation-${id}"
                        class="houseguest-occupation"
                        placeholder="Example: Teacher"
                        value="${escapeAttribute(
                            houseguest.occupation || ""
                        )}"
                    >

                </div>


                <div class="form-group form-group-full">

                    <label for="houseguest-image-${id}">
                        Photo URL
                    </label>

                    <input
                        type="url"
                        id="houseguest-image-${id}"
                        class="houseguest-image"
                        placeholder="https://i.imgur.com/example.jpg"
                        value="${escapeAttribute(
                            imageUrl
                        )}"
                        oninput="updateHouseguestImage(${id}, this.value)"
                    >

                </div>

            </div>

        </div>


        <!-- =========================================
             BIO
             ========================================= -->

        <div class="form-group">

            <label for="houseguest-bio-${id}">
                Bio
            </label>

            <textarea
                id="houseguest-bio-${id}"
                class="houseguest-bio"
                rows="4"
                placeholder="Tell us about this houseguest..."
            >${escapeHTML(
                houseguest.bio || ""
            )}</textarea>

        </div>


        <!-- =========================================
             RATINGS
             ========================================= -->

        <div class="houseguest-ratings">

            <div class="houseguest-ratings-title">
                Game Ratings
            </div>


            <div class="ratings-grid">

                ${createRatingInput(
                    id,
                    "general",
                    "General",
                    houseguest.ratings?.general ??
                    houseguest.general ??
                    5
                )}

                ${createRatingInput(
                    id,
                    "physical",
                    "Physical",
                    houseguest.ratings?.physical ??
                    houseguest.physical ??
                    5
                )}

                ${createRatingInput(
                    id,
                    "mental",
                    "Mental",
                    houseguest.ratings?.mental ??
                    houseguest.mental ??
                    5
                )}

                ${createRatingInput(
                    id,
                    "social",
                    "Social",
                    houseguest.ratings?.social ??
                    houseguest.social ??
                    5
                )}

                ${createRatingInput(
                    id,
                    "strategic",
                    "Strategic",
                    houseguest.ratings?.strategic ??
                    houseguest.strategic ??
                    5
                )}

            </div>

        </div>

    `;


    editor.appendChild(card);


    updateHouseguestNumbers();

    updateHouseguestCount();


    if (imageUrl) {
        updateHouseguestImage(
            id,
            imageUrl
        );
    }

}


function createDefaultHouseguest() {

    return {

        name: "",

        age: "",

        occupation: "",

        bio: "",

        image: "",

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

    const safeValue =
        Number.isFinite(Number(value))
            ? Math.max(
                1,
                Math.min(10, Number(value))
            )
            : 5;


    return `

        <div class="rating-group">

            <label
                for="houseguest-${key}-${id}"
            >
                ${escapeHTML(label)}
            </label>

            <input
                type="number"
                id="houseguest-${key}-${id}"
                class="rating-${key}"
                min="1"
                max="10"
                step="1"
                value="${safeValue}"
            >

        </div>

    `;
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


    card.remove();

    updateHouseguestNumbers();

    updateHouseguestCount();

}


/* =========================================================
   HOUSEGUEST NUMBERS
   ========================================================= */

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
                index + 1;
        }

    });
}


/* =========================================================
   HOUSEGUEST COUNT
   ========================================================= */

function updateHouseguestCount() {

    const countElement =
        document.getElementById(
            "houseguest-count"
        );


    const editor =
        document.getElementById(
            "houseguest-editor"
        );


    if (!countElement || !editor) {
        return;
    }


    const count =
        editor.querySelectorAll(
            ".houseguest-card"
        ).length;


    countElement.textContent = count;

}


/* =========================================================
   HOUSEGUEST IMAGE
   ========================================================= */

function updateHouseguestImage(
    id,
    url
) {

    const preview =
        document.getElementById(
            `houseguest-photo-preview-${id}`
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
            src="${escapeAttribute(cleanUrl)}"
            alt="Houseguest photo"
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

        <div class="houseguest-photo-placeholder">
            PHOTO
        </div>

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


    cards.forEach(card => {

        const id =
            card.dataset.houseguestId;


        const name =
            card.querySelector(
                ".houseguest-name"
            )?.value.trim() || "";


        const ageRaw =
            card.querySelector(
                ".houseguest-age"
            )?.value;


        const age =
            ageRaw === ""
                ? ""
                : Number(ageRaw);


        const occupation =
            card.querySelector(
                ".houseguest-occupation"
            )?.value.trim() || "";


        const bio =
            card.querySelector(
                ".houseguest-bio"
            )?.value.trim() || "";


        const image =
            card.querySelector(
                ".houseguest-image"
            )?.value.trim() || "";


        const ratings = {};


        STAT_KEYS.forEach(stat => {

            ratings[stat] =
                getRatingValue(
                    card,
                    `.rating-${stat}`
                );

        });


        houseguests.push({

            id: `hg-${id}`,

            name,

            age,

            occupation,

            bio,

            image,

            ratings

        });

    });


    return houseguests;
}


/* =========================================================
   RATING HELPER
   ========================================================= */

function getRatingValue(
    card,
    selector
) {

    const input =
        card.querySelector(selector);


    if (!input) {
        return 5;
    }


    let value =
        Number(input.value);


    if (!Number.isFinite(value)) {
        value = 5;
    }


    value =
        Math.max(
            1,
            Math.min(
                10,
                Math.round(value)
            )
        );


    input.value = value;


    return value;
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


function updateSeasonLogoPreview() {

    const input =
        document.getElementById(
            "season-logo"
        );


    const image =
        document.getElementById(
            "season-logo-preview-image"
        );


    const container =
        document.getElementById(
            "season-logo-preview"
        );


    if (!input || !image || !container) {
        return;
    }


    const url =
        input.value.trim();


    const box =
        container.querySelector(
            ".image-preview-box"
        );


    if (!box) {
        return;
    }


    if (!url) {

        image.style.display = "none";

        let placeholder =
            box.querySelector(
                ".preview-placeholder"
            );


        if (!placeholder) {

            placeholder =
                document.createElement(
                    "span"
                );

            placeholder.className =
                "preview-placeholder";

            box.appendChild(
                placeholder
            );
        }


        placeholder.textContent =
            "Enter a logo URL above";

        return;
    }


    image.src = url;

    image.style.display = "block";


    const placeholder =
        box.querySelector(
            ".preview-placeholder"
        );


    if (placeholder) {
        placeholder.remove();
    }


    image.onerror = () => {

        image.style.display = "none";


        let errorMessage =
            box.querySelector(
                ".preview-placeholder"
            );


        if (!errorMessage) {

            errorMessage =
                document.createElement(
                    "span"
                );

            errorMessage.className =
                "preview-placeholder";

            box.appendChild(
                errorMessage
            );

        }


        errorMessage.textContent =
            "Unable to load logo";
    };

}


/* =========================================================
   BACKGROUND PREVIEW
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
        document.body.style.backgroundImage = "";
        return;
    }


    /*
     * We don't permanently apply the background here.
     * This is simply a live preview while editing.
     */

    const page =
        document.getElementById(
            "creator-page"
        );


    if (!page) {
        return;
    }


    page.style.backgroundImage =
        `linear-gradient(
            rgba(16,17,22,0.94),
            rgba(16,17,22,0.97)
        ), url("${url}")`;

    page.style.backgroundSize = "cover";

    page.style.backgroundAttachment =
        "fixed";

}


/* =========================================================
   SAVE SEASON
   ========================================================= */

function saveSeason() {

    const nameInput =
        document.getElementById(
            "season-name"
        );


    const themeInput =
        document.getElementById(
            "season-theme"
        );


    const descriptionInput =
        document.getElementById(
            "season-description"
        );


    const logoInput =
        document.getElementById(
            "season-logo"
        );


    const backgroundInput =
        document.getElementById(
            "season-background"
        );


    const name =
        nameInput?.value.trim() || "";


    const theme =
        themeInput?.value.trim() || "";


    const description =
        descriptionInput?.value.trim() || "";


    const logo =
        logoInput?.value.trim() || "";


    const background =
        backgroundInput?.value.trim() || "";


    if (!name) {

        alert(
            "Please enter a season name."
        );


        nameInput?.focus();

        return;
    }


    const houseguests =
        collectHouseguests();


    if (houseguests.length < 2) {

        alert(
            "Please add at least 2 houseguests."
        );

        return;
    }


    const now =
        new Date().toISOString();


    let season;


    /*
     * UPDATE EXISTING SEASON
     */

    if (editingSeasonId) {

        const existing =
            findSeason(editingSeasonId);


        if (!existing) {

            alert(
                "The season you were editing could not be found."
            );

            editingSeasonId = null;

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

            updatedAt: now

        };


        const index =
            savedSeasons.findIndex(
                item =>
                    item.id === editingSeasonId
            );


        if (index !== -1) {
            savedSeasons[index] =
                season;
        }

    }


    /*
     * CREATE NEW SEASON
     */

    else {

        season = {

            id: createSeasonId(),

            name,

            theme,

            description,

            logo,

            background,

            houseguests,


            /*
             * These systems will be populated
             * in upcoming development stages.
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


            simulation: {

                started: false,

                completed: false,

                currentWeek: 1,

                currentPhase: "setup",

                currentEventIndex: 0,

                history: [],

                finalPlacements: [],

                winner: null,

                runnerUp: null

            },


            createdAt: now,

            updatedAt: now

        };


        savedSeasons.push(season);

    }


    saveSeasonsToStorage();

    renderSavedSeasons();


    editingSeasonId = null;

    currentSeason = season;


    alert(
        "Season saved successfully!"
    );


    showPage("home-page");

}


/* =========================================================
   CREATE UNIQUE SEASON ID
   ========================================================= */

function createSeasonId() {

    return (
        "season-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );

}


/* =========================================================
   FIND SEASON
   ========================================================= */

function findSeason(id) {

    return savedSeasons.find(
        season =>
            season.id === id
    );

}


/* =========================================================
   OPEN SEASON
   ========================================================= */

function openSeason(id) {

    const season =
        findSeason(id);


    if (!season) {

        alert(
            "Season could not be found."
        );

        return;
    }


    currentSeason = season;


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
            "Season could not be found."
        );

        return;
    }


    editingSeasonId = season.id;


    /*
     * Load basic season information
     */

    const nameInput =
        document.getElementById(
            "season-name"
        );


    const themeInput =
        document.getElementById(
            "season-theme"
        );


    const descriptionInput =
        document.getElementById(
            "season-description"
        );


    const logoInput =
        document.getElementById(
            "season-logo"
        );


    const backgroundInput =
        document.getElementById(
            "season-background"
        );


    if (nameInput) {
        nameInput.value =
            season.name || "";
    }


    if (themeInput) {
        themeInput.value =
            season.theme || "";
    }


    if (descriptionInput) {
        descriptionInput.value =
            season.description || "";
    }


    if (logoInput) {
        logoInput.value =
            season.logo || "";
    }


    if (backgroundInput) {
        backgroundInput.value =
            season.background || "";
    }


    /*
     * Clear current houseguest editor
     */

    const editor =
        document.getElementById(
            "houseguest-editor"
        );


    if (editor) {
        editor.innerHTML = "";
    }


    currentHouseguestId = 0;


    /*
     * Rebuild the cast
     */

    const houseguests =
        Array.isArray(
            season.houseguests
        )
            ? season.houseguests
            : [];


    houseguests.forEach(
        houseguest => {

            addHouseguest(
                houseguest
            );

        }
    );


    updateHouseguestCount();

    updateSeasonLogoPreview();

    updateBackgroundPreview();


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
            "Season";

    }


    if (seasonTheme) {

        seasonTheme.textContent =
            season.theme ||
            "Custom Big Brother Season";

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


    resetSimulationChain();


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
            "WEEK 1";
    }


    if (eventTitle) {
        eventTitle.textContent =
            "Ready to Begin";
    }


    if (eventContent) {

        const count =
            season.houseguests?.length ||
            0;


        eventContent.innerHTML = `

            <p>
                ${escapeHTML(
                    season.name ||
                    "Your season"
                )}
                is ready to simulate.
            </p>

            <p style="
                margin-top:10px;
                color:#666c79;
            ">
                ${count} houseguests are currently in the cast.
            </p>

        `;

    }


    if (
        season.background &&
        typeof season.background === "string"
    ) {

        document.body.style.backgroundImage =
            `linear-gradient(
                rgba(16,17,22,0.95),
                rgba(16,17,22,0.98)
            ), url("${season.background}")`;

        document.body.style.backgroundSize =
            "cover";

        document.body.style.backgroundAttachment =
            "fixed";

    }

}


/* =========================================================
   SIMULATION CHAIN
   ========================================================= */

function resetSimulationChain() {

    const steps =
        document.querySelectorAll(
            ".chain-step"
        );


    steps.forEach(
        (step, index) => {

            step.classList.remove(
                "active",
                "completed"
            );


            if (index === 0) {

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

        alert(
            "Please open a season before starting the simulation."
        );

        return;
    }


    if (!currentSeason.simulation) {

        currentSeason.simulation = {

            started: false,

            completed: false,

            currentWeek: 1,

            currentPhase: "setup",

            currentEventIndex: 0,

            history: [],

            finalPlacements: [],

            winner: null,

            runnerUp: null

        };

    }


    const simulation =
        currentSeason.simulation;


    simulation.started = true;


    let eventIndex =
        Number(
            simulation.currentEventIndex
        );


    if (
        !Number.isFinite(eventIndex) ||
        eventIndex < 0
    ) {
        eventIndex = 0;
    }


    const event =
        EVENT_CHAIN[eventIndex];


    if (!event) {

        showResults();

        return;
    }


    displaySimulationEvent(
        event
    );


    markChainStep(
        eventIndex
    );


    /*
     * Move to the next event.
     *
     * This is intentionally only the
     * framework for now.
     *
     * The real decision-making engine
     * will be added after we build:
     *
     * - relationships
     * - alliances
     * - rules
     * - competitions
     * - twists
     */

    simulation.currentPhase =
        event.id;


    simulation.currentEventIndex =
        eventIndex + 1;


    if (
        event.id === "eviction"
    ) {

        /*
         * For now, advance the week
         * without actually eliminating
         * someone.
         *
         * This will be replaced by the
         * real simulation engine.
         */

        simulation.currentWeek =
            Number(
                simulation.currentWeek || 1
            ) + 1;


        simulation.currentEventIndex =
            0;


        simulation.currentPhase =
            "hoh";


        const currentWeek =
            document.getElementById(
                "current-week"
            );


        if (currentWeek) {

            currentWeek.textContent =
                simulation.currentWeek;

        }


        setTimeout(() => {

            resetSimulationChain();

        }, 100);

    }


    saveCurrentSeasonState();

}


/* =========================================================
   DISPLAY SIMULATION EVENT
   ========================================================= */

function displaySimulationEvent(
    event
) {

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
            `WEEK ${
                currentSeason.simulation?.currentWeek ||
                1
            }`;

    }


    if (eventTitle) {

        eventTitle.textContent =
            event.title;

    }


    if (!eventContent) {
        return;
    }


    const houseguestCount =
        currentSeason.houseguests?.length ||
        0;


    let message = "";


    switch (event.id) {

        case "hoh":

            message = `
                <p>
                    The Head of Household competition
                    is ready to begin.
                </p>

                <p style="
                    margin-top:10px;
                    color:#666c79;
                ">
                    ${houseguestCount} houseguests
                    are competing.
                </p>
            `;

            break;


        case "nominations":

            message = `
                <p>
                    The HOH will nominate two
                    houseguests for eviction.
                </p>

                <p style="
                    margin-top:10px;
                    color:#666c79;
                ">
                    Nomination logic will be controlled
                    by relationships, alliances, strategy,
                    and houseguest ratings.
                </p>
            `;

            break;


        case "pov-players":

            message = `
                <p>
                    The Power of Veto players
                    will now be selected.
                </p>
            `;

            break;


        case "pov":

            message = `
                <p>
                    The Power of Veto competition
                    is ready to begin.
                </p>

                <p style="
                    margin-top:10px;
                    color:#666c79;
                ">
                    Competition outcomes will eventually
                    use the custom competition system
                    and houseguest ratings.
                </p>
            `;

            break;


        case "veto-ceremony":

            message = `
                <p>
                    The Power of Veto ceremony
                    is now taking place.
                </p>

                <p style="
                    margin-top:10px;
                    color:#666c79;
                ">
                    The veto holder will eventually
                    decide whether to use the veto.
                </p>
            `;

            break;


        case "eviction":

            message = `
                <p>
                    The house is ready for the
                    eviction vote.
                </p>

                <p style="
                    margin-top:10px;
                    color:#666c79;
                ">
                    Voting logic will eventually be
                    determined by relationships,
                    alliances, nominations, and strategy.
                </p>
            `;

            break;


        default:

            message = `
                <p>
                    The next event is ready.
                </p>
            `;

    }


    eventContent.innerHTML =
        message;

}


/* =========================================================
   MARK CHAIN STEP
   ========================================================= */

function markChainStep(
    currentIndex
) {

    const steps =
        document.querySelectorAll(
            ".chain-step"
        );


    steps.forEach(
        (step, index) => {

            step.classList.remove(
                "active",
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


    currentSeason.updatedAt =
        new Date().toISOString();


    savedSeasons[index] =
        currentSeason;


    saveSeasonsToStorage();

}


/* =========================================================
   RESULTS
   ========================================================= */

function showResults() {

    if (!currentSeason) {
        return;
    }


    const resultsName =
        document.getElementById(
            "results-season-name"
        );


    const winnerName =
        document.getElementById(
            "winner-name"
        );


    if (resultsName) {

        resultsName.textContent =
            currentSeason.name ||
            "Season";

    }


    if (winnerName) {

        winnerName.textContent =
            currentSeason.simulation?.winner ||
            "Simulation not yet completed";

    }


    const placements =
        document.getElementById(
            "final-placements"
        );


    if (placements) {

        placements.innerHTML = `

            <div class="empty-state">

                <h3>
                    Final Results Coming Soon
                </h3>

                <p>
                    The full simulation engine will
                    generate placements, eviction history,
                    jury votes, competition statistics,
                    alliance history, and more.
                </p>

            </div>

        `;

    }


    const statistics =
        document.getElementById(
            "season-statistics"
        );


    if (statistics) {

        statistics.innerHTML = `

            <div class="stat-card">

                <strong>
                    Houseguests
                </strong>

                <span>
                    ${
                        currentSeason.houseguests?.length ||
                        0
                    }
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    Weeks
                </strong>

                <span>
                    ${
                        currentSeason.simulation?.currentWeek ||
                        1
                    }
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    Winner
                </strong>

                <span>
                    ${
                        escapeHTML(
                            currentSeason.simulation?.winner ||
                            "—"
                        )
                    }
                </span>

            </div>


            <div class="stat-card">

                <strong>
                    Status
                </strong>

                <span>
                    ${
                        currentSeason.simulation?.completed
                            ? "Complete"
                            : "In Progress"
                    }
                </span>

            </div>

        `;

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
                behavior: "smooth",
                block: "start"
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


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeModal() {

    const modal =
        document.getElementById(
            "modal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   ESC KEY FOR MODAL
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeModal();

        }

    }
);


/* =========================================================
   IMAGE ERROR HANDLING
   ========================================================= */

function setupImageErrorHandling() {

    /*
     * Most image handling is attached directly
     * to dynamically-created image elements.
     *
     * This function is reserved for future
     * global image handling.
     */

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


function escapeAttribute(value) {

    return escapeHTML(value);

}


/* =========================================================
   GLOBAL FUNCTIONS
   =========================================================
   These make functions accessible to the
   onclick="" handlers in index.html.
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

window.openSeason =
    openSeason;

window.editSeason =
    editSeason;

window.deleteSeason =
    deleteSeason;

window.runNextEvent =
    runNextEvent;

window.scrollToSavedSeasons =
    scrollToSavedSeasons;

window.closeModal =
    closeModal;

window.openModal =
    openModal;
