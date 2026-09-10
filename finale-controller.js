/*
 * BIG BROTHER SIMULATOR — SINGLE FINALE CONTROLLER v2
 *
 * This file is loaded AFTER app.js, twist-engine.js, and season-branding.js.
 * It is the ONLY finale presentation/controller patch that should be loaded.
 *
 * It deliberately leaves the stable simulation engine alone for:
 *   - Final HOH Parts 1–3
 *   - the actual Final 3 -> Final 2 decision
 *   - jury vote generation
 *
 * It takes control of the presentation at Final Eviction and Final Results.
 */
(function () {
    "use strict";

    const STYLE_ID = "single-finale-controller-v2-style";
    const ORIGINAL_NEXT = window.runNextEvent;

    function season() { return window.currentSeason || null; }
    function simulation() { return season()?.simulation || null; }
    function players() { return season()?.houseguests || []; }

    function byId(id) {
        return players().find(p => String(p.id) === String(id)) || null;
    }

    function activePlayers() {
        if (typeof window.getActiveHouseguests === "function") {
            return window.getActiveHouseguests() || [];
        }
        return players().filter(p =>
            p.status !== "evicted" &&
            p.status !== "winner" &&
            p.status !== "runner-up"
        );
    }

    function nameOf(p) {
        if (!p) return "Unknown Houseguest";
        if (typeof window.getHouseguestDisplayName === "function") {
            return window.getHouseguestDisplayName(p.id, players());
        }
        return p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown Houseguest";
    }

    function esc(value) {
        return typeof window.escapeHTML === "function"
            ? window.escapeHTML(String(value ?? ""))
            : String(value ?? "");
    }

    function portrait(p, size) {
        if (!p) return "";
        return typeof window.simulationPortrait === "function"
            ? window.simulationPortrait(p, size || "medium")
            : "";
    }

    function save() {
        if (typeof window.persistCurrentSeason === "function") {
            window.persistCurrentSeason();
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .single-finale-v2 {
                width: min(1100px, 100%);
                margin: 0 auto;
                text-align: center;
            }

            .single-finale-v2-center {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }

            .single-finale-v2-center .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .single-finale-v2-champions {
                display: grid;
                grid-template-columns: repeat(2, minmax(220px, 1fr));
                gap: 24px;
                max-width: 800px;
                margin: 25px auto 35px;
            }

            .single-finale-v2-champion {
                padding: 24px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 14px;
                background: rgba(255,255,255,.045);
                text-align: center;
            }

            .single-finale-v2-champion .sim-portrait {
                display: block;
                margin: 0 auto 15px !important;
            }

            .single-finale-v2-section {
                margin: 28px auto;
                padding: 22px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 14px;
                background: rgba(255,255,255,.025);
            }

            .single-finale-v2-tally {
                width: min(600px, 100%);
                margin: 0 auto;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 10px;
            }

            .single-finale-v2-tally-row {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                padding: 13px 16px;
                border-bottom: 1px solid rgba(255,255,255,.08);
                text-align: left;
            }

            .single-finale-v2-tally-row:last-child { border-bottom: 0; }

            .single-finale-v2-jury {
                width: min(850px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .single-finale-v2-jury-row {
                display: grid;
                grid-template-columns: minmax(180px, 1fr) 50px minmax(180px, 1fr);
                align-items: center;
                gap: 12px;
                padding: 13px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
            }

            .single-finale-v2-person {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                text-align: center;
            }

            .single-finale-v2-person .sim-portrait {
                margin: 0 auto !important;
            }

            .single-finale-v2-arrow {
                font-size: 24px;
                font-weight: 900;
            }

            .single-finale-v2-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(150px, 1fr));
                gap: 14px;
                max-width: 1050px;
                margin: 0 auto;
            }

            .single-finale-v2-card {
                padding: 15px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
                text-align: center;
            }

            .single-finale-v2-card .sim-portrait {
                display: block;
                margin: 0 auto 9px !important;
            }

            .single-finale-v2-place {
                font-weight: 900;
                font-size: 1.05rem;
                margin-bottom: 5px;
            }

            @media (max-width: 850px) {
                .single-finale-v2-grid { grid-template-columns: repeat(3, minmax(140px, 1fr)); }
            }

            @media (max-width: 650px) {
                .single-finale-v2-champions { grid-template-columns: 1fr; }
                .single-finale-v2-jury-row { grid-template-columns: 1fr; }
                .single-finale-v2-arrow { transform: rotate(90deg); }
                .single-finale-v2-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
            }

            @media (max-width: 420px) {
                .single-finale-v2-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    function ordinal(n) {
        const x = Number(n);
        const mod100 = x % 100;
        if (mod100 >= 11 && mod100 <= 13) return `${x}th`;
        const mod10 = x % 10;
        if (mod10 === 1) return `${x}st`;
        if (mod10 === 2) return `${x}nd`;
        if (mod10 === 3) return `${x}rd`;
        return `${x}th`;
    }

    /* ---------------------------------------------------------
       FINAL TWO
       --------------------------------------------------------- */

    function finalTwo() {
        const s = simulation();
        const active = activePlayers();

        // After the Final 3 decision, exactly two players are active.
        if (active.length === 2) return active.slice();

        // Otherwise accept finalists only when exactly two valid finalists
        // are present. This prevents an old 3-player finalists array from
        // accidentally becoming the Final Results finalists.
        const ids = Array.isArray(s?.finalists) ? s.finalists : [];
        const found = ids.map(byId).filter(Boolean);
        if (found.length === 2) return found;

        // Last fallback: explicit final placements.
        const placed = players()
            .filter(p => Number(p.placement) === 1 || Number(p.placement) === 2)
            .sort((a, b) => Number(a.placement) - Number(b.placement));

        return placed.slice(0, 2);
    }

    /* ---------------------------------------------------------
       JURY
       --------------------------------------------------------- */

    function juryMembers() {
        const s = simulation();
        const size = Math.max(0, Number(season()?.rules?.jurySize ?? 7));

        const jury = players()
            .filter(p =>
                p.status === "evicted" &&
                Number(p.placement) >= 4
            )
            .sort((a, b) => Number(a.placement) - Number(b.placement))
            .slice(0, size);

        if (s) s.jury = jury.map(p => p.id);
        return jury;
    }

    function preJuryMembers() {
        const size = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        const highestJuryPlacement = 3 + size;

        return players()
            .filter(p =>
                p.status === "evicted" &&
                Number(p.placement) > highestJuryPlacement
            )
            .sort((a, b) => Number(a.placement) - Number(b.placement));
    }

    /* ---------------------------------------------------------
       JURY VOTE NORMALIZATION
       --------------------------------------------------------- */

    function rawVotes() {
        const s = simulation();
        if (Array.isArray(s?.juryVotes)) return s.juryVotes;
        if (Array.isArray(s?.finaleVoteResults?.votes)) return s.finaleVoteResults.votes;
        return [];
    }

    function jurorIdOf(v) {
        return v?.juror ?? v?.jurorId ?? v?.voter ?? v?.voterId ?? null;
    }

    function targetIdOf(v) {
        return v?.vote ?? v?.target ?? v?.targetId ?? v?.voteFor ?? v?.votedFor ?? null;
    }

    function voteFor(jurorId) {
        return rawVotes().find(v =>
            String(jurorIdOf(v)) === String(jurorId)
        ) || null;
    }

    function allianceBond(a, b) {
        if (typeof window.allianceBond === "function") {
            return Number(window.allianceBond(a, b) || 0);
        }
        return 0;
    }

    function chooseFallbackVote(juror, finalists) {
        if (!juror || finalists.length < 2) return null;

        const ranked = finalists.map(f => ({
            player: f,
            score:
                Number(f.ratings?.social || 0) * 0.40 +
                Number(f.ratings?.strategic || 0) * 0.35 +
                Number(f.ratings?.general || 0) * 0.15 +
                Number(f.ratings?.mental || 0) * 0.10 +
                allianceBond(juror.id, f.id) * 0.15
        })).sort((a, b) => b.score - a.score);

        return ranked[0]?.player || finalists[0];
    }

    function resolveVotes(finalists) {
        const s = simulation();
        const jury = juryMembers();
        const validIds = new Set(finalists.map(p => String(p.id)));
        const normalized = [];

        jury.forEach(juror => {
            const raw = voteFor(juror.id);
            let target = raw ? byId(targetIdOf(raw)) : null;

            if (!target || !validIds.has(String(target.id))) {
                target = chooseFallbackVote(juror, finalists);
            }

            if (target) {
                normalized.push({
                    juror: juror.id,
                    vote: target.id
                });
            }
        });

        const counts = {};
        finalists.forEach(p => { counts[p.id] = 0; });
        normalized.forEach(v => {
            if (Object.prototype.hasOwnProperty.call(counts, v.vote)) {
                counts[v.vote]++;
            }
        });

        if (s) {
            s.juryVotes = normalized;
            s.finaleVoteResults = { votes: normalized, counts: counts };
        }

        return { jury, votes: normalized, counts };
    }

    /* ---------------------------------------------------------
       WINNER / RUNNER-UP
       --------------------------------------------------------- */

    function resolveWinnerRunner() {
        const s = simulation();
        const finalists = finalTwo();

        if (finalists.length < 2) {
            return {
                finalists,
                winner: null,
                runner: null,
                counts: {}
            };
        }

        const voteData = resolveVotes(finalists);
        const counts = voteData.counts;

        const ranked = finalists.slice().sort((a, b) => {
            const voteDiff = Number(counts[b.id] || 0) - Number(counts[a.id] || 0);
            if (voteDiff) return voteDiff;

            const socialDiff = Number(b.ratings?.social || 0) - Number(a.ratings?.social || 0);
            if (socialDiff) return socialDiff;

            return Number(b.ratings?.strategic || 0) - Number(a.ratings?.strategic || 0);
        });

        const winner = ranked[0] || null;
        const runner = ranked[1] || null;

        if (s) {
            s.winner = winner?.id || null;
            s.runnerUp = runner?.id || null;
            s.finalists = finalists.map(p => p.id);
        }

        if (winner) {
            winner.status = "winner";
            winner.placement = 1;
        }

        if (runner) {
            runner.status = "runner-up";
            runner.placement = 2;
        }

        return { finalists, winner, runner, counts };
    }

    /* ---------------------------------------------------------
       PLACEMENTS
       --------------------------------------------------------- */

    function rebuildFinalPlacements(winner, runner) {
        const s = simulation();
        if (!s) return;

        const map = new Map();

        players().forEach(p => {
            const placement = Number(p.placement || 0);
            if (placement >= 3) {
                map.set(String(p.id), {
                    id: p.id,
                    name: nameOf(p),
                    placement: placement
                });
            }
        });

        if (winner) {
            map.delete(String(winner.id));
        }

        if (runner) {
            map.delete(String(runner.id));
        }

        const result = [];
        if (winner) result.push({ id: winner.id, name: nameOf(winner), placement: 1 });
        if (runner) result.push({ id: runner.id, name: nameOf(runner), placement: 2 });

        [...map.values()].forEach(x => result.push(x));
        result.sort((a, b) => Number(a.placement) - Number(b.placement));

        s.finalPlacements = result;
    }

    function placementEntries() {
        const s = simulation();
        const map = new Map();

        players().forEach(p => {
            const placement = Number(p.placement || 0);
            if (placement > 0) {
                map.set(String(p.id), { player: p, placement });
            }
        });

        if (Array.isArray(s?.finalPlacements)) {
            s.finalPlacements.forEach(item => {
                const p = byId(item.id);
                const placement = Number(item.placement || 0);
                if (p && placement > 0) {
                    map.set(String(p.id), { player: p, placement });
                }
            });
        }

        return [...map.values()].sort((a, b) => a.placement - b.placement);
    }

    /* ---------------------------------------------------------
       HTML
       --------------------------------------------------------- */

    function playerCard(p, placement, voteTarget) {
        return `<div class="single-finale-v2-card">
            <div class="single-finale-v2-place">${esc(ordinal(placement))} place</div>
            ${portrait(p, "medium")}
            <strong>${esc(nameOf(p))}</strong>
            ${voteTarget ? `<div>Voted for: <strong>${esc(nameOf(voteTarget))}</strong></div>` : ""}
        </div>`;
    }

    function juryHTML() {
        const jury = juryMembers();
        const rows = jury.map(juror => {
            const raw = voteFor(juror.id);
            const target = raw ? byId(targetIdOf(raw)) : null;

            return `<div class="single-finale-v2-jury-row">
                <div class="single-finale-v2-person">
                    ${portrait(juror, "small")}
                    <strong>${esc(nameOf(juror))}</strong>
                    <span>${esc(ordinal(juror.placement))} place</span>
                </div>
                <div class="single-finale-v2-arrow">→</div>
                <div class="single-finale-v2-person">
                    ${target ? portrait(target, "small") : ""}
                    <strong>${target ? esc(nameOf(target)) : "No vote recorded"}</strong>
                    <span>${target ? "Voted for" : ""}</span>
                </div>
            </div>`;
        }).join("");

        return `<section class="single-finale-v2-section">
            <h3>Jury Members & Votes</h3>
            <div class="single-finale-v2-jury">
                ${rows || "<p>No eligible jury members were recorded.</p>"}
            </div>
        </section>`;
    }

    function preJuryHTML() {
        const list = preJuryMembers()
            .map(p => playerCard(p, p.placement, null))
            .join("");

        return `<section class="single-finale-v2-section">
            <h3>Pre-Jury Houseguests</h3>
            <p>These Houseguests were evicted before the jury and did not vote.</p>
            <div class="single-finale-v2-grid">
                ${list || "<p>No pre-jury Houseguests were recorded.</p>"}
            </div>
        </section>`;
    }

    function placementsHTML() {
        const list = placementEntries()
            .map(x => playerCard(x.player, x.placement, null))
            .join("");

        return `<section class="single-finale-v2-section">
            <h3>Complete Placements</h3>
            <div class="single-finale-v2-grid">
                ${list || "<p>No placements were recorded.</p>"}
            </div>
        </section>`;
    }

    function resultsHTML() {
        const data = resolveWinnerRunner();
        rebuildFinalPlacements(data.winner, data.runner);

        const tally = data.finalists.map(p => {
            const n = Number(data.counts[p.id] || 0);
            return `<div class="single-finale-v2-tally-row">
                <span>${esc(nameOf(p))}</span>
                <strong>${n} jury vote${n === 1 ? "" : "s"}</strong>
            </div>`;
        }).join("");

        return `<div class="single-finale-v2">
            <h2>Final Results</h2>

            <div class="single-finale-v2-champions">
                ${data.winner ? `<div class="single-finale-v2-champion">
                    ${portrait(data.winner, "large")}
                    <h2>${esc(nameOf(data.winner))}</h2>
                    <p><strong>WINNER</strong></p>
                    <p>${Number(data.counts[data.winner.id] || 0)} jury vote${Number(data.counts[data.winner.id] || 0) === 1 ? "" : "s"}</p>
                </div>` : ""}

                ${data.runner ? `<div class="single-finale-v2-champion">
                    ${portrait(data.runner, "large")}
                    <h2>${esc(nameOf(data.runner))}</h2>
                    <p><strong>RUNNER-UP</strong></p>
                    <p>${Number(data.counts[data.runner.id] || 0)} jury vote${Number(data.counts[data.runner.id] || 0) === 1 ? "" : "s"}</p>
                </div>` : ""}
            </div>

            <section class="single-finale-v2-section">
                <h3>Final Vote Count</h3>
                <div class="single-finale-v2-tally">
                    ${tally || "<p>No jury votes were recorded.</p>"}
                </div>
            </section>

            ${juryHTML()}
            ${preJuryHTML()}
            ${placementsHTML()}
        </div>`;
    }

    /* ---------------------------------------------------------
       FINAL EVICTION
       --------------------------------------------------------- */

    function showFinalEviction(player, juryView) {
        const s = simulation();
        if (!s || !player || typeof window.showEvent !== "function") return;

        s.finalEvictionReveal = {
            playerId: player.id,
            juryView: juryView
        };

        window.showEvent(
            "Final Eviction",
            "EVICTION",
            `<div class="single-finale-v2-center">
                ${portrait(player, "large")}
                <h2>${esc(nameOf(player))}</h2>
                <p><strong>${esc(nameOf(player))}</strong> has been evicted from the Big Brother house in <strong>3rd place</strong>.</p>
                <p>The Final 2 have now been decided.</p>
                <p>Press <strong>Proceed</strong> to reveal the jury vote.</p>
            </div>`,
            {
                week: s.currentWeek,
                skipHistory: true,
                skipLiveView: false
            }
        );

        save();
    }

    function continueAfterFinalEviction() {
        const s = simulation();
        const pending = s?.finalEvictionReveal;
        if (!pending) return false;

        s.finalEvictionReveal = null;

        const juryView = pending.juryView;
        const nextIndex = Number(juryView?.nextIndex ?? s.currentEventIndex);
        s.currentEventIndex = nextIndex;

        if (juryView && typeof window.showEvent === "function") {
            window.showEvent(
                juryView.title || "Jury Voting",
                juryView.type || "JURY VOTING",
                juryView.content || "<p>The jury vote has been recorded.</p>",
                {
                    week: juryView.week || s.currentWeek,
                    skipHistory: false,
                    skipLiveView: false
                }
            );
        }

        if (typeof window.renderSimulationWeekNavigation === "function") {
            window.renderSimulationWeekNavigation();
        }

        save();
        return true;
    }

    /* ---------------------------------------------------------
       RESULTS PAGE
       --------------------------------------------------------- */

    function showResults() {
        addStyles();

        const s = simulation();
        const ss = season();
        if (!s || !ss) return;

        const data = resolveWinnerRunner();
        rebuildFinalPlacements(data.winner, data.runner);

        s.completed = true;
        s.currentPhase = "complete";
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;

        const seasonName = document.getElementById("results-season-name");
        const winnerName = document.getElementById("winner-name");
        const runnerName = document.getElementById("runner-up-name");

        if (seasonName) seasonName.textContent = ss.name || "Big Brother";
        if (winnerName) winnerName.textContent = data.winner ? nameOf(data.winner) : "—";
        if (runnerName) runnerName.textContent = data.runner ? nameOf(data.runner) : "—";

        const placementBox = document.getElementById("final-placements");
        if (placementBox) placementBox.innerHTML = placementsHTML();

        const juryBox = document.getElementById("final-jury-results");
        if (juryBox) juryBox.innerHTML = juryHTML() + preJuryHTML();

        if (typeof window.renderSeasonStatistics === "function") {
            window.renderSeasonStatistics();
        }

        if (typeof window.showPage === "function") {
            window.showPage("results-page");
        }

        save();
    }

    /* ---------------------------------------------------------
       NEXT EVENT CONTROLLER
       --------------------------------------------------------- */

    function nextEvent() {
        addStyles();

        const s = simulation();
        if (!s || typeof ORIGINAL_NEXT !== "function") return;

        // Second click on the Final Eviction screen: return to the already
        // calculated Jury Voting event without calculating the vote again.
        if (s.finalEvictionReveal) {
            continueAfterFinalEviction();
            return;
        }

        const isFinale =
            s.currentPhase === "finale" ||
            s.finaleStarted === true;

        const indexBefore = Number(s.currentEventIndex || 0);
        const chainBefore = isFinale && typeof window.getFinaleChain === "function"
            ? (window.getFinaleChain() || [])
            : [];
        const eventBefore = chainBefore[indexBefore];

        /*
         * CRITICAL FIX:
         *
         * Do not allow twist-engine.js to run its private Final Results
         * function. It creates the event before this presentation layer can
         * correct it. We resolve the winner/runner-up ourselves instead.
         */
        if (
            isFinale &&
            eventBefore &&
            (
                eventBefore.key === "finale-results" ||
                eventBefore.key === "final-results" ||
                String(eventBefore.type || "").toLowerCase() === "finale-results"
            )
        ) {
            console.log("Single Finale Controller v2: intercepting Final Results.");

            const data = resolveWinnerRunner();
            rebuildFinalPlacements(data.winner, data.runner);

            s.completed = true;
            s.currentPhase = "complete";
            s.pendingCycle = null;
            s.pendingWeekAdvance = false;
            s.currentEventIndex = indexBefore + 1;

            if (typeof window.showEvent === "function") {
                window.showEvent(
                    "Final Results",
                    "FINAL RESULTS",
                    resultsHTML(),
                    {
                        week: s.currentWeek,
                        skipHistory: false,
                        skipLiveView: false
                    }
                );
            }

            save();
            return;
        }

        /*
         * Final 3 -> Final 2:
         * Let the stable engine calculate the actual decision and jury vote,
         * then insert the visual Final Eviction reveal before Jury Voting is
         * displayed again.
         */
        const beforeFinalThree = isFinale && activePlayers().length === 3;

        if (
            isFinale &&
            beforeFinalThree &&
            eventBefore?.key === "jury-voting"
        ) {
            ORIGINAL_NEXT();

            const after = activePlayers();
            if (after.length !== 2) return;

            const evicted = players().find(p =>
                Number(p.placement) === 3 &&
                !after.some(a => String(a.id) === String(p.id))
            );

            if (!evicted) return;

            evicted.status = "evicted";
            evicted.placement = 3;

            const juryView = s.liveView
                ? {
                    title: s.liveView.title || "Jury Voting",
                    type: s.liveView.type || "JURY VOTING",
                    content: s.liveView.content || "",
                    week: s.liveView.week || s.currentWeek,
                    nextIndex: Number(s.currentEventIndex || indexBefore + 1)
                }
                : {
                    title: "Jury Voting",
                    type: "JURY VOTING",
                    content: "<p>The jury vote has been recorded.</p>",
                    week: s.currentWeek,
                    nextIndex: indexBefore + 1
                };

            // The stable engine has already advanced to the Final Results
            // index. Freeze it while the Final Eviction screen is shown.
            s.currentEventIndex = indexBefore;

            showFinalEviction(evicted, juryView);
            save();
            return;
        }

        // Every other event remains owned by the stable simulation engine.
        ORIGINAL_NEXT();
    }

    addStyles();
    window.runNextEvent = nextEvent;
    window.showResults = showResults;

    console.log("Single Finale Controller v2 loaded.");
})();
