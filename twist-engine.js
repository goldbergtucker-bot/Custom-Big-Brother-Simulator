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

        const voteCount = Number(s.evictionVoteResult?.targetVotes || 0);
        s.pendingEvictionId = null;
        s.evictionVoteResult = null;
        s.currentEventIndex = stableWeekEventChain(week).length;

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

/* =========================================================
   FINAL STABILITY PATCH — EVENT NAVIGATION / FINALE / RESULTS
   =========================================================

   The simulator uses currentEventIndex as the NEXT event to run.  The old
   navigation treated that index as the event currently being displayed,
   which made the left rail jump ahead (for example, HOH content with
   Nominations highlighted).  The patch below makes the rail show the event
   that just happened as NOW and everything after it as pending.

   The finale is also an explicit five-event chain:
     Final HOH Part 1
     Final HOH Part 2
     Final HOH Part 3
     Jury Voting
     Final Results
*/
(function () {
    "use strict";

    const season = () => window.currentSeason || null;
    const sim = () => season()?.simulation || null;
    const esc = value => window.escapeHTML ? window.escapeHTML(String(value ?? "")) : String(value ?? "");
    const player = id => (season()?.houseguests || []).find(p => p.id === id) || null;
    const active = () => window.getActiveHouseguests ? window.getActiveHouseguests() : [];
    const name = id => window.getHouseguestDisplayName
        ? window.getHouseguestDisplayName(id, season()?.houseguests || [])
        : (player(id)?.name || "Unknown");
    const portraits = (ids, size) => window.simulationPortraits ? window.simulationPortraits(ids, size) : "";
    const portrait = (p, size) => window.simulationPortrait ? window.simulationPortrait(p, size) : "";

    function finalCompetitions() {
        const list = season()?.competitions?.finalHoh;
        return Array.isArray(list) ? list : [];
    }

    function finalCompetition(part) {
        return finalCompetitions()[part - 1] || null;
    }

    function finaleChain() {
        const s = sim();
        const finalists = (s?.finalists || []).map(player).filter(Boolean);
        if (finalists.length >= 3) {
            return [
                { key: "final-hoh-1", label: finalCompetition(1)?.name || "Final HOH Part 1" },
                { key: "final-hoh-2", label: finalCompetition(2)?.name || "Final HOH Part 2" },
                { key: "final-hoh-3", label: finalCompetition(3)?.name || "Final HOH Part 3" },
                { key: "jury-voting", label: "Jury Voting" },
                { key: "finale-results", label: "Final Results" }
            ];
        }
        return [
            { key: "jury-voting", label: "Jury Voting" },
            { key: "finale-results", label: "Final Results" }
        ];
    }

    function show(title, type, content, options = {}) {
        if (window.showEvent) window.showEvent(title, type, content, options);
    }

    /* Correct left-side navigation. currentEventIndex is the NEXT event. */
    function renderNavigation() {
        const container = document.getElementById("sim-week-navigation");
        const s = sim();
        const ss = season();
        if (!container || !s || !ss) return;

        const maxWeeks = Number(window.getSeasonLength ? window.getSeasonLength(ss) : 1) || 1;
        const currentWeek = Number(s.currentWeek || 1);
        const viewingWeek = Number(s.viewingWeek || currentWeek);
        const history = Array.isArray(s.history) ? s.history.slice().sort((a,b) => Number(a.sequence||0)-Number(b.sequence||0)) : [];
        const html = [];

        for (let w = 1; w <= maxWeeks; w++) {
            const isCurrent = w === currentWeek;
            const isViewing = w === viewingWeek;
            const items = history.filter(h => Number(h.week) === w);
            const isFinaleWeek = isCurrent && (s.currentPhase === "finale" || s.finaleStarted);

            html.push(`<div class="sim-week-block ${isCurrent ? "current" : ""} ${isViewing ? "viewing" : ""} ${w < currentWeek ? "past" : ""}>`);
            html.push(`<button type="button" class="sim-week-label" data-sim-week="${w}">Week ${w}</button>`);

            if (isViewing) {
                html.push(`<div class="sim-event-list">`);

                items.forEach((item, i) => {
                    /* The most recently displayed live event is NOW. */
                    const isNow = !s.isViewingHistory && i === items.length - 1 && w === currentWeek;
                    html.push(
                        `<button type="button" class="sim-event-nav completed ${isNow ? "now" : ""}" data-history-week="${w}" data-history-index="${i}">` +
                        `<span>${esc(item.label || item.title || "Event")}</span>${isNow ? `<small>NOW</small>` : ""}</button>`
                    );
                });

                if (isCurrent && !s.isViewingHistory && !s.pendingWeekAdvance && !s.pendingCycle) {
                    const chain = (s.currentPhase === "finale" || s.finaleStarted)
                        ? finaleChain()
                        : stableWeekChain(w);
                    const nextIndex = Number(s.currentEventIndex || 0);
                    chain.slice(nextIndex).forEach(item => {
                        html.push(`<div class="sim-event-nav pending"><span>${esc(item.label)}</span></div>`);
                    });
                }

                html.push(`</div>`);
            }
            html.push(`</div>`);
        }

        container.innerHTML = html.join("");
        container.querySelectorAll("[data-sim-week]").forEach(btn => {
            btn.addEventListener("click", () => window.viewSimulationWeek?.(Number(btn.dataset.simWeek)));
        });
        container.querySelectorAll("[data-history-week]").forEach(btn => {
            btn.addEventListener("click", () => {
                const w = Number(btn.dataset.historyWeek);
                const i = Number(btn.dataset.historyIndex);
                const items = history.filter(h => Number(h.week) === w);
                const item = items[i];
                if (item) window.showHistoricalSimulationEvent?.(item);
            });
        });
    }

    function stableWeekChain(week) {
        const s = season();
        const chain = [];
        if (!s) return chain;
        (window.getScheduledTwistsForWeek?.(Number(week)) || []).forEach(t => chain.push({key:"twist", label:t.name || "Twist", twistId:t.id}));
        const hoh = window.getCompetitionForWeekType?.(Number(week), "hoh");
        const pov = window.getCompetitionForWeekType?.(Number(week), "pov");
        chain.push({key:"hoh", label:hoh?.name || "HOH Competition"});
        (window.getWeekCompetitions?.(Number(week)) || []).filter(c => String(c.type||"").toLowerCase()==="safety").forEach(c => chain.push({key:"safety", label:c.name || "Safety Competition", competitionId:c.id}));
        chain.push({key:"nominations", label:"Nomination Ceremony"});
        if (s.rules?.vetoEnabled !== false) {
            chain.push({key:"pov-players", label:"Veto Selections"});
            chain.push({key:"pov", label:pov?.name || "POV Competition"});
            chain.push({key:"veto-ceremony", label:"Veto Ceremony"});
        }
        (window.getWeekCompetitions?.(Number(week)) || []).filter(c => ["special","luxury"].includes(String(c.type||"").toLowerCase())).forEach(c => chain.push({key:"custom-competition", label:c.name || "Special Competition", competitionId:c.id}));
        chain.push({key:"eviction-voting", label:"Eviction Voting"}, {key:"eviction", label:"Eviction"});
        return chain;
    }

    /* ---------------------------------------------------------
       Final HOH — three genuinely separate events.
       --------------------------------------------------------- */
    function runFinalHOHPart(part) {
        const ss = season();
        const s = sim();
        if (!ss || !s) return;

        const finalists = (s.finalists || []).map(player).filter(Boolean);
        if (finalists.length < 3) {
            s.currentEventIndex++;
            show("Final HOH", "FINAL HOH", "<p>There are fewer than three finalists, so the three-part Final HOH is skipped.</p>");
            return;
        }

        let contestants;
        if (part === 1) {
            contestants = finalists.slice(0, 3);
        } else if (part === 2) {
            const p1 = player(s.finalHOHPart1);
            contestants = finalists.filter(p => p.id !== p1?.id);
        } else {
            const p1 = player(s.finalHOHPart1);
            const p2 = player(s.finalHOHPart2);
            contestants = [p1, p2].filter(Boolean);
        }

        if (contestants.length < 2) {
            s.currentEventIndex++;
            return;
        }

        const comp = finalCompetition(part);
        let winner = null;
        if (comp && window.chooseCompetitionWinnerByCustom) winner = window.chooseCompetitionWinnerByCustom(contestants, comp);
        if (!winner && window.chooseCompetitionWinner) winner = window.chooseCompetitionWinner(contestants, "mental", "social", "general");
        if (!winner) winner = contestants[Math.floor(Math.random() * contestants.length)];

        s[`finalHOHPart${part}`] = winner.id;
        s.finalHOH = winner.id;
        s.currentEventIndex++;

        const title = comp?.name || `Final HOH Part ${part}`;
        show(
            title,
            "FINAL HOH COMPETITION",
            `${portrait(winner, "large")}<p><strong>${esc(name(winner.id))}</strong> has won <strong>${esc(title)}</strong>.</p>` +
            `<p>Final HOH Part ${part} is complete.</p>` +
            (comp?.description ? `<p class="event-description">${esc(comp.description)}</p>` : "")
        );
    }

    function runFinalHOH1() { runFinalHOHPart(1); }
    function runFinalHOH2() { runFinalHOHPart(2); }
    function runFinalHOH3() { runFinalHOHPart(3); }

    /* The final HOH winner chooses which of the other two goes to jury. */
    function runFinalJuryVoting() {
        const ss = season();
        const s = sim();
        if (!ss || !s) return;
        let finalists = (s.finalists || []).map(player).filter(Boolean);

        if (finalists.length > 2) {
            const finalHOH = player(s.finalHOHPart3 || s.finalHOH) || finalists[0];
            const eligible = finalists.filter(p => p.id !== finalHOH.id);
            let chosen = eligible[0];
            if (eligible.length > 1) {
                chosen = eligible.slice().sort((a,b) => {
                    const ba = window.allianceBond ? Number(window.allianceBond(finalHOH.id, a.id) || 0) : 0;
                    const bb = window.allianceBond ? Number(window.allianceBond(finalHOH.id, b.id) || 0) : 0;
                    return bb - ba;
                })[0];
            }
            const evicted = eligible.find(p => p.id !== chosen.id);
            if (evicted) {
                evicted.status = "evicted";
                evicted.placement = 3;
                if (!Array.isArray(s.finalPlacements)) s.finalPlacements = [];
                if (!s.finalPlacements.some(x => x.id === evicted.id)) {
                    s.finalPlacements.push({id:evicted.id, name:name(evicted.id), placement:3});
                }
            }
            finalists = [finalHOH, chosen].filter(Boolean);
            s.finalists = finalists.map(p => p.id);
        }

        if (!Array.isArray(s.jury) || !s.jury.length) {
            s.jury = window.getJuryMembers ? window.getJuryMembers() : [];
        }

        const votes = [];
        s.jury.forEach(jid => {
            const juror = player(jid);
            if (!juror || finalists.length === 0) return;
            const scored = finalists.map(f => ({
                id:f.id,
                score:
                    Number(f.ratings?.social || 0) * .40 +
                    Number(f.ratings?.strategic || 0) * .35 +
                    Number(f.ratings?.general || 0) * .15 +
                    Number(f.ratings?.mental || 0) * .10 +
                    (window.allianceBond ? Number(window.allianceBond(jid, f.id) || 0) * .15 : 0) +
                    Math.random() * 3
            })).sort((a,b) => b.score - a.score);
            votes.push({juror:jid, vote:scored[0]?.id || finalists[0].id});
        });

        const counts = {};
        finalists.forEach(f => counts[f.id] = 0);
        votes.forEach(v => counts[v.vote] = Number(counts[v.vote] || 0) + 1);
        s.juryVotes = votes;
        s.finaleVoteResults = {votes, counts};
        s.currentEventIndex++;

        const rows = votes.map(v => `<div class="jury-vote-row"><div class="jury-vote-person">${portrait(player(v.juror),"small")}</div><strong>${esc(name(v.juror))}</strong><span>votes for</span><strong>${esc(name(v.vote))}</strong></div>`).join("");
        show("Jury Voting", "JURY VOTING", `<div class="jury-finalists">${portraits(finalists.map(p=>p.id),"large")}</div><h3>The Jury Votes</h3><div class="jury-vote-list">${rows || "<p>No jury members were eligible to vote.</p>"}</div><p>Press <strong>Proceed</strong> to reveal the Final Results.</p>`);
    }

    function buildAllPlacements() {
        const ss = season();
        const s = sim();
        if (!ss || !s) return [];
        const map = new Map();
        (s.finalPlacements || []).forEach(x => {
            if (x?.id) map.set(x.id, {id:x.id, name:name(x.id), placement:Number(x.placement || 0)});
        });
        (ss.houseguests || []).forEach(p => {
            if (p.placement != null && Number(p.placement) > 0) {
                map.set(p.id, {id:p.id, name:name(p.id), placement:Number(p.placement)});
            }
        });
        const finalists = (s.finalists || []).map(player).filter(Boolean);
        const counts = s.finaleVoteResults?.counts || {};
        const ranked = finalists.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
        if (ranked[0]) map.set(ranked[0].id,{id:ranked[0].id,name:name(ranked[0].id),placement:1});
        if (ranked[1]) map.set(ranked[1].id,{id:ranked[1].id,name:name(ranked[1].id),placement:2});
        const all = (ss.houseguests || []).slice().sort((a,b)=>Number(a.placement||99)-Number(b.placement||99));
        all.forEach(p => {
            if (!map.has(p.id) && p.status !== "active") {
                /* Fallback only for legacy seasons that never stored placement. */
                const existing = [...map.values()].filter(x=>x.placement>0).length;
                map.set(p.id,{id:p.id,name:name(p.id),placement:existing ? Math.min(16, 16-existing) : 0});
            }
        });
        return [...map.values()].filter(x=>x.placement>0).sort((a,b)=>a.placement-b.placement);
    }

    function renderFinalPlacementsMemoryWall() {
        const container = document.getElementById("final-placements");
        if (!container) return;
        const placements = buildAllPlacements();
        if (!placements.length) {
            container.innerHTML = `<div class="empty-state"><h3>No Placements Yet</h3><p>Finish the simulation to see final placements.</p></div>`;
            return;
        }
        container.innerHTML = `<div class="final-memory-wall">${placements.map(p => {
            const hg = player(p.id);
            const placeLabel = p.placement === 1 ? "1ST PLACE" : p.placement === 2 ? "2ND PLACE" : p.placement === 3 ? "3RD PLACE" : `${p.placement}TH PLACE`;
            return `<article class="final-memory-card place-${p.placement}"><div class="final-memory-rank">${esc(placeLabel)}</div>${portrait(hg,"medium")}<div class="final-memory-name">${esc(p.name)}</div></article>`;
        }).join("")}</div>`;
    }

    function runFinalResults() {
        const ss = season();
        const s = sim();
        if (!ss || !s) return;
        const finalists = (s.finalists || []).map(player).filter(Boolean);
        const counts = s.finaleVoteResults?.counts || {};
        const ranked = finalists.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0));
        const winner = ranked[0] || null;
        const runner = ranked[1] || null;
        if (winner) { winner.status="winner"; winner.placement=1; s.winner=winner.id; }
        if (runner) { runner.status="runner-up"; runner.placement=2; s.runnerUp=runner.id; }
        if (winner && !Array.isArray(s.finalPlacements)) s.finalPlacements=[];
        if (winner && !s.finalPlacements.some(x=>x.id===winner.id)) s.finalPlacements.push({id:winner.id,name:name(winner.id),placement:1});
        if (runner && !s.finalPlacements.some(x=>x.id===runner.id)) s.finalPlacements.push({id:runner.id,name:name(runner.id),placement:2});

        /* Guarantee the full 1–16 placement record from player placement fields. */
        s.finalPlacements = buildAllPlacements();
        s.completed = true;
        s.currentPhase = "complete";
        s.currentEventIndex = 0;
        renderFinalPlacementsMemoryWall();

        show("Final Results", "FINAL RESULTS", `<div class="final-results-cards">${winner ? `${portrait(winner,"large")}<h2>${esc(name(winner.id))}</h2><p class="final-winner-label">WINNER — ${counts[winner.id] || 0} JURY VOTES</p>` : ""}${runner ? `${portrait(runner,"large")}<p class="final-runner-label">RUNNER-UP — ${counts[runner.id] || 0} JURY VOTES</p>` : ""}</div><div class="final-jury-tally">${ranked.map(f=>`<div><strong>${esc(name(f.id))}</strong><span>${counts[f.id]||0} vote${(counts[f.id]||0)===1?"":"s"}</span></div>`).join("")}</div><button type="button" class="primary-button" onclick="showResults()">VIEW FULL RESULTS</button>`);
        window.persistCurrentSeason?.();
    }

    /* Override the finale functions and chain used by the stable engine. */
    /* app.js's showEvent has a lexical reference to its own navigation function.
       Wrap it so the corrected navigation is always rendered after every event. */
    const originalShowEvent = window.showEvent;
    window.showEvent = function () {
        const result = originalShowEvent ? originalShowEvent.apply(this, arguments) : undefined;
        renderNavigation();
        return result;
    };

    const originalShowResults = window.showResults;
    window.showResults = function () {
        const result = originalShowResults ? originalShowResults.apply(this, arguments) : undefined;
        renderFinalPlacementsMemoryWall();
        return result;
    };

    window.getFinaleChain = finaleChain;
    window.runFinalHOHEvent = runFinalHOH1;
    window.runFinalHOH1 = runFinalHOH1;
    window.runFinalHOH2 = runFinalHOH2;
    window.runFinalHOH3 = runFinalHOH3;
    window.runJuryVotingEvent = runFinalJuryVoting;
    window.runFinaleResultsEvent = runFinalResults;
    window.renderFinalPlacements = renderFinalPlacementsMemoryWall;
    window.renderSimulationWeekNavigation = renderNavigation;

    /* The stable engine's runNextEvent needs to dispatch the three final HOHs. */
    const stableProceed = window.runNextEvent;
    window.runNextEvent = function () {
        const s = sim();
        if (s && (s.currentPhase === "finale" || s.finaleStarted)) {
            if (s.isViewingHistory) {
                window.returnToCurrentSimulation?.();
                return;
            }
            const chain = finaleChain();
            const event = chain[Number(s.currentEventIndex || 0)];
            if (!event) return;
            s.renderingEventKey = event.key;
            s.renderingEventLabel = event.label;
            if (event.key === "final-hoh-1") runFinalHOH1();
            else if (event.key === "final-hoh-2") runFinalHOH2();
            else if (event.key === "final-hoh-3") runFinalHOH3();
            else if (event.key === "jury-voting") runFinalJuryVoting();
            else if (event.key === "finale-results") runFinalResults();
            renderNavigation();
            window.persistCurrentSeason?.();
            return;
        }
        return stableProceed?.apply(this, arguments);
    };

    /* Replace the old white voting cards with dark simulator styling. */
    const style = document.createElement("style");
    style.textContent = `
        .sim-event-nav { position:relative; }
        .sim-event-nav.now { color:#fff !important; font-weight:900; background:#3a3a3a; border-left:3px solid #00d7e8; padding-left:6px; }
        .sim-event-nav.now::before { content:"" !important; }
        .sim-event-nav.now small { display:block; color:#00d7e8; font-size:8px; letter-spacing:1px; margin-top:2px; }
        .sim-event-nav.pending { color:#777; }
        .bb-vote-card { border:1px solid #555 !important; border-radius:6px !important; background:#292929 !important; color:#eee !important; box-shadow:none !important; }
        .bb-vote-card .bb-vote-person strong { color:#eee !important; }
        .bb-vote-arrow span { color:#aaa !important; }
        .bb-vote-arrow strong { color:#ddd !important; }
        .bb-vote-counts > div { border:1px solid #555 !important; border-radius:6px !important; background:#292929 !important; color:#eee !important; }
        .bb-vote-list { gap:10px !important; }
        .final-memory-wall { display:grid; grid-template-columns:repeat(4,minmax(130px,1fr)); gap:14px; width:min(1100px,100%); margin:0 auto; }
        .final-memory-card { position:relative; min-width:0; padding:12px 10px 14px; background:#20242c; border:1px solid #343a46; border-radius:8px; text-align:center; overflow:hidden; }
        .final-memory-card .sim-portrait { width:100% !important; }
        .final-memory-card .sim-portrait img, .final-memory-card .sim-portrait-placeholder { width:min(150px,100%) !important; height:155px !important; margin:0 auto 8px !important; }
        .final-memory-rank { font-size:11px; font-weight:900; letter-spacing:.8px; color:#8f98a8; margin-bottom:8px; }
        .final-memory-name { font-size:14px; font-weight:900; color:#fff; line-height:1.2; }
        .place-1 { border-color:#b89b45; }
        .place-1 .final-memory-rank { color:#f0cf68; }
        .place-2 .final-memory-rank { color:#c9c9c9; }
        .place-3 .final-memory-rank { color:#c78f61; }
        @media(max-width:850px){ .final-memory-wall{grid-template-columns:repeat(3,minmax(110px,1fr));} }
        @media(max-width:600px){ .final-memory-wall{grid-template-columns:repeat(2,minmax(110px,1fr));} }
    `;
    document.head.appendChild(style);

    document.addEventListener("DOMContentLoaded", () => setTimeout(renderNavigation, 0));
})();
