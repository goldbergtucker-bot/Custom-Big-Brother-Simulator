/*
 * BIG BROTHER SIMULATOR — FINALE DISPLAY COMPLETE FIX
 *
 * Standalone presentation/state compatibility layer.
 * Does not replace the simulation engine or modify app.js/twist-engine.js.
 *
 * Fixes:
 *  1. Ensures the Final 3 -> Final 2 eviction is visibly presented before jury voting.
 *  2. Builds a complete finale results page with winner, runner-up, vote counts,
 *     jury members, pre-jury members, placements, and each juror's vote.
 */
(function () {
    "use strict";

    const STYLE_ID = "finale-display-complete-fix-style";
    const ORIGINAL_NEXT = window.runNextEvent;
    const ORIGINAL_SHOW_RESULTS = window.showResults;

    function season() { return window.currentSeason || null; }
    function sim() { return season()?.simulation || null; }
    function players() { return season()?.houseguests || []; }
    function byId(id) { return players().find(p => p.id === id) || null; }
    function nameOf(p) {
        if (!p) return "Unknown Houseguest";
        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(p.id, players())
            : (p.name || "Unknown Houseguest");
    }
    function esc(v) { return window.escapeHTML ? window.escapeHTML(String(v ?? "")) : String(v ?? ""); }
    function portrait(p, size) {
        return window.simulationPortrait && p ? window.simulationPortrait(p, size || "medium") : "";
    }
    function save() {
        if (window.persistCurrentSeason) window.persistCurrentSeason();
    }
    function active() {
        return window.getActiveHouseguests
            ? window.getActiveHouseguests()
            : players().filter(p => p.status !== "evicted");
    }
    function placementOf(p) {
        return Number(p?.placement || 0);
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .complete-finale {
                width: min(1100px, 100%);
                margin: 0 auto;
                text-align: center;
            }
            .complete-finale-champions {
                display: grid;
                grid-template-columns: repeat(2, minmax(220px, 1fr));
                gap: 24px;
                max-width: 760px;
                margin: 22px auto 34px;
            }
            .complete-finale-champion {
                padding: 22px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 14px;
                background: rgba(255,255,255,.045);
            }
            .complete-finale-champion .sim-portrait {
                margin: 0 auto 14px !important;
            }
            .complete-finale-section {
                margin: 34px auto;
                padding: 22px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 14px;
                background: rgba(255,255,255,.025);
            }
            .complete-finale-section h3 { margin-top: 0; }
            .complete-finale-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                gap: 14px;
                max-width: 1000px;
                margin: 0 auto;
            }
            .complete-finale-player {
                padding: 15px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
                text-align: center;
            }
            .complete-finale-player .sim-portrait { margin: 0 auto 9px !important; }
            .complete-finale-placement { font-size: 1.05rem; font-weight: 800; margin-bottom: 4px; }
            .complete-finale-vote { margin-top: 7px; font-weight: 700; }
            .complete-finale-vote span { opacity: .75; font-weight: 500; }
            .complete-finale-jury-row {
                display: grid;
                grid-template-columns: minmax(180px, 1fr) 55px minmax(180px, 1fr);
                align-items: center;
                gap: 12px;
                padding: 13px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.035);
                margin-bottom: 10px;
            }
            .complete-finale-juror {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
            }
            .complete-finale-juror .sim-portrait { margin: 0 auto !important; }
            .complete-finale-arrow { font-size: 24px; font-weight: 900; }
            .complete-finale-tally {
                max-width: 520px;
                margin: 20px auto 0;
            }
            .complete-finale-tally-row {
                display: flex;
                justify-content: space-between;
                padding: 11px 14px;
                border-bottom: 1px solid rgba(255,255,255,.10);
            }
            .complete-finale-tally-row:last-child { border-bottom: 0; }
            .complete-finale-empty { opacity: .7; padding: 15px; }
            .complete-final-eviction {
                width: 100% !important;
                max-width: 900px !important;
                margin: 0 auto !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: flex-start !important;
                text-align: center !important;
            }
            .complete-final-eviction .sim-portrait { margin: 20px auto 16px !important; }
            .complete-final-eviction h2,
            .complete-final-eviction p { width: 100% !important; text-align: center !important; }
            @media (max-width: 650px) {
                .complete-finale-champions { grid-template-columns: 1fr; }
                .complete-finale-jury-row { grid-template-columns: 1fr; }
                .complete-finale-arrow { transform: rotate(90deg); }
            }
        `;
        document.head.appendChild(style);
    }

    function finaleFinalists() {
        const s = sim();
        const ids = Array.isArray(s?.finalists) ? s.finalists : [];
        const mapped = ids.map(byId).filter(Boolean);
        if (mapped.length >= 2) return mapped.slice(0, 2);
        return active().slice(0, 2);
    }

    function juryMembers() {
        const s = sim();
        const jurySize = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        const recorded = Array.isArray(s?.jury) ? s.jury.map(byId).filter(Boolean) : [];
        const eligible = players()
            .filter(p => p.status === "evicted" && placementOf(p) >= 4)
            .sort((a, b) => placementOf(a) - placementOf(b));
        // Actual placements are authoritative. Use recorded jury only when it is
        // also placement-valid, then fill from the placement-derived list.
        const validRecorded = recorded.filter(p => placementOf(p) >= 4);
        const combined = [...validRecorded, ...eligible.filter(p => !validRecorded.some(x => x.id === p.id))];
        return combined.slice(0, jurySize);
    }

    function preJuryMembers() {
        const jurySize = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        const highestJuryPlacement = 3 + jurySize;
        return players()
            .filter(p => p.status === "evicted" && placementOf(p) > highestJuryPlacement)
            .sort((a, b) => placementOf(b) - placementOf(a));
    }

    function allPlacements() {
        const s = sim();
        const stored = Array.isArray(s?.finalPlacements) ? s.finalPlacements : [];
        const fromStored = stored.map(x => ({
            player: byId(x.id) || players().find(p => nameOf(p) === x.name),
            placement: Number(x.placement || 0)
        })).filter(x => x.player && x.placement > 0);
        const seen = new Set(fromStored.map(x => x.player.id));
        const fromPlayers = players()
            .filter(p => placementOf(p) > 0 && !seen.has(p.id))
            .map(p => ({ player: p, placement: placementOf(p) }));
        return [...fromStored, ...fromPlayers].sort((a, b) => a.placement - b.placement);
    }

    function juryVotes() {
        const s = sim();
        const raw = Array.isArray(s?.juryVotes) ? s.juryVotes : (s?.finaleVoteResults?.votes || []);
        return raw;
    }

    function voteFor(jurorId) {
        const vote = juryVotes().find(v => v.juror === jurorId);
        return vote ? byId(vote.vote) : null;
    }

    function voteCounts(finalists) {
        const counts = {};
        finalists.forEach(p => counts[p.id] = 0);
        juryMembers().forEach(j => {
            const target = voteFor(j.id);
            if (target && Object.prototype.hasOwnProperty.call(counts, target.id)) counts[target.id]++;
        });
        return counts;
    }

    function ensureFinalResults() {
        const s = sim();
        if (!s) return { finalists: [], winner: null, runner: null, counts: {} };
        const finalists = finaleFinalists();
        const counts = voteCounts(finalists);
        const ranked = finalists.slice().sort((a, b) => {
            const diff = (counts[b.id] || 0) - (counts[a.id] || 0);
            return diff || Number(b.ratings?.social || 0) - Number(a.ratings?.social || 0);
        });
        const winner = byId(s.winner) || ranked[0] || null;
        const runner = byId(s.runnerUp) || ranked.find(p => p.id !== winner?.id) || null;
        if (winner) { winner.status = "winner"; winner.placement = 1; s.winner = winner.id; }
        if (runner) { runner.status = "runner-up"; runner.placement = 2; s.runnerUp = runner.id; }
        s.jury = juryMembers().map(p => p.id);
        s.juryVotes = juryMembers().map(j => {
            const existing = juryVotes().find(v => v.juror === j.id);
            return existing || { juror: j.id, vote: null };
        });
        s.finaleVoteResults = { votes: s.juryVotes, counts };
        return { finalists, winner, runner, counts };
    }

    function renderPlayerCard(player, placement, voteTarget) {
        return `<div class="complete-finale-player">
            ${portrait(player, "medium")}
            <div class="complete-finale-placement">${esc(placement)} place</div>
            <strong>${esc(nameOf(player))}</strong>
            ${voteTarget ? `<div class="complete-finale-vote"><span>Voted for:</span><br>${esc(nameOf(voteTarget))}</div>` : ""}
        </div>`;
    }

    function jurySection() {
        const jury = juryMembers();
        const rows = jury.map(j => {
            const target = voteFor(j.id);
            return `<div class="complete-finale-jury-row">
                <div class="complete-finale-juror">${portrait(j, "small")}<strong>${esc(nameOf(j))}</strong><span>${esc(placementOf(j))} place</span></div>
                <div class="complete-finale-arrow">→</div>
                <div class="complete-finale-juror">${target ? portrait(target, "small") : ""}<strong>${target ? esc(nameOf(target)) : "No vote recorded"}</strong></div>
            </div>`;
        }).join("");
        return `<section class="complete-finale-section">
            <h3>Jury Members</h3>
            <p>${jury.length} juror${jury.length === 1 ? "" : "s"} voted for the winner.</p>
            ${rows || `<div class="complete-finale-empty">No eligible jury members were recorded.</div>`}
        </section>`;
    }

    function preJurySection() {
        const list = preJuryMembers().map(p => renderPlayerCard(p, placementOf(p), null)).join("");
        return `<section class="complete-finale-section">
            <h3>Pre-Jury Houseguests</h3>
            <p>These Houseguests were evicted before the jury and did not vote for the winner.</p>
            <div class="complete-finale-list">${list || `<div class="complete-finale-empty">No pre-jury Houseguests.</div>`}</div>
        </section>`;
    }

    function placementsSection() {
        const list = allPlacements().map(x => renderPlayerCard(x.player, x.placement, null)).join("");
        return `<section class="complete-finale-section">
            <h3>Complete Placements</h3>
            <div class="complete-finale-list">${list || `<div class="complete-finale-empty">No final placements recorded.</div>`}</div>
        </section>`;
    }

    function completeResultsHTML() {
        const data = ensureFinalResults();
        const { winner, runner, finalists, counts } = data;
        const tally = finalists.map(p => `<div class="complete-finale-tally-row"><span>${esc(nameOf(p))}</span><strong>${Number(counts[p.id] || 0)} vote${Number(counts[p.id] || 0) === 1 ? "" : "s"}</strong></div>`).join("");
        return `<div class="complete-finale">
            <h2>Final Results</h2>
            <div class="complete-finale-champions">
                ${winner ? `<div class="complete-finale-champion">${portrait(winner, "large")}<h2>${esc(nameOf(winner))}</h2><p><strong>WINNER</strong></p><p>${Number(counts[winner.id] || 0)} jury vote${Number(counts[winner.id] || 0) === 1 ? "" : "s"}</p></div>` : ""}
                ${runner ? `<div class="complete-finale-champion">${portrait(runner, "large")}<h2>${esc(nameOf(runner))}</h2><p><strong>RUNNER-UP</strong></p><p>${Number(counts[runner.id] || 0)} jury vote${Number(counts[runner.id] || 0) === 1 ? "" : "s"}</p></div>` : ""}
            </div>
            <section class="complete-finale-section"><h3>Final Vote Count</h3><div class="complete-finale-tally">${tally || `<div class="complete-finale-empty">No votes recorded.</div>`}</div></section>
            ${jurySection()}
            ${preJurySection()}
            ${placementsSection()}
        </div>`;
    }

    function showFinalEviction(player) {
        const s = sim();
        if (!s || !player || !window.showEvent) return;
        s.completeFinalEvictionShown = true;
        window.showEvent("Final Eviction", "EVICTION", `<div class="complete-final-eviction">
            ${portrait(player, "large")}
            <h2>${esc(nameOf(player))}</h2>
            <p><strong>${esc(nameOf(player))}</strong> has been evicted from the Big Brother house in <strong>3rd place</strong>.</p>
            <p>The Final 2 have now been decided. Press <strong>Proceed</strong> to reveal the jury vote.</p>
        </div>`, { week: s.currentWeek, skipLiveView: false });
        save();
    }

    function fixedNextEvent() {
        addStyles();
        const s = sim();
        if (!s || typeof ORIGINAL_NEXT !== "function") return;

        // If the prior engine has already prepared its Final 3 -> Final 2
        // continuation, let that continuation proceed to Jury Voting.
        if (s.completeFinalEvictionShown && active().length === 2) {
            s.completeFinalEvictionShown = false;
            ORIGINAL_NEXT();
            return;
        }

        const before = active().slice();
        const isFinale = s.currentPhase === "finale" || s.finaleStarted;

        ORIGINAL_NEXT();

        const after = active().slice();
        if (!isFinale || before.length !== 3 || after.length !== 2) return;

        const evicted = before.find(p => !after.some(x => x.id === p.id));
        if (!evicted) return;

        // The underlying engine may have immediately rendered Jury Voting.
        // Replace that presentation with the missing Final Eviction screen.
        showFinalEviction(evicted);
    }

    function fixedShowResults() {
        addStyles();
        const s = sim();
        const seasonObj = season();
        if (!s || !seasonObj) return;
        const data = ensureFinalResults();
        const winner = data.winner;
        const runner = data.runner;

        const seasonName = document.getElementById("results-season-name");
        if (seasonName) seasonName.textContent = seasonObj.name || "Big Brother";
        const winnerName = document.getElementById("winner-name");
        if (winnerName) winnerName.textContent = winner ? nameOf(winner) : "—";
        const runnerName = document.getElementById("runner-up-name");
        if (runnerName) runnerName.textContent = runner ? nameOf(runner) : "—";

        const placementBox = document.getElementById("final-placements");
        if (placementBox) placementBox.innerHTML = placementsSection();

        const juryBox = document.getElementById("final-jury-results");
        if (juryBox) juryBox.innerHTML = jurySection() + preJurySection();

        if (window.renderSeasonStatistics) window.renderSeasonStatistics();
        if (window.showPage) window.showPage("results-page");
        save();
    }

    addStyles();
    window.runNextEvent = fixedNextEvent;
    window.showResults = fixedShowResults;
    console.log("Complete finale display fix loaded.");
})();
