/*
 * BIG BROTHER SIMULATOR - STABLE ENGINE
 * Loaded after app.js.
 *
 * This file owns the simulator event pointer.  It does not call the old
 * runNextEvent(), which was one of the sources of duplicate/contradictory
 * event chains in the original app.js.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "bigBrotherSimulatorSeasons";

    function getSeason() {
        return window.currentSeason || null;
    }

    function getSim() {
        const season = getSeason();
        if (!season) return null;
        if (!season.simulation) season.simulation = window.createDefaultSimulation();
        if (window.ensureSimulationRuntimeState) {
            return window.ensureSimulationRuntimeState(season.simulation);
        }
        return season.simulation;
    }

    function active() {
        return window.getActiveHouseguests ? window.getActiveHouseguests() : [];
    }

    function getPlayer(id) {
        const season = getSeason();
        return (season?.houseguests || []).find(p => p.id === id) || null;
    }

    function nameOf(id) {
        const season = getSeason();
        if (!id) return "Unknown";
        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(id, season?.houseguests || [])
            : (getPlayer(id)?.name || "Unknown");
    }

    function seasonLength() {
        const season = getSeason();
        return Number(window.getSeasonLength ? window.getSeasonLength(season) : 1) || 1;
    }

    function save() {
        if (window.persistCurrentSeason) window.persistCurrentSeason();
    }

    function refresh() {
        const s = getSim();
        if (!s) return;
        if (window.setText) window.setText("current-week", s.currentWeek || 1);
        if (window.updateSimulatorStatus) window.updateSimulatorStatus(s);
        renderNavigation();
        if (window.renderMemoryWallMini) window.renderMemoryWallMini();
        if (window.updateProceedButtonForViewMode) window.updateProceedButtonForViewMode();
    }

    function getSafetyCompetitions(week) {
        if (!window.getWeekCompetitions) return [];
        return (window.getWeekCompetitions(Number(week)) || []).filter(c =>
            String(c?.type || "").toLowerCase() === "safety"
        );
    }

    function getSpecialCompetitions(week) {
        if (!window.getWeekCompetitions) return [];
        return (window.getWeekCompetitions(Number(week)) || []).filter(c => {
            const type = String(c?.type || "").toLowerCase();
            return type === "special" || type === "luxury";
        });
    }

    function stableWeekEventChain(week) {
        const season = getSeason();
        const s = getSim();
        if (!season || !s) return [];

        if (s.currentPhase === "finale" || s.finaleStarted) {
            return window.getFinaleChain ? window.getFinaleChain() : [];
        }

        const chain = [];

        if (window.getScheduledTwistsForWeek) {
            (window.getScheduledTwistsForWeek(Number(week)) || []).forEach(t => {
                chain.push({
                    key: "twist",
                    label: t.name || "Twist",
                    twistId: t.id
                });
            });
        }

        const hoh = window.getCompetitionForWeekType
            ? window.getCompetitionForWeekType(Number(week), "hoh")
            : null;
        const pov = window.getCompetitionForWeekType
            ? window.getCompetitionForWeekType(Number(week), "pov")
            : null;

        chain.push({
            key: "hoh",
            label: hoh?.name || "HOH Competition"
        });

        /* Safety MUST occur before nominations. */
        getSafetyCompetitions(week).forEach(c => {
            chain.push({
                key: "safety",
                label: c.name || "Safety Competition",
                competitionId: c.id
            });
        });

        chain.push({ key: "nominations", label: "Nomination Ceremony" });

        if (season.rules?.vetoEnabled !== false) {
            chain.push({ key: "pov-players", label: "Veto Selections" });
            chain.push({ key: "pov", label: pov?.name || "POV Competition" });
            chain.push({ key: "veto-ceremony", label: "Veto Ceremony" });
        }

        getSpecialCompetitions(week).forEach(c => {
            chain.push({
                key: "custom-competition",
                label: c.name || "Special Competition",
                competitionId: c.id
            });
        });

        chain.push({ key: "eviction-voting", label: "Eviction Voting" });
        chain.push({ key: "eviction", label: "Eviction" });

        return chain;
    }

    function simulationPortrait(p, size) {
        return window.simulationPortrait ? window.simulationPortrait(p, size) : "";
    }

    function simulationPortraits(ids, size) {
        return window.simulationPortraits ? window.simulationPortraits(ids, size) : "";
    }

    function htmlEscape(value) {
        return window.escapeHTML ? window.escapeHTML(String(value ?? "")) : String(value ?? "");
    }

    function runSafetyEvent(competitionId) {
        const season = getSeason();
        const s = getSim();
        if (!season || !s) return;

        const comp = (window.getWeekCompetitions ? window.getWeekCompetitions(s.currentWeek) : [])
            .find(c => c.id === competitionId);
        const players = active();

        if (!comp || !players.length) {
            s.currentSafetyWinner = null;
            s.currentEventIndex++;
            showOwnedEvent("Safety Competition", "SAFETY COMPETITION", "<p>No safety competition was available.</p>");
            return;
        }

        let winner = null;
        if (window.chooseCompetitionWinnerByCustom) {
            winner = window.chooseCompetitionWinnerByCustom(players, comp);
        }
        if (!winner && window.chooseCompetitionWinner) {
            winner = window.chooseCompetitionWinner(players, "physical", "mental", "general");
        }
        if (!winner) winner = players[Math.floor(Math.random() * players.length)];

        s.currentSafetyWinner = winner?.id || null;
        s.safetyWinner = winner?.id || null;
        if (winner) winner.safetyWins = Number(winner.safetyWins || 0) + 1;
        s.currentEventIndex++;

        showOwnedEvent(
            comp.name || "Safety Competition",
            "SAFETY COMPETITION",
            `${simulationPortrait(winner, "large")}<p><strong>${htmlEscape(nameOf(winner?.id))}</strong> has won <strong>${htmlEscape(comp.name || "Safety")}</strong>.</p><p>This Houseguest is safe from nomination this week.</p>${comp.description ? `<p class="event-description">${htmlEscape(comp.description)}</p>` : ""}`
        );
    }

    function runNominationEventStable() {
        const season = getSeason();
        const s = getSim();
        if (!season || !s) return;

        const allActive = active();
        const protectedIds = new Set();

        if (s.currentSafetyWinner) protectedIds.add(s.currentSafetyWinner);

        if (window.getUsableTwistStates) {
            (window.getUsableTwistStates(s.currentWeek, "immunity") || []).forEach(x => {
                if (x?.state?.holderId) protectedIds.add(x.state.holderId);
            });
        }

        const hohId = s.currentHOH;
        let eligible = allActive.filter(p => p.id !== hohId && !protectedIds.has(p.id));
        const nomineeCount = Math.min(Number(season.rules?.nomineesPerWeek || 2), eligible.length);

        let nominees = window.chooseRandomPlayers
            ? window.chooseRandomPlayers(eligible, nomineeCount)
            : eligible.slice(0, nomineeCount);

        /* Preserve the existing Nomination Void mechanic. */
        if (window.getUsableTwistStates) {
            const voidPower = window.getUsableTwistStates(s.currentWeek, "nominationVoid")
                .find(x => nominees.some(n => n.id === x.state?.holderId));
            if (voidPower) {
                const originalIds = new Set(nominees.map(n => n.id));
                voidPower.state.used = true;
                const rerollPool = eligible.filter(p => !originalIds.has(p.id));
                const replacements = window.chooseRandomPlayers
                    ? window.chooseRandomPlayers(rerollPool, Math.min(nomineeCount, rerollPool.length))
                    : rerollPool.slice(0, nomineeCount);
                if (replacements.length === nomineeCount) nominees = replacements;
            }
        }

        s.currentNominees = nominees.map(p => p.id);
        nominees.forEach(p => p.nominationCount = Number(p.nominationCount || 0) + 1);
        s.currentEventIndex++;

        const hoh = getPlayer(hohId);
        const safety = getPlayer(s.currentSafetyWinner);

        showOwnedEvent(
            "Nomination Ceremony",
            "NOMINATION CEREMONY",
            `<div class="ceremony-role-section"><h3>Head of Household</h3>${simulationPortrait(hoh, "large")}</div>${safety ? `<div class="ceremony-role-section"><h3>Safety</h3>${simulationPortrait(safety, "large")}<p><strong>${htmlEscape(nameOf(safety.id))}</strong> is safe and cannot be nominated.</p></div>` : ""}<p class="ceremony-statement"><strong>${htmlEscape(nameOf(hohId))}</strong> has nominated:</p><div class="ceremony-role-section"><h3>Nominees</h3>${simulationPortraits(s.currentNominees, "large")}</div>`
        );
    }

    function runEvictionVotingStable() {
        const s = getSim();
        if (!s) return;

        const activePlayers = active();
        const nominees = (s.currentNominees || []).map(getPlayer).filter(Boolean);

        if (nominees.length < 2) {
            s.pendingEvictionId = nominees[0]?.id || null;
            s.evictionVoteResult = { target: nominees[0]?.id || null, targetVotes: 0, votes: [] };
            s.currentEventIndex++;
            showOwnedEvent("Eviction Voting", "EVICTION VOTING", "<p>There are not enough nominees for a standard vote.</p>");
            return;
        }

        const voters = activePlayers.filter(p => p.id !== s.currentHOH && !nominees.some(n => n.id === p.id));
        const votes = [];

        voters.forEach(voter => {
            const ranked = nominees.map(target => {
                const bond = window.allianceBond ? Number(window.allianceBond(voter.id, target.id) || 0) : 0;
                const threat = (Number(target.ratings?.strategic || 0) + Number(target.ratings?.social || 0)) * 0.2;
                return { target, score: Math.max(0.1, 10 - bond + threat + Math.random() * 5) };
            }).sort((a, b) => b.score - a.score);
            if (ranked[0]) votes.push({ voter: voter.id, target: ranked[0].target.id });
        });

        const counts = {};
        nominees.forEach(n => counts[n.id] = 0);
        votes.forEach(v => counts[v.target] = Number(counts[v.target] || 0) + 1);

        const maxVotes = Math.max(...nominees.map(n => counts[n.id] || 0));
        const tied = nominees.filter(n => (counts[n.id] || 0) === maxVotes);
        let target = tied[0] || nominees[0];
        let tieBreak = null;

        /* HOH breaks a tie. */
        if (tied.length > 1) {
            const hoh = getPlayer(s.currentHOH);
            const choices = tied.filter(p => p.id !== hoh?.id);
            target = choices.length ? choices[Math.floor(Math.random() * choices.length)] : tied[0];
            tieBreak = { voter: s.currentHOH, target: target.id };
            votes.push(tieBreak);
        }

        s.pendingEvictionId = target.id;
        s.evictionVoteResult = {
            target: target.id,
            targetVotes: counts[target.id] || 0,
            counts,
            totalVotes: votes.length,
            votes,
            tieBreak
        };
        s.currentEventIndex++;

        const voteRows = votes.map(v => {
            const voter = getPlayer(v.voter);
            const votedFor = getPlayer(v.target);
            return `<div class="bb-vote-card"><div class="bb-vote-person">${simulationPortrait(voter, "medium")}<strong>${htmlEscape(nameOf(voter?.id))}</strong></div><div class="bb-vote-arrow"><span>${v === tieBreak ? "tie-break vote" : "votes to evict"}</span><strong>→</strong></div><div class="bb-vote-person">${simulationPortrait(votedFor, "medium")}<strong>${htmlEscape(nameOf(votedFor?.id))}</strong></div></div>`;
        }).join("");

        const tally = nominees.map(n => `<div><strong>${htmlEscape(nameOf(n.id))}</strong><span>${counts[n.id] || 0} vote${(counts[n.id] || 0) === 1 ? "" : "s"}</span></div>`).join("");

        showOwnedEvent(
            "Eviction Voting",
            "EVICTION VOTING",
            `<div class="bb-voting-header"><h3>The Houseguests Have Voted</h3><p>The votes have been recorded. The eviction will be revealed on the next event.</p></div><div class="bb-vote-list">${voteRows}</div><div class="bb-vote-counts">${tally}</div><p class="bb-voting-complete">Press <strong>Proceed</strong> to reveal the eviction.</p>`
        );
    }

    function runEvictionStable() {
        const season = getSeason();
        const s = getSim();
        if (!season || !s) return;

        const week = Number(s.currentWeek || 1);
        const nominees = (s.currentNominees || []).map(getPlayer).filter(Boolean);
        const target = getPlayer(s.pendingEvictionId) || nominees[0] || null;

        if (!target) {
            s.currentEventIndex = stableWeekEventChain(week).length;
            s.pendingWeekAdvance = true;
            s.pendingCycle = "nextWeek";
            showOwnedEvent("Eviction", "EVICTION", "<p>No eviction can occur because there are no current nominees.</p>");
            return;
        }

        const activeBefore = active();
        target.status = "evicted";
        target.placement = activeBefore.length;
        s.currentEviction = target.id;
        if (!Array.isArray(s.finalPlacements)) s.finalPlacements = [];
        s.finalPlacements.push({ id: target.id, name: target.name, placement: target.placement });
        s.evictionsThisWeek = Number(s.evictionsThisWeek || 0) + 1;

        const remaining = active();
        const finalists = Number(season.rules?.finalists || 2);
        const isDouble = season.rules?.doubleEvictionEnabled === true &&
            (season.rules?.doubleEvictionWeeks || []).map(Number).includes(week);

        s.pendingEvictionId = null;
        s.evictionVoteResult = null;
        s.currentEventIndex = stableWeekEventChain(week).length;

        const voteCount = Number(s.evictionVoteResult?.targetVotes || 0);

        if (remaining.length <= finalists) {
            s.pendingCycle = "finale";
            s.pendingWeekAdvance = false;
        } else if (isDouble && Number(s.evictionsThisWeek) < 2) {
            s.pendingCycle = "double";
            s.pendingWeekAdvance = false;
        } else {
            s.pendingCycle = "nextWeek";
            s.pendingWeekAdvance = true;
        }

        showOwnedEvent(
            "Eviction",
            "EVICTION",
            `${simulationPortrait(target, "large")}<p><strong>${htmlEscape(nameOf(target.id))}</strong> has been evicted from the Big Brother house.</p>${voteCount ? `<p>Final vote: <strong>${voteCount}</strong> vote${voteCount === 1 ? "" : "s"} to evict.</p>` : ""}${s.pendingCycle === "double" ? `<p><strong>Double Eviction:</strong> Press Proceed to begin the second HOH competition.</p>` : s.pendingCycle === "finale" ? `<p>The house has reached the finale.</p><p>Press <strong>Proceed</strong> to begin the finale.</p>` : `<p>Press <strong>Proceed</strong> to begin Week ${week + 1}.</p>`}`
        );

        /* Remove any stale safety winner before another cycle. */
        if (s.pendingCycle !== "double") {
            s.currentSafetyWinner = null;
            s.safetyWinner = null;
        }
    }

    function showOwnedEvent(title, type, content, options = {}) {
        const s = getSim();
        if (!s) return;
        s.viewingWeek = Number(s.currentWeek || 1);
        s.renderingEventKey = options.eventKey || s.renderingEventKey;
        s.renderingEventLabel = options.label || s.renderingEventLabel || title;
        if (window.showEvent) {
            window.showEvent(title, type, content, { week: s.currentWeek, ...options });
        }
        refresh();
        save();
    }

    function resetRuntimeFields(season) {
        if (!season) return;
        (season.houseguests || []).forEach(p => {
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

        season.simulation = window.createDefaultSimulation
            ? window.createDefaultSimulation()
            : {
                started: false,
                completed: false,
                currentWeek: 1,
                currentPhase: "setup",
                currentEventIndex: 0,
                history: []
            };

        const s = season.simulation;
        s.currentWeek = 1;
        s.viewingWeek = 1;
        s.currentPhase = "setup";
        s.started = false;
        s.completed = false;
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
    }

    function persistDirectly() {
        if (window.persistCurrentSeason) {
            window.persistCurrentSeason();
            return;
        }
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            const season = getSeason();
            const index = stored.findIndex(x => x.id === season?.id);
            if (index >= 0) {
                stored[index] = JSON.parse(JSON.stringify(season));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
            }
        } catch (e) {
            console.error("Unable to persist re-simulated season", e);
        }
    }

    function resimulateSeason() {
        const season = getSeason();
        if (!season) {
            alert("Please open a saved season first.");
            return;
        }

        const confirmed = confirm(
            `Re-simulate "${season.name || "this season"}" from the beginning?\n\nThis resets the simulation results but keeps your houseguests, pictures, ratings, relationships, alliances, competitions, twists, and rules.`
        );
        if (!confirmed) return;

        resetRuntimeFields(season);
        persistDirectly();

        if (window.showPage) window.showPage("simulator-page");
        if (window.initializeSimulator) window.initializeSimulator(season);
        setTimeout(() => {
            renderNavigation();
            refresh();
        }, 0);
    }

    function renderNavigation() {
        const container = document.getElementById("sim-week-navigation");
        const season = getSeason();
        const s = getSim();
        if (!container || !season || !s) return;

        const maxWeeks = seasonLength();
        const currentWeek = Number(s.currentWeek || 1);
        const viewingWeek = Number(s.viewingWeek || currentWeek);
        const history = Array.isArray(s.history) ? s.history : [];
        const html = [];

        for (let w = 1; w <= maxWeeks; w++) {
            const isCurrent = w === currentWeek;
            const isViewing = w === viewingWeek;
            const isPast = w < currentWeek;
            const items = history
                .filter(h => Number(h.week) === w)
                .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

            html.push(`<div class="sim-week-block ${isCurrent ? "current" : ""} ${isViewing ? "viewing" : ""} ${isPast ? "past" : ""}">`);
            html.push(`<button type="button" class="sim-week-label" data-sim-week="${w}">Week ${w}</button>`);

            if (isViewing) {
                html.push(`<div class="sim-event-list">`);
                items.forEach((item, i) => {
                    html.push(`<button type="button" class="sim-event-nav completed" data-history-week="${w}" data-history-index="${i}"><span>${htmlEscape(item.label || item.title || "Event")}</span></button>`);
                });

                if (isCurrent && !s.isViewingHistory && !s.pendingWeekAdvance && !s.pendingCycle && s.currentPhase !== "finale") {
                    const chain = stableWeekEventChain(currentWeek);
                    const index = Number(s.currentEventIndex || 0);
                    chain.slice(index).forEach((event, i) => {
                        html.push(`<div class="sim-event-nav ${i === 0 ? "active" : "pending"}"><span>${htmlEscape(event.label)}</span></div>`);
                    });
                }
                html.push(`</div>`);
            }
            html.push(`</div>`);
        }

        container.innerHTML = html.join("");
        container.querySelectorAll("[data-sim-week]").forEach(btn => {
            btn.addEventListener("click", () => {
                if (window.viewSimulationWeek) window.viewSimulationWeek(Number(btn.dataset.simWeek));
            });
        });
        container.querySelectorAll("[data-history-week]").forEach(btn => {
            btn.addEventListener("click", () => {
                const week = Number(btn.dataset.historyWeek);
                const index = Number(btn.dataset.historyIndex);
                const items = (s.history || []).filter(h => Number(h.week) === week)
                    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
                const item = items[index];
                if (item && window.showHistoricalSimulationEvent) window.showHistoricalSimulationEvent(item);
            });
        });
    }

    function resetCycleForNextWeek() {
        const s = getSim();
        if (!s) return false;
        const next = Number(s.currentWeek || 1) + 1;
        if (next > seasonLength()) {
            s.pendingWeekAdvance = false;
            s.pendingCycle = "finale";
            return false;
        }
        s.currentWeek = next;
        s.viewingWeek = next;
        s.evictionsThisWeek = 0;
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
        s.pendingWeekAdvance = false;
        s.pendingCycle = null;
        s.currentPhase = "week";
        s.started = true;
        showOwnedEvent(`Week ${next}`, "WEEK", `<p>Week ${next} is now beginning.</p>`, { skipHistory: true, eventKey: null });
        return true;
    }

    function resetDoubleEvictionCycle() {
        const s = getSim();
        if (!s) return;
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
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;
        s.started = true;
        refresh();
        save();
    }

    function startFinale() {
        const s = getSim();
        if (!s) return;
        s.pendingCycle = null;
        s.pendingWeekAdvance = false;
        s.currentPhase = "finale";
        s.finaleStarted = true;
        s.currentEventIndex = 0;
        s.viewingWeek = seasonLength();
        const finalists = active();
        s.finalists = finalists.map(p => p.id);
        s.jury = window.getJuryMembers ? window.getJuryMembers() : [];
        if (window.showEvent) {
            window.showEvent("Finale", "FINALE", `<p>The regular season is complete.</p>${simulationPortraits(finalists.map(p => p.id), "large")}<p><strong>${finalists.length} finalists remain.</strong> Press <strong>Proceed</strong> to continue to the finale.</p>`, { week: seasonLength() });
        }
        refresh();
        save();
    }

    function runNextEventStable() {
        const season = getSeason();
        const s = getSim();
        if (!season || !s) {
            alert("Please open a saved season first.");
            return;
        }

        if (s.isViewingHistory) {
            if (window.returnToCurrentSimulation) window.returnToCurrentSimulation();
            return;
        }

        if (s.pendingCycle === "finale") {
            startFinale();
            return;
        }

        if (s.pendingCycle === "nextWeek" || s.pendingWeekAdvance) {
            resetCycleForNextWeek();
            return;
        }

        if (s.pendingCycle === "double") {
            resetDoubleEvictionCycle();
        }

        if (s.currentPhase === "finale" || s.finaleStarted) {
            const chain = window.getFinaleChain ? window.getFinaleChain() : [];
            const index = Number(s.currentEventIndex || 0);
            const event = chain[index];
            if (!event) return;

            s.renderingEventKey = event.key;
            s.renderingEventLabel = event.label;

            if (event.key === "final-hoh" && window.runFinalHOHEvent) window.runFinalHOHEvent();
            else if (event.key === "jury-voting" && window.runJuryVotingEvent) window.runJuryVotingEvent();
            else if (event.key === "finale-results" && window.runFinaleResultsEvent) window.runFinaleResultsEvent();

            refresh();
            save();
            return;
        }

        const week = Number(s.currentWeek || 1);
        const chain = stableWeekEventChain(week);
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
                break;
            case "hoh":
                if (window.runHOHEvent) window.runHOHEvent();
                break;
            case "safety":
                runSafetyEvent(event.competitionId);
                break;
            case "nominations":
                runNominationEventStable();
                break;
            case "pov-players":
                if (window.runPOVPlayersEvent) window.runPOVPlayersEvent();
                break;
            case "pov":
                if (window.runPOVEvent) window.runPOVEvent();
                break;
            case "veto-ceremony":
                if (window.runVetoCeremonyEvent) window.runVetoCeremonyEvent();
                break;
            case "custom-competition":
                if (window.runCustomCompetitionEvent) window.runCustomCompetitionEvent(event.competitionId);
                break;
            case "eviction-voting":
                runEvictionVotingStable();
                break;
            case "eviction":
                runEvictionStable();
                break;
            default:
                s.currentEventIndex++;
                s.renderingEventKey = null;
                s.renderingEventLabel = null;
                break;
        }

        refresh();
        save();
    }

    /* Public API. */
    window.getWeekEventChain = stableWeekEventChain;
    window.runNextEvent = runNextEventStable;
    window.runEvictionVotingEvent = runEvictionVotingStable;
    window.renderSimulationWeekNavigation = renderNavigation;
    window.resimulateSeason = resimulateSeason;
    window.runStableSafetyEvent = runSafetyEvent;
    window.runStableNominationEvent = runNominationEventStable;
    window.runStableEvictionEvent = runEvictionStable;

    /* Keep navigation correct after app.js opens a season. */
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
        renderNavigation();
        refresh();
    }, 0));

    console.log("Stable Big Brother engine loaded.");
})();
