/*
 * FINAL EVICTION + PORTRAIT CENTERING FIX
 *
 * This file is intentionally separate from app.js and twist-engine.js.
 * It does not replace the simulation engine. It only:
 *   1. Forces eviction ceremony content/portraits to the center.
 *   2. Gives the Final 3 -> Final 2 transition its own Final Eviction screen
 *      before the already-generated Jury Voting screen.
 */
(function () {
    "use strict";

    const STYLE_ID = "final-eviction-fix-style";
    const ORIGINAL_NEXT = window.runNextEvent;

    function getSeason() {
        return window.currentSeason || null;
    }

    function getSimulation() {
        return getSeason()?.simulation || null;
    }

    function getPlayer(id) {
        return (getSeason()?.houseguests || []).find(p => p.id === id) || null;
    }

    function nameOf(player) {
        if (!player) return "Unknown Houseguest";
        if (window.getHouseguestDisplayName) {
            return window.getHouseguestDisplayName(player.id, getSeason()?.houseguests || []);
        }
        return player.name || "Unknown Houseguest";
    }

    function portrait(player) {
        return window.simulationPortrait ? window.simulationPortrait(player, "large") : "";
    }

    function escapeText(value) {
        return window.escapeHTML ? window.escapeHTML(String(value ?? "")) : String(value ?? "");
    }

    function save() {
        if (window.persistCurrentSeason) window.persistCurrentSeason();
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            /* Keep every regular eviction ceremony centered. */
            .sim-main-panel #event-content .stable-eviction-result {
                width: 100% !important;
                max-width: 900px !important;
                margin-left: auto !important;
                margin-right: auto !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: flex-start !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }

            .sim-main-panel #event-content .stable-eviction-result > .sim-portrait {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 18px auto 14px !important;
                align-self: center !important;
            }

            .sim-main-panel #event-content .stable-eviction-result > h2,
            .sim-main-panel #event-content .stable-eviction-result > p {
                width: 100% !important;
                text-align: center !important;
                margin-left: auto !important;
                margin-right: auto !important;
            }

            /* The dedicated Final Eviction presentation uses the same centered layout. */
            .final-eviction-fix-card {
                width: 100% !important;
                max-width: 900px !important;
                margin: 0 auto !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: flex-start !important;
                text-align: center !important;
                box-sizing: border-box !important;
            }

            .final-eviction-fix-card > .sim-portrait {
                margin: 20px auto 16px !important;
                align-self: center !important;
            }

            .final-eviction-fix-card h2,
            .final-eviction-fix-card p {
                width: 100% !important;
                text-align: center !important;
            }
        `;
        document.head.appendChild(style);
    }

    function showFinalEviction(player, week) {
        const sim = getSimulation();
        if (!sim || !player || !window.showEvent) return;

        sim.renderingEventKey = "final-eviction";
        sim.renderingEventLabel = "Final Eviction";

        window.showEvent(
            "Final Eviction",
            "EVICTION",
            `
                <div class="final-eviction-fix-card">
                    ${portrait(player)}
                    <h2>${escapeText(nameOf(player))}</h2>
                    <p><strong>${escapeText(nameOf(player))}</strong> has been evicted from the Big Brother house in <strong>3rd place</strong>.</p>
                    <p>The Final 2 have been decided. Press <strong>Proceed</strong> to continue to Jury Voting.</p>
                </div>
            `,
            { week: week, skipLiveView: false }
        );
    }

    function continueToJuryVoting() {
        const sim = getSimulation();
        if (!sim || !sim.pendingFinalEvictionReveal) return false;

        const saved = sim.pendingFinalEvictionReveal;
        sim.pendingFinalEvictionReveal = null;
        sim.currentEventIndex = Number(saved.nextIndex);

        if (window.showEvent) {
            window.showEvent(
                saved.title || "Jury Voting",
                saved.type || "JURY VOTING",
                saved.content || "",
                {
                    week: saved.week || sim.currentWeek,
                    skipHistory: true,
                    skipLiveView: false
                }
            );
        }

        save();
        if (window.renderSimulationWeekNavigation) window.renderSimulationWeekNavigation();
        return true;
    }

    window.runNextEvent = function () {
        addStyles();

        const sim = getSimulation();
        const activeBefore = sim && window.getActiveHouseguests
            ? window.getActiveHouseguests().slice()
            : [];

        /*
         * The stable engine normally performs the Final 3 -> Final 2 decision
         * inside Jury Voting. Let it calculate everything exactly as before,
         * then insert a presentation-only Final Eviction screen between that
         * calculation and the jury vote display.
         */
        if (sim && sim.pendingFinalEvictionReveal) {
            continueToJuryVoting();
            return;
        }

        const isFinalThreeJuryStep =
            sim &&
            (sim.currentPhase === "finale" || sim.finaleStarted) &&
            activeBefore.length === 3 &&
            typeof ORIGINAL_NEXT === "function";

        const nextIndexBefore = Number(sim?.currentEventIndex || 0);

        if (!isFinalThreeJuryStep) {
            if (typeof ORIGINAL_NEXT === "function") ORIGINAL_NEXT();
            return;
        }

        ORIGINAL_NEXT();

        const activeAfter = window.getActiveHouseguests
            ? window.getActiveHouseguests().slice()
            : [];

        const evicted = activeBefore.find(p => !activeAfter.some(a => a.id === p.id));

        /* Only insert this screen when the engine actually created a 3rd-place player. */
        if (!evicted || Number(evicted.placement) !== 3 || !sim.liveView) return;

        const juryView = {
            title: sim.liveView.title || "Jury Voting",
            type: sim.liveView.type || "JURY VOTING",
            content: sim.liveView.content || "",
            week: sim.liveView.week || sim.currentWeek,
            nextIndex: nextIndexBefore + 1
        };

        sim.pendingFinalEvictionReveal = juryView;
        sim.currentEventIndex = nextIndexBefore;

        showFinalEviction(evicted, juryView.week);
        save();
    };

    addStyles();
    console.log("Final eviction presentation fix loaded.");
})();
