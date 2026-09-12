/*
 * BIG BROTHER SIMULATOR — SINGLE FINALE CONTROLLER
 *
 * This is a presentation/state compatibility layer only.
 * It does NOT replace the simulation engine, twist engine, HOH/POV logic,
 * or competition logic.
 *
 * It replaces the older stacked finale patches with one controller that:
 *   1. Preserves the stable engine's Final HOH Parts 1–3.
 *   2. Inserts a dedicated Final Eviction screen between Final 3 -> Final 2
 *      and Jury Voting without running the jury vote twice.
 *   3. Guarantees jury eligibility is based on placements (4th and lower),
 *      so pre-jury Houseguests cannot vote.
 *   4. Guarantees winner/runner-up are resolved from the recorded jury vote.
 *   5. Provides a complete Results page with vote counts, juror votes,
 *      pre-jury Houseguests, and every placement.
 */
(function () {
    "use strict";

    const STYLE_ID = "single-finale-controller-style";
    const ORIGINAL_NEXT = window.runNextEvent;

    function season() { return window.currentSeason || null; }
    function simulation() { return season()?.simulation || null; }
    function players() { return season()?.houseguests || []; }
    function byId(id) { return players().find(p => String(p.id) === String(id)) || null; }
    function activePlayers() {
        return window.getActiveHouseguests
            ? window.getActiveHouseguests()
            : players().filter(p => p.status !== "evicted" && p.status !== "winner" && p.status !== "runner-up");
    }
    function nameOf(p) {
        if (!p) return "Unknown Houseguest";
        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(p.id, players())
            : (p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown Houseguest");
    }
    function displayName(id) {
        const p = byId(id);
        return p ? nameOf(p) : "Unknown Houseguest";
    }
    function esc(value) {
        return window.escapeHTML ? window.escapeHTML(String(value ?? "")) : String(value ?? "");
    }
    function portrait(p, size) {
        // showName:false — every call site here also prints the name via nameOf()
        // right next to the portrait, so the portrait's own caption is suppressed
        // to avoid showing the same name twice.
        return p && window.simulationPortrait ? window.simulationPortrait(p, size || "medium", { showName: false }) : "";
    }
    function portraits(ids, size) {
        return window.simulationPortraits
            ? window.simulationPortraits(ids, size || "medium")
            : ids.map(id => portrait(byId(id), size)).join("");
    }
    function save() {
        if (window.persistCurrentSeason) window.persistCurrentSeason();
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .single-finale-eviction {
                width: min(900px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                box-sizing: border-box;
            }
            .single-finale-eviction .sim-portrait {
                margin: 22px auto 16px !important;
                align-self: center !important;
            }
            .single-finale-eviction h2,
            .single-finale-eviction p { width: 100%; text-align: center; }

            .single-finale-results {
                width: min(1100px, 100%);
                margin: 0 auto;
                text-align: center;
            }
            .single-finale-champions {
                display: grid;
                grid-template-columns: repeat(2, minmax(220px, 1fr));
                gap: 24px;
                max-width: 760px;
                margin: 24px auto 34px;
            }
            .single-finale-champion {
                padding: 22px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 14px;
                background: rgba(255,255,255,.045);
            }
            .single-finale-champion .sim-portrait {
                margin: 0 auto 14px !important;
            }
            .single-finale-section {
                margin: 30px auto;
                padding: 22px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 14px;
                background: rgba(255,255,255,.025);
            }
            .single-finale-section h3 { margin-top: 0; }
            .single-finale-tally {
                width: min(560px, 100%);
                margin: 0 auto;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 10px;
                overflow: hidden;
            }
            .single-finale-tally-row {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                padding: 12px 15px;
                border-bottom: 1px solid rgba(255,255,255,.09);
            }
            .single-finale-tally-row:last-child { border-bottom: 0; }
            .single-finale-jury-list {
                width: min(800px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .single-finale-jury-row {
                display: grid;
                grid-template-columns: minmax(180px, 1fr) 45px minmax(180px, 1fr);
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
            }
            .single-finale-juror {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                min-width: 0;
            }
            .single-finale-juror .sim-portrait { margin: 0 auto !important; }
            .single-finale-arrow { font-size: 24px; font-weight: 900; }
            .single-finale-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(150px, 1fr));
                gap: 14px;
                max-width: 1000px;
                margin: 0 auto;
            }
            .single-finale-player-card {
                padding: 15px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
                text-align: center;
            }
            .single-finale-player-card .sim-portrait { margin: 0 auto 9px !important; }
            .single-finale-place { font-weight: 900; font-size: 1.05rem; margin-bottom: 4px; }
            .single-finale-voted { margin-top: 8px; font-weight: 700; }
            .single-finale-voted span { opacity: .72; font-weight: 500; }
            @media (max-width: 850px) {
                .single-finale-grid { grid-template-columns: repeat(3, minmax(140px, 1fr)); }
            }
            @media (max-width: 650px) {
                .single-finale-champions { grid-template-columns: 1fr; }
                .single-finale-jury-row { grid-template-columns: 1fr; }
                .single-finale-arrow { transform: rotate(90deg); }
                .single-finale-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
            }
            @media (max-width: 420px) {
                .single-finale-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    function juryMembers() {
        const s = simulation();
        const size = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        const maxPlacement = 3 + size;
        const eligible = players().filter(p => {
            const place = Number(p.placement);
            return place >= 4 && place <= maxPlacement;
        }).sort((a,b) => Number(a.placement)-Number(b.placement));
        if (s) s.jury = eligible.map(p => p.id);
        return eligible;
    }
    function preJuryMembers() {
        const size = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        const maxPlacement = 3 + size;
        return players().filter(p => Number(p.placement) > maxPlacement).sort((a,b)=>Number(b.placement)-Number(a.placement));
    }

    function chooseFinalTwoAndRecordJury() {
        const s = simulation();
        const three = activePlayers().slice();
        if (!s || three.length !== 3) return null;
        const finalHOH = byId(s.finalHOH3 || s.finalHOH1) || three[0];
        const others = three.filter(p => p.id !== finalHOH.id);
        const chosen = others.slice().sort((a,b) => {
            const aa = window.allianceBond ? Number(window.allianceBond(finalHOH.id,a.id)||0) : 0;
            const bb = window.allianceBond ? Number(window.allianceBond(finalHOH.id,b.id)||0) : 0;
            return bb-aa;
        })[0] || others[0];
        const third = others.find(p => p.id !== chosen.id) || others[0];
        if (!chosen || !third) return null;
        third.status='evicted'; third.placement=3;
        const finalists=[finalHOH,chosen]; s.finalists=finalists.map(p=>p.id);
        const size=Math.max(0,Number(season()?.rules?.jurySize??7));
        const maxPlacement=3+size;
        const jury=players().filter(p=>{const place=Number(p.placement); return place>=4 && place<=maxPlacement;}).sort((a,b)=>Number(a.placement)-Number(b.placement));
        s.jury=jury.map(p=>p.id);
        const votes=jury.map(juror=>{
            const ranked=finalists.map(f=>{
                const bond=window.allianceBond?Number(window.allianceBond(juror.id,f.id)||0):0;
                const score=Number(f.ratings?.social||0)*.4+Number(f.ratings?.strategic||0)*.35+Number(f.ratings?.general||0)*.15+Number(f.ratings?.mental||0)*.1+bond*.15+Math.random()*3;
                return {f,score};
            }).sort((a,b)=>b.score-a.score);
            return {juror:juror.id,vote:ranked[0].f.id};
        });
        const counts={}; finalists.forEach(f=>counts[f.id]=0); votes.forEach(v=>counts[v.vote]=Number(counts[v.vote]||0)+1);
        s.juryVotes=votes; s.finaleVoteResults={votes,counts};
        return {third,finalists,jury,votes,counts};
    }

    function juryVotingHTML(finalists,votes){
        const rows=votes.map(v=>{const j=byId(v.juror),t=byId(v.vote);return `<div class="stable-jury-vote-row">${portrait(j,'small')}<strong>${esc(nameOf(j))}</strong><span>votes for</span><strong>${esc(nameOf(t))}</strong></div>`;}).join('');
        return `<div class="stable-jury-voting">${portraits(finalists.map(p=>p.id),'large')}<h3>The Jury Votes</h3><div>${rows||'<p>No eligible jury members were recorded.</p>'}</div><p>Press <strong>Proceed</strong> to reveal the Final Results.</p></div>`;
    }
    function finalTwo() {
        const s = simulation();

        // The active roster is authoritative after the Final 3 eviction.
        const active = activePlayers();
        if (active.length === 2) return active.slice();

        // Only use finalists when exactly two valid finalists are recorded.
        const ids = Array.isArray(s?.finalists) ? s.finalists : [];
        const found = ids.map(byId).filter(Boolean);
        if (found.length === 2) return found;

        // Last resort: explicit final placements.
        const placed = players()
            .filter(p => Number(p.placement) === 1 || Number(p.placement) === 2 || p.status === 'winner' || p.status === 'runner-up')
            .sort((a, b) => Number(a.placement || 99) - Number(b.placement || 99));
        if (placed.length >= 2) return placed.slice(0, 2);

        return [];
    }

    function rawJuryVotes() {
        const s = simulation();
        return Array.isArray(s?.juryVotes) ? s.juryVotes : [];
    }

    function voteFor(jurorId) {
        return rawJuryVotes().find(v =>
            String(v.juror ?? v.jurorId ?? v.voter ?? v.voterId) === String(jurorId)
        ) || null;
    }

    function voteTarget(vote) {
        if (!vote) return null;
        return byId(vote.vote ?? vote.target ?? vote.targetId ?? vote.voteFor ?? vote.votedFor);
    }

    function resolveVoteCounts(finalists) {
        const counts = {};
        finalists.forEach(p => counts[p.id] = 0);
        juryMembers().forEach(j => {
            const target = voteTarget(voteFor(j.id));
            if (target && Object.prototype.hasOwnProperty.call(counts, target.id)) {
                counts[target.id]++;
            }
        });
        return counts;
    }

    function resolveWinnerRunner() {
        const s = simulation();
        const finalists = finalTwo();
        const counts = resolveVoteCounts(finalists);

        let ranked = finalists.slice().sort((a, b) => {
            const diff = Number(counts[b.id] || 0) - Number(counts[a.id] || 0);
            if (diff) return diff;
            return Number(b.ratings?.social || 0) - Number(a.ratings?.social || 0);
        });

        let winner = byId(s?.winner);
        let runner = byId(s?.runnerUp);

        // IDs are authoritative only when they actually belong to the final two.
        if (!winner || !finalists.some(p => p.id === winner.id)) winner = ranked[0] || null;
        if (!runner || !finalists.some(p => p.id === runner.id) || runner.id === winner?.id) {
            runner = ranked.find(p => p.id !== winner?.id) || null;
        }

        // If the vote is available, it is authoritative over an old/stale winner field.
        if (ranked[0]) winner = ranked[0];
        if (ranked[1]) runner = ranked[1];

        if (s) {
            if (winner) s.winner = winner.id;
            if (runner) s.runnerUp = runner.id;
        }
        if (winner) { winner.status = "winner"; winner.placement = 1; }
        if (runner) { runner.status = "runner-up"; runner.placement = 2; }

        return { finalists, winner, runner, counts };
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

    function allPlacements() {
        const s = simulation();
        const map = new Map();

        players().forEach(p => {
            const placement = Number(p.placement || 0);
            if (placement > 0) map.set(p.id, { player: p, placement });
        });

        if (Array.isArray(s?.finalPlacements)) {
            s.finalPlacements.forEach(item => {
                const p = byId(item.id);
                const placement = Number(item.placement || 0);
                if (p && placement > 0) map.set(p.id, { player: p, placement });
            });
        }

        const result = [...map.values()];
        return result.sort((a, b) => a.placement - b.placement);
    }

    function rebuildFinalPlacements(winner, runner) {
        const s = simulation();
        if (!s) return;

        const entries = [];
        if (winner) entries.push({ id: winner.id, name: nameOf(winner), placement: 1 });
        if (runner) entries.push({ id: runner.id, name: nameOf(runner), placement: 2 });

        players().forEach(p => {
            if (p.id === winner?.id || p.id === runner?.id) return;
            const placement = Number(p.placement || 0);
            if (placement >= 3) entries.push({ id: p.id, name: nameOf(p), placement });
        });

        entries.sort((a, b) => a.placement - b.placement);
        s.finalPlacements = entries;
    }

    function playerCard(p, placement, voteTargetPlayer) {
        return `<div class="single-finale-player-card">
            <div class="single-finale-place">${esc(ordinal(placement))} place</div>
            ${portrait(p, "medium")}
            <strong>${esc(nameOf(p))}</strong>
            ${voteTargetPlayer ? `<div class="single-finale-voted"><span>Voted for:</span><br>${esc(nameOf(voteTargetPlayer))}</div>` : ""}
        </div>`;
    }

    function juryHTML() {
        const jury = juryMembers();
        const rows = jury.map(j => {
            const target = voteTarget(voteFor(j.id));
            return `<div class="single-finale-jury-row">
                <div class="single-finale-juror">
                    ${portrait(j, "small")}
                    <strong>${esc(nameOf(j))}</strong>
                    <span>${esc(ordinal(j.placement))} place</span>
                </div>
                <div class="single-finale-arrow">→</div>
                <div class="single-finale-juror">
                    ${target ? portrait(target, "small") : ""}
                    <strong>${target ? esc(nameOf(target)) : "No vote recorded"}</strong>
                </div>
            </div>`;
        }).join("");
        return `<section class="single-finale-section">
            <h3>Jury Members & Votes</h3>
            <p>${jury.length} eligible juror${jury.length === 1 ? "" : "s"}.</p>
            <div class="single-finale-jury-list">
                ${rows || "<p>No eligible jury members were recorded.</p>"}
            </div>
        </section>`;
    }

    function preJuryHTML() {
        const list = preJuryMembers().map(p => playerCard(p, p.placement, null)).join("");
        return `<section class="single-finale-section">
            <h3>Pre-Jury Houseguests</h3>
            <p>These Houseguests were evicted before the jury and did not vote.</p>
            <div class="single-finale-grid">
                ${list || "<p>No pre-jury Houseguests were recorded.</p>"}
            </div>
        </section>`;
    }

    function placementsHTML() {
        const list = allPlacements().map(x => playerCard(x.player, x.placement, null)).join("");
        return `<section class="single-finale-section">
            <h3>Complete Placements</h3>
            <div class="single-finale-grid">
                ${list || "<p>No placements were recorded.</p>"}
            </div>
        </section>`;
    }

    function resultsHTML() {
        const s = simulation();
        const data = resolveWinnerRunner();
        rebuildFinalPlacements(data.winner, data.runner);
        if (s) s.completed = true;

        const tally = data.finalists.map(p =>
            `<div class="single-finale-tally-row"><span>${esc(nameOf(p))}</span><strong>${Number(data.counts[p.id] || 0)} vote${Number(data.counts[p.id] || 0) === 1 ? "" : "s"}</strong></div>`
        ).join("");

        return `<div class="single-finale-results">
            <h2>Final Results</h2>
            <div class="single-finale-champions">
                ${data.winner ? `<div class="single-finale-champion">${portrait(data.winner, "large")}<h2>${esc(nameOf(data.winner))}</h2><p><strong>WINNER</strong></p><p>${Number(data.counts[data.winner.id] || 0)} jury vote${Number(data.counts[data.winner.id] || 0) === 1 ? "" : "s"}</p></div>` : ""}
                ${data.runner ? `<div class="single-finale-champion">${portrait(data.runner, "large")}<h2>${esc(nameOf(data.runner))}</h2><p><strong>RUNNER-UP</strong></p><p>${Number(data.counts[data.runner.id] || 0)} jury vote${Number(data.counts[data.runner.id] || 0) === 1 ? "" : "s"}</p></div>` : ""}
            </div>
            <section class="single-finale-section">
                <h3>Final Vote Count</h3>
                <div class="single-finale-tally">${tally || "<p>No jury votes were recorded.</p>"}</div>
            </section>
            ${juryHTML()}
            ${preJuryHTML()}
            ${placementsHTML()}
        </div>`;
    }

    function showFinalEviction(player, juryView) {
        const s = simulation();
        if (!s || !player || !window.showEvent) return;
        s.finalEvictionReveal = {
            playerId: player.id,
            juryView: juryView,
            nextIndex: Number(juryView?.nextIndex ?? s.currentEventIndex)
        };
        window.showEvent(
            "Final Eviction",
            "EVICTION",
            `<div class="single-finale-eviction">
                ${portrait(player, "large")}
                <h2>${esc(nameOf(player))}</h2>
                <p><strong>${esc(nameOf(player))}</strong> has been evicted from the Big Brother house in <strong>3rd place</strong>.</p>
                <p>The Final 2 have now been decided. Press <strong>Proceed</strong> to reveal the jury vote.</p>
            </div>`,
            { week: s.currentWeek, skipHistory: true, skipLiveView: false }
        );
        save();
    }

   function continueAfterFinalEviction() {
    const s = simulation();
    const pending = s?.finalEvictionReveal;

    if (!pending) return false;

    s.finalEvictionReveal = null;

    /*
     * The actual finale chain is:
     *
     * 0 = Final HOH Part 1
     * 1 = Final HOH Part 2
     * 2 = Final HOH Part 3
     * 3 = Final Eviction
     * 4 = Jury Voting
     * 5 = Final Results
     *
     * Do NOT hard-code the index unless the chain actually
     * contains these events.
     */
    const juryIndex = Number(
        pending.juryIndex ?? 4
    );

    s.currentEventIndex = juryIndex;

    if (pending.juryContent && window.showEvent) {
        window.showEvent(
            "Jury Voting",
            "JURY VOTING",
            pending.juryContent,
            {
                week: s.currentWeek,
                skipHistory: false,
                skipLiveView: false
            }
        );
    }

    if (window.renderSimulationWeekNavigation) {
        window.renderSimulationWeekNavigation();
    }

    save();

    return true;
}

    function showResults() {
        addStyles();
        const s = simulation();
        const ss = season();
        if (!s || !ss) return;

        const data = resolveWinnerRunner();
        rebuildFinalPlacements(data.winner, data.runner);
        s.completed = true;
        s.currentPhase = "complete";
        s.finalists = data.finalists.map(p => p.id);
        s.jury = juryMembers().map(p => p.id);

        const seasonName = document.getElementById("results-season-name");
        const winnerName = document.getElementById("winner-name");
        const runnerName = document.getElementById("runner-up-name");
        if (seasonName) seasonName.textContent = ss.name || "Big Brother";
        if (winnerName) winnerName.textContent = data.winner ? nameOf(data.winner) : "—";
        if (runnerName) runnerName.textContent = data.runner ? nameOf(data.runner) : "—";

        const placementBox = document.getElementById("final-placements");
        if (placementBox) placementBox.innerHTML = placementsHTML();

        const juryBox = document.getElementById("final-jury-results");
        if (juryBox) {
            const rows = juryMembers().map(j => {
                const target = voteTarget(voteFor(j.id));
                return `<div class="single-finale-jury-row">
                    <div class="single-finale-juror">${portrait(j, "small")}<strong>${esc(nameOf(j))}</strong><span>${esc(ordinal(j.placement))} place</span></div>
                    <div class="single-finale-arrow">→</div>
                    <div class="single-finale-juror">${target ? portrait(target, "small") : ""}<strong>${target ? esc(nameOf(target)) : "No vote recorded"}</strong></div>
                </div>`;
            }).join("");
            const tally = data.finalists.map(p => `<div class="single-finale-tally-row"><span>${esc(nameOf(p))}</span><strong>${Number(data.counts[p.id] || 0)} vote${Number(data.counts[p.id] || 0) === 1 ? "" : "s"}</strong></div>`).join("");
            juryBox.innerHTML = `<h3>Final Vote Count</h3><div class="single-finale-tally">${tally}</div><h3>Jury Members & Votes</h3><div class="single-finale-jury-list">${rows || "<p>No jury members were recorded.</p>"}</div>${preJuryHTML()}`;
        }

        if (window.renderSeasonStatistics) window.renderSeasonStatistics();
        if (window.showPage) window.showPage("results-page");
        save();
    }

   function nextEvent() {
    addStyles();

    const s = simulation();

    if (!s) return;

    /*
     * -------------------------------------------------------
     * FINAL EVICTION REVEAL
     * -------------------------------------------------------
     *
     * The user has already seen the Final 3 eviction screen.
     * Proceed should now reveal the jury vote.
     */
    if (s.finalEvictionReveal) {
        continueAfterFinalEviction();
        return;
    }

    /*
     * Never advance the actual simulation while the user
     * is viewing an old event.
     */
    if (s.isViewingHistory) {
        if (window.returnToCurrentSimulation) {
            window.returnToCurrentSimulation();
        }
        return;
    }

    const isFinale =
        s.currentPhase === "finale" ||
        s.finaleStarted === true;

    /*
     * -------------------------------------------------------
     * FINALE
     * -------------------------------------------------------
     */
    if (isFinale) {

        const index = Number(
            s.currentEventIndex || 0
        );

        /*
         * ---------------------------------------------------
         * FINAL HOH PARTS 1–3
         * ---------------------------------------------------
         *
         * app.js owns these events.
         *
         * Do NOT call ORIGINAL_NEXT() for them here.
         * Doing so can cause the normal event engine and the
         * finale controller to process the same event twice.
         */
        if (
            index === 0 ||
            index === 1 ||
            index === 2
        ) {
            if (window.runFinalHOHEvent) {
                window.runFinalHOHEvent();
            } else if (ORIGINAL_NEXT) {
                ORIGINAL_NEXT();
            }

            save();
            return;
        }

        /*
         * ---------------------------------------------------
         * FINAL 3 → FINAL 2
         * ---------------------------------------------------
         *
         * Event 3 is the dedicated Final Eviction.
         */
        if (
            index === 3 &&
            activePlayers().length === 3
        ) {

            /*
             * Prevent generating the jury vote twice if the
             * event is accidentally requested again.
             */
            if (s.finalEvictionReveal) {
                return;
            }

            const result =
                chooseFinalTwoAndRecordJury();

            if (!result) {
                console.error(
                    "Finale Controller: Could not resolve Final 3 eviction."
                );
                return;
            }

            /*
             * Store the jury screen until the user presses
             * Proceed on the Final Eviction screen.
             */
            s.finalEvictionReveal = {
                playerId: result.third.id,

                juryIndex: 4,

                juryContent:
                    juryVotingHTML(
                        result.finalists,
                        result.votes
                    )
            };

            /*
             * Make absolutely certain the evicted player
             * is recorded as 3rd place.
             */
            result.third.status = "evicted";
            result.third.placement = 3;

            s.currentEventIndex = 3;

            if (window.showEvent) {
                window.showEvent(
                    "Final Eviction",
                    "EVICTION",
                    `
                    <div class="single-finale-eviction">

                        ${portrait(
                            result.third,
                            "large"
                        )}

                        <h2>
                            ${esc(
                                nameOf(result.third)
                            )}
                        </h2>

                        <p>
                            <strong>
                                ${esc(
                                    nameOf(result.third)
                                )}
                            </strong>
                            has been evicted from the
                            Big Brother house in
                            <strong>3rd place</strong>.
                        </p>

                        <p>
                            The Final 2 have now been
                            decided.
                        </p>

                        <p>
                            Press
                            <strong>Proceed</strong>
                            to reveal the jury vote.
                        </p>

                    </div>
                    `,
                    {
                        week: s.currentWeek,
                        skipHistory: true,
                        skipLiveView: false
                    }
                );
            }

            save();
            return;
        }

        /*
         * ---------------------------------------------------
         * JURY VOTING
         * ---------------------------------------------------
         *
         * Event 4 has already been generated by the
         * Final Eviction transition.
         *
         * If the event is reached normally, display it once.
         */
        if (index === 4) {

            const finalists =
                finalTwo();

            /*
             * Make sure jury members are based on placement.
             */
            const jury =
                juryMembers();

            /*
             * If the jury vote does not exist yet, generate it
             * exactly once.
             */
            let votes =
                rawJuryVotes();

            if (
                !votes.length &&
                finalists.length === 2
            ) {

                const generated =
                    jury.map(juror => {

                        const ranked =
                            finalists
                                .map(finalist => {

                                    const bond =
                                        window.allianceBond
                                            ? Number(
                                                window.allianceBond(
                                                    juror.id,
                                                    finalist.id
                                                ) || 0
                                            )
                                            : 0;

                                    const score =
                                        Number(
                                            finalist.ratings?.social || 0
                                        ) * 0.4 +

                                        Number(
                                            finalist.ratings?.strategic || 0
                                        ) * 0.35 +

                                        Number(
                                            finalist.ratings?.general || 0
                                        ) * 0.15 +

                                        Number(
                                            finalist.ratings?.mental || 0
                                        ) * 0.1 +

                                        bond * 0.15 +

                                        Math.random() * 3;

                                    return {
                                        finalist,
                                        score
                                    };
                                })
                                .sort(
                                    (a, b) =>
                                        b.score - a.score
                                );

                        return {
                            juror: juror.id,
                            vote:
                                ranked[0]?.finalist?.id ||
                                null
                        };
                    });

                s.juryVotes = generated;

                votes = generated;
            }

            /*
             * Display jury voting exactly once.
             */
            if (window.showEvent) {

                window.showEvent(
                    "Jury Voting",
                    "JURY VOTING",
                    juryVotingHTML(
                        finalists,
                        votes
                    ),
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
         * ---------------------------------------------------
         * FINAL RESULTS
         * ---------------------------------------------------
         */
        if (index >= 5) {

            showResults();

            save();

            return;
        }
    }

    /*
     * -------------------------------------------------------
     * NORMAL SEASON EVENTS
     * -------------------------------------------------------
     *
     * Anything outside the finale is handed back to the
     * original simulator engine.
     */
    if (ORIGINAL_NEXT) {
        ORIGINAL_NEXT();
    }
}
        if (s.isViewingHistory) { if (window.returnToCurrentSimulation) window.returnToCurrentSimulation(); return; }
        const isFinale = s.currentPhase === 'finale' || s.finaleStarted === true;
        if (isFinale) {
            const index = Number(s.currentEventIndex || 0);
            if (index === 3 && activePlayers().length === 3) {
                const r = chooseFinalTwoAndRecordJury();
                if (!r) return;
                s.currentEventIndex = 3;
                s.finalEvictionReveal = { playerId: r.third.id, juryContent: juryVotingHTML(r.finalists, r.votes) };
                if (window.showEvent) window.showEvent('Final Eviction', 'EVICTION', `<div class="single-finale-eviction">${portrait(r.third, 'large')}<h2>${esc(nameOf(r.third))}</h2><p><strong>${esc(nameOf(r.third))}</strong> has been evicted from the Big Brother house in <strong>3rd place</strong>.</p><p>The Final 2 have now been decided. Press <strong>Proceed</strong> to reveal the jury vote.</p></div>`, { week: s.currentWeek, skipHistory: true, skipLiveView: false });
                save();
                return;
            }
            if (index >= 4) { showResults(); return; }
        }
        if (ORIGINAL_NEXT) ORIGINAL_NEXT();
    }

  function nextEvent() {
    addStyles();

    const s = simulation();

    if (!s) return;

    /*
     * -------------------------------------------------------
     * FINAL EVICTION REVEAL
     * -------------------------------------------------------
     *
     * The user has already seen the Final 3 eviction screen.
     * Proceed should now reveal the jury vote.
     */
    if (s.finalEvictionReveal) {
        continueAfterFinalEviction();
        return;
    }

    /*
     * Never advance the actual simulation while the user
     * is viewing an old event.
     */
    if (s.isViewingHistory) {
        if (window.returnToCurrentSimulation) {
            window.returnToCurrentSimulation();
        }
        return;
    }

    const isFinale =
        s.currentPhase === "finale" ||
        s.finaleStarted === true;

    /*
     * -------------------------------------------------------
     * FINALE
     * -------------------------------------------------------
     */
    if (isFinale) {

        const index = Number(
            s.currentEventIndex || 0
        );

        /*
         * ---------------------------------------------------
         * FINAL HOH PARTS 1–3
         * ---------------------------------------------------
         *
         * app.js owns these events.
         *
         * Do NOT call ORIGINAL_NEXT() for them here.
         * Doing so can cause the normal event engine and the
         * finale controller to process the same event twice.
         */
        if (
            index === 0 ||
            index === 1 ||
            index === 2
        ) {
            if (window.runFinalHOHEvent) {
                window.runFinalHOHEvent();
            } else if (ORIGINAL_NEXT) {
                ORIGINAL_NEXT();
            }

            save();
            return;
        }

        /*
         * ---------------------------------------------------
         * FINAL 3 → FINAL 2
         * ---------------------------------------------------
         *
         * Event 3 is the dedicated Final Eviction.
         */
        if (
            index === 3 &&
            activePlayers().length === 3
        ) {

            /*
             * Prevent generating the jury vote twice if the
             * event is accidentally requested again.
             */
            if (s.finalEvictionReveal) {
                return;
            }

            const result =
                chooseFinalTwoAndRecordJury();

            if (!result) {
                console.error(
                    "Finale Controller: Could not resolve Final 3 eviction."
                );
                return;
            }

            /*
             * Store the jury screen until the user presses
             * Proceed on the Final Eviction screen.
             */
            s.finalEvictionReveal = {
                playerId: result.third.id,

                juryIndex: 4,

                juryContent:
                    juryVotingHTML(
                        result.finalists,
                        result.votes
                    )
            };

            /*
             * Make absolutely certain the evicted player
             * is recorded as 3rd place.
             */
            result.third.status = "evicted";
            result.third.placement = 3;

            s.currentEventIndex = 3;

            if (window.showEvent) {
                window.showEvent(
                    "Final Eviction",
                    "EVICTION",
                    `
                    <div class="single-finale-eviction">

                        ${portrait(
                            result.third,
                            "large"
                        )}

                        <h2>
                            ${esc(
                                nameOf(result.third)
                            )}
                        </h2>

                        <p>
                            <strong>
                                ${esc(
                                    nameOf(result.third)
                                )}
                            </strong>
                            has been evicted from the
                            Big Brother house in
                            <strong>3rd place</strong>.
                        </p>

                        <p>
                            The Final 2 have now been
                            decided.
                        </p>

                        <p>
                            Press
                            <strong>Proceed</strong>
                            to reveal the jury vote.
                        </p>

                    </div>
                    `,
                    {
                        week: s.currentWeek,
                        skipHistory: true,
                        skipLiveView: false
                    }
                );
            }

            save();
            return;
        }

        /*
         * ---------------------------------------------------
         * JURY VOTING
         * ---------------------------------------------------
         *
         * Event 4 has already been generated by the
         * Final Eviction transition.
         *
         * If the event is reached normally, display it once.
         */
        if (index === 4) {

            const finalists =
                finalTwo();

            /*
             * Make sure jury members are based on placement.
             */
            const jury =
                juryMembers();

            /*
             * If the jury vote does not exist yet, generate it
             * exactly once.
             */
            let votes =
                rawJuryVotes();

            if (
                !votes.length &&
                finalists.length === 2
            ) {

                const generated =
                    jury.map(juror => {

                        const ranked =
                            finalists
                                .map(finalist => {

                                    const bond =
                                        window.allianceBond
                                            ? Number(
                                                window.allianceBond(
                                                    juror.id,
                                                    finalist.id
                                                ) || 0
                                            )
                                            : 0;

                                    const score =
                                        Number(
                                            finalist.ratings?.social || 0
                                        ) * 0.4 +

                                        Number(
                                            finalist.ratings?.strategic || 0
                                        ) * 0.35 +

                                        Number(
                                            finalist.ratings?.general || 0
                                        ) * 0.15 +

                                        Number(
                                            finalist.ratings?.mental || 0
                                        ) * 0.1 +

                                        bond * 0.15 +

                                        Math.random() * 3;

                                    return {
                                        finalist,
                                        score
                                    };
                                })
                                .sort(
                                    (a, b) =>
                                        b.score - a.score
                                );

                        return {
                            juror: juror.id,
                            vote:
                                ranked[0]?.finalist?.id ||
                                null
                        };
                    });

                s.juryVotes = generated;

                votes = generated;
            }

            /*
             * Display jury voting exactly once.
             */
            if (window.showEvent) {

                window.showEvent(
                    "Jury Voting",
                    "JURY VOTING",
                    juryVotingHTML(
                        finalists,
                        votes
                    ),
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
         * ---------------------------------------------------
         * FINAL RESULTS
         * ---------------------------------------------------
         */
        if (index >= 5) {

            showResults();

            save();

            return;
        }
    }

    /*
     * -------------------------------------------------------
     * NORMAL SEASON EVENTS
     * -------------------------------------------------------
     *
     * Anything outside the finale is handed back to the
     * original simulator engine.
     */
    if (ORIGINAL_NEXT) {
        ORIGINAL_NEXT();
    }
}

})();
