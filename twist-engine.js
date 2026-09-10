/*
 * BIG BROTHER SIMULATOR — STABLE ENGINE V3
 *
 * Loaded after app.js.  This file owns the simulator's event pointer and
 * presentation/navigation layer so the older duplicate runNextEvent()
 * implementations in app.js cannot fight the active engine.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "bigBrotherSimulatorSeasons";

    function season() { return window.currentSeason || null; }

    function simulation() {
        const s = season();
        if (!s) return null;
        if (!s.simulation) {
            s.simulation = window.createDefaultSimulation
                ? window.createDefaultSimulation()
                : { currentWeek: 1, currentEventIndex: 0, history: [] };
        }
        if (window.ensureSimulationRuntimeState) {
            window.ensureSimulationRuntimeState(s.simulation);
        }
        return s.simulation;
    }

    function players() {
        return window.getActiveHouseguests ? window.getActiveHouseguests() : [];
    }

    function byId(id) {
        return (season()?.houseguests || []).find(p => p.id === id) || null;
    }

    function displayName(id) {
        if (!id) return "—";
        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(id, season()?.houseguests || [])
            : (byId(id)?.name || "—");
    }

    function portrait(p, size) {
        return window.simulationPortrait ? window.simulationPortrait(p, size) : "";
    }

    function portraits(ids, size) {
        return window.simulationPortraits ? window.simulationPortraits(ids, size) : "";
    }

    function esc(v) {
        return window.escapeHTML ? window.escapeHTML(String(v ?? "")) : String(v ?? "");
    }

    function save() {
        if (window.persistCurrentSeason) window.persistCurrentSeason();
        else {
            try {
                const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                const s = season();
                const i = list.findIndex(x => x.id === s?.id);
                if (i >= 0) {
                    list[i] = JSON.parse(JSON.stringify(s));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                }
            } catch (e) { console.error(e); }
        }
    }

    function refresh() {
        const s = simulation();
        if (!s) return;
        if (window.setText) window.setText("current-week", s.currentWeek || 1);
        if (window.updateSimulatorStatus) window.updateSimulatorStatus(s);
        renderGameChain();
        renderNavigation();
        if (window.renderMemoryWallMini) window.renderMemoryWallMini();
        if (window.updateProceedButtonForViewMode) window.updateProceedButtonForViewMode();
    }

    function show(title, type, content, options) {
        const s = simulation();
        if (s && !(options && options.skipHistory)) {
            s.isViewingHistory = false;
            s.viewingWeek = Number(s.currentWeek || 1);
        }
        if (window.showEvent) {
            window.showEvent(title, type, content, Object.assign({ week: simulation()?.currentWeek }, options || {}));
        }
        refresh();
        save();
    }

    function seasonWeeks() {
        return Number(window.getSeasonLength ? window.getSeasonLength(season()) : 1) || 1;
    }

    function weekCompetitions(week) {
        return window.getWeekCompetitions ? (window.getWeekCompetitions(Number(week)) || []) : [];
    }

    function safetyCompetitions(week) {
        return weekCompetitions(week).filter(c => String(c?.type || "").toLowerCase() === "safety");
    }

    function specialCompetitions(week) {
        return weekCompetitions(week).filter(c => {
            const t = String(c?.type || "").toLowerCase();
            return t === "special" || t === "luxury";
        });
    }

    function finalHOHCompetitions() {
        const s = season();
        const list = [];
        const seen = new Set();
        const add = c => {
            if (c && !seen.has(c.id)) { seen.add(c.id); list.push(c); }
        };

        (s?.competitions?.finalHoh || []).forEach(add);
        const byWeek = s?.competitionWeeks || {};
        Object.values(byWeek).forEach(arr => (arr || []).filter(c => c?.type === "finalHoh").forEach(add));
        return list;
    }

    function finalHOHEventChain() {
        const finalists = getFinalists();
        if (finalists.length < 3) {
            return [
                { key: "jury-voting", label: "Jury Voting" },
                { key: "finale-results", label: "Final Results" }
            ];
        }

        const comps = finalHOHCompetitions();
        return [
            { key: "final-hoh-1", label: comps[0]?.name || "Final HOH — Part 1", competitionId: comps[0]?.id || null, part: 1 },
            { key: "final-hoh-2", label: comps[1]?.name || "Final HOH — Part 2", competitionId: comps[1]?.id || null, part: 2 },
            { key: "final-hoh-3", label: comps[2]?.name || "Final HOH — Part 3", competitionId: comps[2]?.id || null, part: 3 },
            { key: "jury-voting", label: "Jury Voting" },
            { key: "finale-results", label: "Final Results" }
        ];
    }

    function getFinalists() {
        const s = simulation();
        const active = players();
        if (Array.isArray(s?.finalists) && s.finalists.length) {
            const found = s.finalists.map(byId).filter(Boolean);
            if (found.length) return found;
        }
        return active.slice();
    }

    function regularChain(week) {
        const s = simulation();
        const seasonObj = season();
        if (!s || !seasonObj) return [];
        const chain = [];

        if (window.getScheduledTwistsForWeek) {
            (window.getScheduledTwistsForWeek(Number(week)) || []).forEach(t => {
                chain.push({ key: "twist", label: t.name || "Twist", twistId: t.id });
            });
        }

        const hoh = window.getCompetitionForWeekType
            ? window.getCompetitionForWeekType(Number(week), "hoh")
            : null;
        const pov = window.getCompetitionForWeekType
            ? window.getCompetitionForWeekType(Number(week), "pov")
            : null;

        chain.push({ key: "hoh", label: hoh?.name || "HOH Competition", competitionId: hoh?.id || null });

        /* Safety is intentionally BEFORE nominations. */
        safetyCompetitions(week).forEach(c => {
            chain.push({ key: "safety", label: c.name || "Safety Competition", competitionId: c.id });
        });

        chain.push({ key: "nominations", label: "Nominations" });

        if (seasonObj.rules?.vetoEnabled !== false) {
            chain.push({ key: "pov-players", label: "POV Picked Players" });
            chain.push({ key: "pov", label: pov?.name || "POV Competition", competitionId: pov?.id || null });
            chain.push({ key: "veto-ceremony", label: "Veto Ceremony" });
        }

        specialCompetitions(week).forEach(c => {
            chain.push({ key: "custom-competition", label: c.name || "Special Competition", competitionId: c.id });
        });

        chain.push({ key: "eviction-voting", label: "Eviction Voting" });
        chain.push({ key: "eviction", label: "Eviction" });
        return chain;
    }

    function getEventChain(week) {
        const s = simulation();
        if (!s) return [];
        if (s.currentPhase === "finale" || s.finaleStarted) return finalHOHEventChain();
        return regularChain(week);
    }

    /* ---------------------------------------------------------
       Safety
       --------------------------------------------------------- */
    function runSafetyEvent(competitionId) {
        const s = simulation();
        const comp = weekCompetitions(s.currentWeek).find(c => c.id === competitionId);
        const pool = players();
        if (!comp || !pool.length) {
            s.currentSafetyWinner = null;
            s.safetyWinner = null;
            s.currentEventIndex++;
            show("Safety Competition", "SAFETY COMPETITION", "<p>No safety competition was available.</p>");
            return;
        }

        let winner = null;
        if (window.chooseCompetitionWinnerByCustom) winner = window.chooseCompetitionWinnerByCustom(pool, comp);
        if (!winner && window.chooseCompetitionWinner) winner = window.chooseCompetitionWinner(pool, comp.primary || "physical", comp.secondary || "mental", "general");
        if (!winner) winner = pool[Math.floor(Math.random() * pool.length)];

        s.currentSafetyWinner = winner.id;
        s.safetyWinner = winner.id;
        winner.safetyWins = Number(winner.safetyWins || 0) + 1;
        s.currentEventIndex++;

        show(comp.name || "Safety Competition", "SAFETY COMPETITION", `
            <div class="stable-event-card">
                ${portrait(winner, "large")}
                <h3>${esc(displayName(winner.id))}</h3>
                <p>has won <strong>${esc(comp.name || "Safety")}</strong>.</p>
                <p>This Houseguest is safe from nomination this week.</p>
                ${comp.description ? `<p>${esc(comp.description)}</p>` : ""}
            </div>
        `);
    }

    /* ---------------------------------------------------------
       Nominations
       --------------------------------------------------------- */
    function runNominations() {
        const s = simulation();
        const all = players();
        const protectedIds = new Set();
        if (s.currentSafetyWinner) protectedIds.add(s.currentSafetyWinner);

        if (window.getUsableTwistStates) {
            (window.getUsableTwistStates(s.currentWeek, "immunity") || []).forEach(x => {
                if (x?.state?.holderId) protectedIds.add(x.state.holderId);
            });
        }

        const eligible = all.filter(p => p.id !== s.currentHOH && !protectedIds.has(p.id));
        const count = Math.min(Number(season().rules?.nomineesPerWeek || 2), eligible.length);
        let nominees = window.chooseRandomPlayers ? window.chooseRandomPlayers(eligible, count) : eligible.slice(0, count);

        if (window.getUsableTwistStates) {
            const voidPower = window.getUsableTwistStates(s.currentWeek, "nominationVoid")
                .find(x => nominees.some(n => n.id === x.state?.holderId));
            if (voidPower) {
                voidPower.state.used = true;
                const ids = new Set(nominees.map(n => n.id));
                const pool = eligible.filter(p => !ids.has(p.id));
                const replacements = window.chooseRandomPlayers ? window.chooseRandomPlayers(pool, count) : pool.slice(0, count);
                if (replacements.length === count) nominees = replacements;
            }
        }

        s.currentNominees = nominees.map(p => p.id);
        nominees.forEach(p => p.nominationCount = Number(p.nominationCount || 0) + 1);
        s.currentEventIndex++;

        show("Nominations", "NOMINATION CEREMONY", `
            <div class="stable-ceremony">
                <h3>Head of Household</h3>
                ${portrait(byId(s.currentHOH), "large")}
                ${s.currentSafetyWinner ? `<h3>Safety</h3>${portrait(byId(s.currentSafetyWinner), "large")}<p><strong>${esc(displayName(s.currentSafetyWinner))}</strong> is safe and cannot be nominated.</p>` : ""}
                <p><strong>${esc(displayName(s.currentHOH))}</strong> has nominated:</p>
                ${portraits(s.currentNominees, "large")}
            </div>
        `);
    }

    /* ---------------------------------------------------------
       Eviction voting
       --------------------------------------------------------- */
    function runEvictionVoting() {
        const s = simulation();
        const nominees = (s.currentNominees || []).map(byId).filter(Boolean);
        const voters = players().filter(p => p.id !== s.currentHOH && !nominees.some(n => n.id === p.id));

        if (nominees.length < 2) {
            const target = nominees[0] || null;
            s.pendingEvictionId = target?.id || null;
            s.evictionVoteResult = { target: target?.id || null, counts: target ? {[target.id]: 0} : {}, votes: [], targetVotes: 0 };
            s.currentEventIndex++;
            show("Eviction Voting", "EVICTION VOTING", `<div class="stable-voting-screen"><h3>Eviction Voting</h3><p>There are not enough nominees for a standard vote.</p></div>`);
            return;
        }

        const votes = [];
        voters.forEach(voter => {
            const ranked = nominees.map(target => {
                const bond = window.allianceBond ? Number(window.allianceBond(voter.id, target.id) || 0) : 0;
                const threat = (Number(target.ratings?.strategic || 0) + Number(target.ratings?.social || 0)) * 0.20;
                return { target, score: 10 - bond + threat + Math.random() * 5 };
            }).sort((a, b) => b.score - a.score);
            if (ranked[0]) votes.push({ voter: voter.id, target: ranked[0].target.id });
        });

        const counts = {};
        nominees.forEach(n => counts[n.id] = 0);
        votes.forEach(v => counts[v.target] = Number(counts[v.target] || 0) + 1);

        const max = Math.max(...nominees.map(n => counts[n.id] || 0));
        const tied = nominees.filter(n => (counts[n.id] || 0) === max);
        let target = tied[0] || nominees[0];
        let tieBreak = null;

        if (tied.length > 1) {
            const options = tied.filter(p => p.id !== s.currentHOH);
            target = options[Math.floor(Math.random() * options.length)] || tied[0];
            tieBreak = { voter: s.currentHOH, target: target.id };
            votes.push(tieBreak);
            counts[target.id] = Number(counts[target.id] || 0) + 1;
        }

        s.pendingEvictionId = target.id;
        s.evictionVoteResult = {
            target: target.id,
            counts,
            targetVotes: counts[target.id] || 0,
            votes: votes.slice(),
            totalVotes: votes.length,
            tieBreak
        };
        s.currentEventIndex++;

        const rows = votes.map(v => {
            const voter = byId(v.voter);
            const votedFor = byId(v.target);
            const label = v === tieBreak ? "tie-break vote" : "votes to evict";
            return `
                <div class="stable-vote-row">
                    <div class="stable-vote-person">${portrait(voter, "medium")}<strong>${esc(displayName(voter?.id))}</strong></div>
                    <div class="stable-vote-middle"><span>${label}</span><b>→</b></div>
                    <div class="stable-vote-person">${portrait(votedFor, "medium")}<strong>${esc(displayName(votedFor?.id))}</strong></div>
                </div>
            `;
        }).join("");

        const tally = nominees.map(n => `
            <div class="stable-vote-tally-item">
                <strong>${esc(displayName(n.id))}</strong>
                <span>${counts[n.id] || 0} vote${(counts[n.id] || 0) === 1 ? "" : "s"}</span>
            </div>
        `).join("");

        show("Eviction Voting", "EVICTION VOTING", `
            <div class="stable-voting-screen">
                <h3>The Houseguests Have Voted</h3>
                <div class="stable-vote-list">${rows}</div>
                <div class="stable-vote-tally">${tally}</div>
                <p class="stable-voting-note">The votes have been recorded. Press <strong>Proceed</strong> to reveal the eviction.</p>
            </div>
        `);
    }

    /* ---------------------------------------------------------
       Eviction
       --------------------------------------------------------- */
    function runEviction() {
        const s = simulation();
        const seasonObj = season();
        const week = Number(s.currentWeek || 1);
        const result = s.evictionVoteResult || {};
        const target = byId(s.pendingEvictionId || result.target);

        if (!target) {
            s.currentEventIndex = regularChain(week).length;
            s.pendingCycle = "nextWeek";
            s.pendingWeekAdvance = true;
            show("Eviction", "EVICTION", "<p>No eviction can occur because there are no current nominees.</p>");
            return;
        }

        const activeBefore = players();
        const placement = activeBefore.length;
        target.status = "evicted";
        target.placement = placement;
        target.evictionVotesReceived = Number(target.evictionVotesReceived || 0) + Number(result.targetVotes || 0);
        s.currentEviction = target.id;
        if (!Array.isArray(s.finalPlacements)) s.finalPlacements = [];
        s.finalPlacements = s.finalPlacements.filter(x => x.id !== target.id);
        s.finalPlacements.push({ id: target.id, name: target.name, placement });
        s.evictionsThisWeek = Number(s.evictionsThisWeek || 0) + 1;

        const remaining = players();
        // Big Brother's finale sequence starts at FINAL 3. The configured number
        // of finalists describes the eventual Final 2 result, not another regular
        // week at three Houseguests.
        const finalistCount = 3;
        const isDouble = seasonObj.rules?.doubleEvictionEnabled === true &&
            (seasonObj.rules?.doubleEvictionWeeks || []).map(Number).includes(week) &&
            s.evictionsThisWeek < 2;

        const votes = Number(result.targetVotes || 0);
        s.pendingEvictionId = null;
        s.evictionVoteResult = null;
        s.currentEventIndex = regularChain(week).length;

        if (remaining.length <= finalistCount) {
            s.pendingCycle = "finale";
            s.pendingWeekAdvance = false;
        } else if (isDouble) {
            s.pendingCycle = "double";
            s.pendingWeekAdvance = false;
        } else {
            s.pendingCycle = "nextWeek";
            s.pendingWeekAdvance = true;
        }

        show("Eviction", "EVICTION", `
            <div class="stable-eviction-result">
                ${portrait(target, "large")}
                <h2>${esc(displayName(target.id))}</h2>
                <p><strong>${esc(displayName(target.id))}</strong> has been evicted from the Big Brother house.</p>
                ${votes ? `<p>Final vote: <strong>${votes}</strong> vote${votes === 1 ? "" : "s"} to evict.</p>` : ""}
                ${s.pendingCycle === "double"
                    ? `<p><strong>Double Eviction:</strong> Press Proceed to begin the next HOH.</p>`
                    : s.pendingCycle === "finale"
                        ? `<p>The house has reached the finale. Press <strong>Proceed</strong> to begin it.</p>`
                        : `<p>Press <strong>Proceed</strong> to begin Week ${week + 1}.</p>`}
            </div>
        `);
    }

    /* ---------------------------------------------------------
       Finale
       --------------------------------------------------------- */
    function getEligibleJuryIds() {
        const jurySize = Math.max(0, Number(season()?.rules?.jurySize ?? 7));
        return (season()?.houseguests || [])
            .filter(p => p.status === "evicted" && Number(p.placement) >= 4)
            .sort((a, b) => Number(a.placement) - Number(b.placement))
            .slice(0, jurySize)
            .map(p => p.id);
    }

    function startFinale() {
        const s = simulation();
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;
        s.currentPhase = "finale";
        s.finaleStarted = true;
        s.currentEventIndex = 0;
        s.viewingWeek = seasonWeeks();
        s.finalists = players().map(p => p.id);
        s.jury = getEligibleJuryIds();
        s.finalHOH1 = null;
        s.finalHOH2 = null;
        s.finalHOH3 = null;
        show("Finale", "FINALE", `<div class="stable-finale-intro">${portraits(s.finalists, "large")}<p><strong>${s.finalists.length} finalists remain.</strong></p><p>Press <strong>Proceed</strong> to begin the finale.</p></div>`);
    }

    function chooseFinalWinner(pool, comp) {
        if (!pool.length) return null;
        let winner = null;
        if (comp && window.chooseCompetitionWinnerByCustom) winner = window.chooseCompetitionWinnerByCustom(pool, comp);
        if (!winner && window.chooseCompetitionWinner) winner = window.chooseCompetitionWinner(pool, comp?.primary || "mental", comp?.secondary || "physical", "general");
        return winner || pool[Math.floor(Math.random() * pool.length)];
    }

    function runFinalHOHPart(part) {
        const s = simulation();
        const finalists = getFinalists();
        const comps = finalHOHCompetitions();
        const comp = comps[part - 1] || null;
        let pool;

        if (finalists.length < 3) {
            s.currentEventIndex++;
            show(`Final HOH — Part ${part}`, "FINAL HOH", "<p>The Final HOH competition is skipped because fewer than three finalists remain.</p>");
            return;
        }

        if (part === 1) pool = finalists;
        else if (part === 2) pool = finalists.filter(p => p.id !== s.finalHOH1);
        else pool = finalists.filter(p => p.id === s.finalHOH1 || p.id === s.finalHOH2);

        if (pool.length < 2 && part !== 1) pool = finalists.slice();
        const winner = chooseFinalWinner(pool, comp);
        s[`finalHOH${part}`] = winner.id;
        if (part === 3) s.finalHOH = winner.id;
        s.currentEventIndex++;

        const title = comp?.name || `Final HOH — Part ${part}`;
        show(title, "FINAL HOH", `
            <div class="stable-final-hoh">
                <h2>Final HOH — Part ${part}</h2>
                ${portrait(winner, "large")}
                <p><strong>${esc(displayName(winner.id))}</strong> has won <strong>${esc(title)}</strong>.</p>
                ${part < 3 ? `<p>Press <strong>Proceed</strong> for Final HOH Part ${part + 1}.</p>` : `<p>Final HOH Part 3 is complete. Press <strong>Proceed</strong> for the final two decision and jury vote.</p>`}
            </div>
        `);
    }

    function runJuryVoting() {
        const s = simulation();
        let finalists = getFinalists();
        if (finalists.length > 2) {
            const finalHOH = byId(s.finalHOH3 || s.finalHOH1) || finalists[0];
            const others = finalists.filter(p => p.id !== finalHOH.id);
            const chosen = others.slice().sort((a, b) => {
                const aa = window.allianceBond ? Number(window.allianceBond(finalHOH.id, a.id) || 0) : 0;
                const bb = window.allianceBond ? Number(window.allianceBond(finalHOH.id, b.id) || 0) : 0;
                return bb - aa;
            })[0] || others[0];
            const third = others.find(p => p.id !== chosen.id);
            if (third) {
                third.status = "evicted";
                third.placement = 3;
                if (!Array.isArray(s.finalPlacements)) s.finalPlacements = [];
                s.finalPlacements = s.finalPlacements.filter(x => x.id !== third.id);
                s.finalPlacements.push({ id: third.id, name: third.name, placement: 3 });
            }
            finalists = [finalHOH, chosen].filter(Boolean);
            s.finalists = finalists.map(p => p.id);
        }

        // Rebuild the jury from actual placements immediately before the vote.
        // This is deliberate: it guarantees pre-jury evictees can never vote,
        // even when an older saved simulation contains a stale jury array.
        s.jury = getEligibleJuryIds();
        const votes = [];
        s.jury.forEach(jid => {
            const juror = byId(jid);
            if (!juror || finalists.length < 2) return;
            const ranked = finalists.map(f => {
                const bond = window.allianceBond ? Number(window.allianceBond(jid, f.id) || 0) : 0;
                const score = Number(f.ratings?.social || 0) * .4 + Number(f.ratings?.strategic || 0) * .35 + Number(f.ratings?.general || 0) * .15 + Number(f.ratings?.mental || 0) * .1 + bond * .15 + Math.random() * 3;
                return { f, score };
            }).sort((a, b) => b.score - a.score);
            votes.push({ juror: jid, vote: ranked[0].f.id });
        });

        const counts = {};
        finalists.forEach(f => counts[f.id] = 0);
        votes.forEach(v => counts[v.vote] = Number(counts[v.vote] || 0) + 1);
        s.juryVotes = votes;
        s.finaleVoteResults = { votes, counts };
        s.currentEventIndex++;

        const rows = votes.map(v => `<div class="stable-jury-vote-row">${portrait(byId(v.juror), "small")}<strong>${esc(displayName(v.juror))}</strong><span>votes for</span><strong>${esc(displayName(v.vote))}</strong></div>`).join("");
        show("Jury Voting", "JURY VOTING", `<div class="stable-jury-voting">${portraits(finalists.map(p => p.id), "large")}<h3>The Jury Votes</h3><div>${rows || "<p>No jury members were eligible to vote.</p>"}</div></div>`);
    }

    function ordinal(n) {
        const v = Number(n);
        const mod100 = v % 100;
        if (mod100 >= 11 && mod100 <= 13) return `${v}TH`;
        const mod10 = v % 10;
        if (mod10 === 1) return `${v}ST`;
        if (mod10 === 2) return `${v}ND`;
        if (mod10 === 3) return `${v}RD`;
        return `${v}TH`;
    }

    function runFinalResults() {
        const s = simulation();
        const all = season()?.houseguests || [];
        const finalists = (s.finalists || []).map(byId).filter(Boolean);
        const counts = s.finaleVoteResults?.counts || {};

        const ranked = finalists.slice().sort(
            (a, b) => Number(counts[b.id] || 0) - Number(counts[a.id] || 0)
        );

        const winner = ranked[0] || null;
        const runner = ranked[1] || null;

        if (winner) {
            winner.status = "winner";
            winner.placement = 1;
            s.winner = winner.id;
        }

        if (runner) {
            runner.status = "runner-up";
            runner.placement = 2;
            s.runnerUp = runner.id;
        }

        /*
         * Every non-finalist should already have a placement from
         * the eviction engine. If an old save is missing one, fill
         * the remaining slots from the actual eviction order rather
         * than leaving holes in the memory wall.
         */
        const placementMap = new Map();

        all.forEach(p => {
            if (p.placement != null && Number(p.placement) >= 3) {
                placementMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    placement: Number(p.placement)
                });
            }
        });

        let nextPlacement = all.length;
        all.forEach(p => {
            if (
                p.id !== winner?.id &&
                p.id !== runner?.id &&
                p.placement == null
            ) {
                while (
                    [...placementMap.values()].some(
                        x => x.placement === nextPlacement
                    ) ||
                    nextPlacement === 1 ||
                    nextPlacement === 2
                ) {
                    nextPlacement--;
                }

                p.placement = nextPlacement;
                p.status = "evicted";

                placementMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    placement: nextPlacement
                });

                nextPlacement--;
            }
        });

        const placements = [];

        if (winner) {
            placements.push({
                id: winner.id,
                name: winner.name,
                placement: 1
            });
        }

        if (runner) {
            placements.push({
                id: runner.id,
                name: runner.name,
                placement: 2
            });
        }

        placementMap.forEach(value => {
            if (!placements.some(p => p.id === value.id)) {
                placements.push(value);
            }
        });

        placements.sort(
            (a, b) => Number(a.placement) - Number(b.placement)
        );

        s.finalPlacements = placements;
        s.completed = true;
        s.currentPhase = "complete";
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;
        s.currentEventIndex++;

        const wall = `
            <div class="bb-final-memory-wall stable-inline-memory-wall">
                ${placements.map(item => {
                    const hg = byId(item.id);
                    return `
                        <div class="bb-final-memory-card ${Number(item.placement) === 1 ? "winner" : ""}">
                            <div class="bb-final-place">${ordinal(item.placement)}</div>
                            ${portrait(hg, "medium")}
                            <div class="bb-final-name">${esc(displayName(item.id))}</div>
                            <div class="bb-final-placement">${ordinal(item.placement)} PLACE</div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;

        show(
            "Final Results",
            "FINAL RESULTS",
            `
                <div class="stable-final-results">
                    ${winner ? `
                        ${portrait(winner, "large")}
                        <h2>${esc(displayName(winner.id))}</h2>
                        <p><strong>WINNER</strong> — ${counts[winner.id] || 0} jury vote${Number(counts[winner.id] || 0) === 1 ? "" : "s"}</p>
                    ` : ""}
                    ${runner ? `<p><strong>RUNNER-UP:</strong> ${esc(displayName(runner.id))}</p>` : ""}

                    <h3 class="stable-results-wall-title">Final Placements</h3>
                    ${wall}

                    <button type="button" class="primary-button" onclick="showResults()">
                        View Full Results
                    </button>
                </div>
            `
        );

        save();
    }

    /* ---------------------------------------------------------
       Top event chain
       --------------------------------------------------------- */
    function renderGameChain() {
        const container = document.getElementById("game-chain");
        const s = simulation();
        if (!container || !s) return;

        const chain = getEventChain(Number(s.currentWeek || 1));
        const index = Number(s.currentEventIndex || 0);

        container.innerHTML = chain.map((event, i) => {
            const state =
                i < index ? "completed" :
                i === index ? "active" : "pending";

            return `
                <div class="chain-step ${state}">
                    <span class="chain-number">${i + 1}</span>
                    <span>${esc(event.label)}</span>
                </div>
                ${i < chain.length - 1 ? '<div class="chain-line"></div>' : ''}
            `;
        }).join("");
    }

    function stableViewSimulationWeek(week) {
        const s = simulation();
        if (!s) return;

        const target = Math.max(1, Math.min(
            seasonWeeks(),
            Number(week) || 1
        ));

        const items = (s.history || [])
            .filter(h => Number(h.week) === target)
            .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

        s.viewingWeek = target;

        if (items.length) {
            s.isViewingHistory = true;
            const item = items[items.length - 1];
            if (window.showEvent) {
                window.showEvent(
                    item.title || item.label || "Event",
                    item.type || "EVENT",
                    item.content || "",
                    {
                        skipHistory: true,
                        skipLiveView: true,
                        week: target
                    }
                );
            }
        } else if (target === Number(s.currentWeek || 1)) {
            s.isViewingHistory = false;
            s.viewingWeek = Number(s.currentWeek || 1);
            if (s.liveView && window.showEvent) {
                window.showEvent(
                    s.liveView.title || "Current Event",
                    s.liveView.type || "EVENT",
                    s.liveView.content || "",
                    {
                        skipHistory: true,
                        skipLiveView: true,
                        week: s.liveView.week || s.currentWeek
                    }
                );
            }
        } else {
            s.isViewingHistory = true;
            if (window.showEvent) {
                window.showEvent(
                    `Week ${target}`,
                    "WEEK",
                    `<p>No events have been played for Week ${target} yet.</p>`,
                    {
                        skipHistory: true,
                        skipLiveView: true,
                        week: target
                    }
                );
            }
        }

        refresh();
        save();
    }

    function stableViewHistoryEvent(week, sequence) {
        const s = simulation();
        if (!s) return;

        const item = (s.history || [])
            .filter(h => Number(h.week) === Number(week))
            .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
            [Number(sequence)];

        if (!item) return;

        s.isViewingHistory = true;
        s.viewingWeek = Number(item.week || s.currentWeek || 1);

        if (window.showEvent) {
            window.showEvent(
                item.title || item.label || "Event",
                item.type || "EVENT",
                item.content || "",
                {
                    skipHistory: true,
                    skipLiveView: true,
                    week: item.week
                }
            );
        }

        refresh();
        save();
    }

    /* ---------------------------------------------------------
       Navigation
       --------------------------------------------------------- */
    function renderNavigation() {
        const container = document.getElementById("sim-week-navigation");
        const s = simulation();
        const seasonObj = season();
        if (!container || !s || !seasonObj) return;

        const max = seasonWeeks();
        const currentWeek = Number(s.currentWeek || 1);
        const viewingWeek = Number(s.viewingWeek || currentWeek);
        const history = Array.isArray(s.history) ? s.history.slice() : [];
        const html = [];

        for (let w = 1; w <= max; w++) {
            const current = w === currentWeek;
            const viewing = w === viewingWeek;
            const items = history.filter(h => Number(h.week) === w).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
            const chain = current && s.currentPhase === "finale" ? finalHOHEventChain() : regularChain(w);
            const lastKey = items.length ? (items[items.length - 1].event || items[items.length - 1].key) : null;

            html.push(`<div class="sim-week-block ${current ? "current" : ""} ${viewing ? "viewing" : ""} ${w < currentWeek ? "past" : ""}">`);
            html.push(`<button type="button" class="sim-week-label" data-sim-week="${w}">Week ${w}</button>`);

            if (viewing) {
                html.push(`<div class="sim-event-list">`);
                items.forEach((item, i) => {
                    const isLast = current && !s.isViewingHistory && i === items.length - 1;
                    html.push(`<button type="button" class="sim-event-nav completed ${isLast ? "current-result" : ""}" data-history-week="${w}" data-history-index="${i}"><span>${esc(item.label || item.title || "Event")}</span></button>`);
                });

                if (current && !s.isViewingHistory && !s.pendingWeekAdvance && !s.pendingCycle && s.currentPhase !== "complete") {
                    const index = Number(s.currentEventIndex || 0);
                    chain.slice(index).forEach((event, i) => {
                        html.push(`<div class="sim-event-nav ${i === 0 ? "active-pending" : "pending"}"><span>${esc(event.label)}</span></div>`);
                    });
                }
                html.push(`</div>`);
            }
            html.push(`</div>`);
        }

        container.innerHTML = html.join("");
        container.querySelectorAll("[data-sim-week]").forEach(btn => btn.addEventListener("click", () => {
            if (window.viewSimulationWeek) window.viewSimulationWeek(Number(btn.dataset.simWeek));
        }));
        container.querySelectorAll("[data-history-week]").forEach(btn => btn.addEventListener("click", () => {
            const w = Number(btn.dataset.historyWeek);
            const i = Number(btn.dataset.historyIndex);
            const items = (s.history || []).filter(h => Number(h.week) === w).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
            if (items[i] && window.showHistoricalSimulationEvent) window.showHistoricalSimulationEvent(items[i]);
        }));
    }

    /* ---------------------------------------------------------
       Re-simulation
       --------------------------------------------------------- */
    function resetRuntime() {
        const seasonObj = season();
        if (!seasonObj) return;
        (seasonObj.houseguests || []).forEach(p => {
            p.status = "active";
            p.placement = null;
            p.weeksInGame = 0;
            p.hohWins = 0;
            p.povWins = 0;
            p.safetyWins = 0;
            p.nominationCount = 0;
            p.vetoUsedOn = [];
            p.evictionVotesReceived = 0;
        });

        const fresh = window.createDefaultSimulation
            ? window.createDefaultSimulation()
            : { started: false, completed: false, currentWeek: 1, currentPhase: "setup", currentEventIndex: 0, history: [] };
        seasonObj.simulation = fresh;
        const s = seasonObj.simulation;
        s.started = false;
        s.completed = false;
        s.currentWeek = 1;
        s.viewingWeek = 1;
        s.currentPhase = "setup";
        s.currentEventIndex = 0;
        s.history = [];
        s.weekHistory = [];
        s.finalPlacements = [];
        s.winner = null;
        s.runnerUp = null;
        s.jury = [];
        s.juryVotes = [];
        s.finalists = [];
        s.finalHOH = null;
        s.finalHOH1 = null;
        s.finalHOH2 = null;
        s.finalHOH3 = null;
        s.finaleStarted = false;
        s.finaleVoteResults = null;
        s.currentHOH = null;
        s.currentNominees = [];
        s.currentPOVPlayers = [];
        s.currentPOVWinner = null;
        s.currentSafetyWinner = null;
        s.safetyWinner = null;
        s.currentEviction = null;
        s.pendingEvictionId = null;
        s.evictionVoteResult = null;
        s.evictionsThisWeek = 0;
        s.pendingWeekAdvance = false;
        s.pendingCycle = null;
        s.isViewingHistory = false;
        s.liveView = null;
        s.vetoDrawCounts = {};
        s.lastVetoDrawnIds = [];
        s.twistState = {};
        save();
    }

    function resimulateSeason() {
        const s = season();
        if (!s) { alert("Please open a saved season first."); return; }
        if (!confirm(`Re-simulate "${s.name || "this season"}" from the beginning?\n\nYour cast, portraits, ratings, relationships, alliances, competitions, twists, and rules will be kept.`)) return;
        resetRuntime();
        if (window.showPage) window.showPage("simulator-page");
        if (window.initializeSimulator) window.initializeSimulator(season());
        setTimeout(() => {
            renderNavigation();
            refresh();
        }, 0);
    }

    /* ---------------------------------------------------------
       Results / placement memory wall
       --------------------------------------------------------- */
    function renderFinalPlacements() {
        const container = document.getElementById("final-placements");
        const s = simulation();
        if (!container || !s) return;

        let placements = Array.isArray(s.finalPlacements) ? s.finalPlacements.slice() : [];
        const all = season()?.houseguests || [];
        if (!placements.length) {
            placements = all.filter(p => p.placement != null).map(p => ({ id: p.id, name: p.name, placement: Number(p.placement) }));
        }
        placements.sort((a, b) => Number(a.placement) - Number(b.placement));

        if (!placements.length) {
            container.innerHTML = `<div class="empty-state"><h3>No Placements Yet</h3><p>Finish the simulation to see final placements.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="bb-final-memory-wall">
                ${placements.map(p => {
                    const hg = byId(p.id);
                    const place = Number(p.placement);
                    const winner = place === 1;
                    return `
                        <div class="bb-final-memory-card ${winner ? "winner" : ""}">
                            <div class="bb-final-place">${place}${place === 1 ? "ST" : place === 2 ? "ND" : place === 3 ? "RD" : "TH"}</div>
                            ${portrait(hg, "medium")}
                            <div class="bb-final-name">${esc(displayName(p.id))}</div>
                            <div class="bb-final-placement">${place}${place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th"} PLACE</div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    function showResultsStable() {
        const s = season();
        if (!s) return;
        const sim = simulation();
        if (window.setText) {
            window.setText("results-season-name", s.name || "Big Brother");
            window.setText("winner-name", displayName(sim.winner));
            window.setText("runner-up-name", displayName(sim.runnerUp));
        }
        renderFinalPlacements();
        if (window.renderSeasonStatistics) window.renderSeasonStatistics();
        if (window.renderFinalJuryResults) window.renderFinalJuryResults();
        if (window.showPage) window.showPage("results-page");
    }

    /* ---------------------------------------------------------
       Main controller
       --------------------------------------------------------- */
    function nextEvent() {
        const s = simulation();
        if (!s) { alert("Please open a saved season first."); return; }

        if (s.isViewingHistory) {
            if (window.returnToCurrentSimulation) window.returnToCurrentSimulation();
            return;
        }

        if (s.pendingCycle === "finale") {
            startFinale();
            return;
        }

        if (s.pendingCycle === "nextWeek" || s.pendingWeekAdvance) {
            const next = Number(s.currentWeek || 1) + 1;
            if (next > seasonWeeks()) {
                startFinale();
                return;
            }
            s.currentWeek = next;
            s.viewingWeek = next;
            s.currentEventIndex = 0;
            s.evictionsThisWeek = 0;
            s.currentHOH = null;
            s.currentSafetyWinner = null;
            s.safetyWinner = null;
            s.currentNominees = [];
            s.currentPOVPlayers = [];
            s.currentPOVWinner = null;
            s.currentEviction = null;
            s.pendingEvictionId = null;
            s.evictionVoteResult = null;
            s.pendingWeekAdvance = false;
            s.pendingCycle = null;
            s.currentPhase = "week";
            s.started = true;
            show(`Week ${next}`, "WEEK", `<p>Week ${next} is now beginning.</p>`);
            return;
        }

        if (s.pendingCycle === "double") {
            s.pendingCycle = null;
            s.pendingWeekAdvance = false;
            s.currentEventIndex = 0;
            s.currentHOH = null;
            s.currentSafetyWinner = null;
            s.safetyWinner = null;
            s.currentNominees = [];
            s.currentPOVPlayers = [];
            s.currentPOVWinner = null;
            s.currentEviction = null;
            s.pendingEvictionId = null;
            s.evictionVoteResult = null;
            s.started = true;
            /* Continue immediately into the second cycle's HOH. */
        }

        if (s.currentPhase === "complete" || s.completed) {
            showResultsStable();
            return;
        }

        // Never run a normal HOH/POV week with only three active Houseguests.
        // This also repairs older saved games that reached Final 3 before this fix.
        if (s.currentPhase !== "finale" && !s.finaleStarted && players().length <= 3) {
            startFinale();
            return;
        }

        if (s.currentPhase === "finale" || s.finaleStarted) {
            const chain = finalHOHEventChain();
            const index = Number(s.currentEventIndex || 0);
            const event = chain[index];
            if (!event) { showResultsStable(); return; }
            s.started = true;
            s.renderingEventKey = event.key;
            s.renderingEventLabel = event.label;
            if (event.key === "final-hoh-1") runFinalHOHPart(1);
            else if (event.key === "final-hoh-2") runFinalHOHPart(2);
            else if (event.key === "final-hoh-3") runFinalHOHPart(3);
            else if (event.key === "jury-voting") runJuryVoting();
            else if (event.key === "finale-results") runFinalResults();
            return;
        }

        const week = Number(s.currentWeek || 1);
        const chain = regularChain(week);
        const index = Number(s.currentEventIndex || 0);
        const event = chain[index];

        if (!event) {
            s.pendingWeekAdvance = true;
            s.pendingCycle = "nextWeek";
            refresh();
            save();
            return;
        }

        s.started = true;
        s.currentPhase = "week";
        s.viewingWeek = week;
        s.renderingEventKey = event.key;
        s.renderingEventLabel = event.label;

        switch (event.key) {
            case "twist":
                if (window.runTwistEvent) window.runTwistEvent(event.twistId);
                else s.currentEventIndex++;
                break;
            case "hoh":
                if (window.runHOHEvent) window.runHOHEvent(); else s.currentEventIndex++;
                break;
            case "safety":
                runSafetyEvent(event.competitionId);
                break;
            case "nominations":
                runNominations();
                break;
            case "pov-players":
                if (window.runPOVPlayersEvent) window.runPOVPlayersEvent(); else s.currentEventIndex++;
                break;
            case "pov":
                if (window.runPOVEvent) window.runPOVEvent(); else s.currentEventIndex++;
                break;
            case "veto-ceremony":
                if (window.runVetoCeremonyEvent) window.runVetoCeremonyEvent(); else s.currentEventIndex++;
                break;
            case "custom-competition":
                if (window.runCustomCompetitionEvent) window.runCustomCompetitionEvent(event.competitionId); else s.currentEventIndex++;
                break;
            case "eviction-voting":
                runEvictionVoting();
                break;
            case "eviction":
                runEviction();
                break;
            default:
                s.currentEventIndex++;
                break;
        }
        refresh();
        save();
    }

    /* Public overrides. */
    window.getWeekEventChain = getEventChain;
    window.getFinaleChain = finalHOHEventChain;
    window.runNextEvent = nextEvent;
    window.runEvictionVotingEvent = runEvictionVoting;
    window.renderSimulationWeekNavigation = renderNavigation;
    window.renderDynamicGameChain = renderGameChain;
    window.viewSimulationWeek = stableViewSimulationWeek;
    window.viewSimulationHistoryEvent = stableViewHistoryEvent;
    window.resimulateSeason = resimulateSeason;
    window.renderFinalPlacements = renderFinalPlacements;
    window.showResults = showResultsStable;
    window.runStableSafetyEvent = runSafetyEvent;
    window.runStableEvictionVotingEvent = runEvictionVoting;
    window.runStableEvictionEvent = runEviction;

    document.addEventListener("DOMContentLoaded", () => setTimeout(refresh, 0));

    console.log("Big Brother Simulator Stable Engine V3 loaded.");
})();
