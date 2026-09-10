/*
 * SEASON BRANDING
 *
 * Adds the currently loaded season's custom logo to the simulator's
 * top-left brand card. This file is intentionally independent of the
 * simulation engine: it only reads window.currentSeason.logo and updates
 * the visual branding.
 */
(function () {
    "use strict";

    const STYLE_ID = "season-branding-style";
    const LOGO_ID = "season-custom-logo";
    const CARD_SELECTOR = ".sim-left-sidebar .sim-brand-card";

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .sim-brand-card {
                position: relative;
                overflow: hidden;
            }
            .sim-brand-card .season-custom-logo {
                display: block;
                width: min(100%, 170px);
                max-height: 92px;
                object-fit: contain;
                object-position: center;
                margin: 0 auto 10px;
                border: 0;
                background: transparent;
            }
            .sim-brand-card .season-custom-logo[hidden] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function getSeasonLogo() {
        const season = window.currentSeason;
        if (!season || typeof season.logo !== "string") return "";
        return season.logo.trim();
    }

    function updateSeasonLogo() {
        const card = document.querySelector(CARD_SELECTOR);
        if (!card) return;

        ensureStyles();

        let img = document.getElementById(LOGO_ID);
        if (!img) {
            img = document.createElement("img");
            img.id = LOGO_ID;
            img.className = "season-custom-logo";
            img.alt = "Season logo";
            img.hidden = true;
            img.addEventListener("error", function () {
                img.hidden = true;
            });
            card.insertBefore(img, card.firstChild);
        }

        const logo = getSeasonLogo();
        if (!logo) {
            img.removeAttribute("src");
            img.hidden = true;
            return;
        }

        if (img.dataset.logoUrl !== logo) {
            img.dataset.logoUrl = logo;
            img.hidden = false;
            img.src = logo;
        } else if (img.complete && img.naturalWidth > 0) {
            img.hidden = false;
        }
    }

    function watchForSeasonChanges() {
        ensureStyles();
        updateSeasonLogo();

        // currentSeason is intentionally read-only from this file. The existing
        // app remains responsible for loading/saving seasons and simulation state.
        let lastLogo = getSeasonLogo();
        let lastCard = null;

        window.setInterval(function () {
            const card = document.querySelector(CARD_SELECTOR);
            const logo = getSeasonLogo();
            if (card !== lastCard || logo !== lastLogo) {
                lastCard = card;
                lastLogo = logo;
                updateSeasonLogo();
            }
        }, 250);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", watchForSeasonChanges);
    } else {
        watchForSeasonChanges();
    }

    window.updateSeasonBranding = updateSeasonLogo;
})();
