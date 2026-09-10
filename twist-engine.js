/*
 * =========================================================
 * BIG BROTHER SIMULATOR
 * STABLE SIMULATION ENGINE
 * =========================================================
 *
 * This file loads AFTER app.js.
 *
 * Responsibilities:
 *
 * - Stable week/event progression
 * - Safety/Tropical Immunity before nominations
 * - BrantSteele-style event chain
 * - Portrait-based eviction voting
 * - Voting does NOT reveal eviction result
 * - Separate eviction event
 * - Double eviction support
 * - Week-to-week progression
 * - Finale progression
 * - History navigation
 * - Re-simulation compatibility
 *
 * =========================================================
 */

(function () {

    "use strict";

    console.log("Stable Big Brother simulation engine loaded.");

    /*
     * =========================================================
     * HELPERS
     * =========================================================
     */

    function sim() {
        if (!window.currentSeason) {
            return null;
        }

        if (!window.currentSeason.simulation) {
            window.currentSeason.simulation =
                window.createDefaultSimulation();
        }

        return window.currentSeason.simulation;
    }

    function activePlayers() {
        return window.getActiveHouseguests
            ? window.getActiveHouseguests()
            : [];
    }

    function seasonLength() {
        return Number(
            window.getSeasonLength(window.currentSeason) || 1
        );
    }

    function player(id) {
        if (!id) return null;

        return (
            window.currentSeason?.houseguests || []
        ).find(h => h.id === id) || null;
    }

    function playerName(id) {
        if (!id) return "Unknown";

        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(
                id,
                window.currentSeason?.houseguests || []
            )
            : (player(id)?.name || "Unknown");
    }

    function escape(value) {
        return window.escapeHTML
            ? window.escapeHTML(String(value ?? ""))
            : String(value ?? "");
    }

    function save() {
        if (window.persistCurrentSeason) {
            window.persistCurrentSeason();
        }
    }

    function refreshUI() {

        const s = sim();

        if (!s) return;

        if (window.setText) {
            window.setText(
                "current-week",
                s.currentWeek || 1
            );
        }

        if (window.updateSimulatorStatus) {
            window.updateSimulatorStatus(s);
        }

        if (window.renderSimulationWeekNavigation) {
            window.renderSimulationWeekNavigation();
        }

        if (window.renderDynamicGameChain) {
            window.renderDynamicGameChain();
        }
    }


    /*
     * =========================================================
     * SAFETY / IMMUNITY DETECTION
     * =========================================================
     */

    function getSafetyCompetitions(week) {

        if (!window.getWeekCompetitions) {
            return [];
        }

        return window.getWeekCompetitions(week)
            .filter(c =>
                c &&
                String(c.type || "").toLowerCase() === "safety"
            );
    }


    function hasSafetyCompetition(week) {

        return getSafetyCompetitions(week).length > 0;
    }


    /*
     * =========================================================
     * STABLE EVENT CHAIN
     *
     * IMPORTANT:
     *
     * Safety happens BEFORE nominations.
     * =========================================================
     */

    function stableWeekEventChain(week) {

        const s = sim();

        if (!s) return [];

        /*
         * Finale
         */

        if (
            s.currentPhase === "finale" ||
            s.finaleStarted
        ) {

            return window.getFinaleChain
                ? window.getFinaleChain()
                : [];

        }


        const chain = [];


        /*
         * Scheduled twists
         */

        if (window.getScheduledTwistsForWeek) {

            const twists =
                window.getScheduledTwistsForWeek(week) || [];

            twists.forEach(twist => {

                chain.push({
                    key: "twist",
                    label: twist.name || "Twist",
                    twistId: twist.id
                });

            });

        }


        /*
         * HOH
         */

        const hohCompetition =
            window.getCompetitionForWeekType
                ? window.getCompetitionForWeekType(
                    week,
                    "hoh"
                )
                : null;

        chain.push({
            key: "hoh",
            label:
                hohCompetition?.name ||
                "Head of Household"
        });


        /*
         * SAFETY / TROPICAL IMMUNITY
         *
         * THIS IS INTENTIONALLY BEFORE NOMINATIONS.
         */

        const safetyCompetitions =
            getSafetyCompetitions(week);

        safetyCompetitions.forEach(comp => {

            chain.push({
                key: "safety",
                label:
                    comp.name ||
                    "Safety Competition",
                competitionId: comp.id
            });

        });


        /*
         * NOMINATIONS
         */

        chain.push({
            key: "nominations",
            label: "Nomination Ceremony"
        });


        /*
         * POV
         */

        const vetoEnabled =
            window.currentSeason?.rules?.vetoEnabled !== false;

        const povCompetition =
            window.getCompetitionForWeekType
                ? window.getCompetitionForWeekType(
                    week,
                    "pov"
                )
                : null;

        if (vetoEnabled) {

            chain.push({
                key: "pov-players",
                label: "Veto Selections"
            });

            chain.push({
                key: "pov",
                label:
                    povCompetition?.name ||
                    "Power of Veto"
            });

            chain.push({
                key: "veto-ceremony",
                label: "Veto Ceremony"
            });

        }


        /*
         * SPECIAL / LUXURY COMPETITIONS
         *
         * Safety competitions are excluded because
         * they were already placed before nominations.
         */

        if (window.getWeekCompetitions) {

            window.getWeekCompetitions(week)
                .filter(c =>
                    c &&
                    (
                        c.type === "special" ||
                        c.type === "luxury"
                    )
                )
                .forEach(comp => {

                    chain.push({
                        key: "custom-competition",
                        label:
                            comp.name ||
                            "Special Competition",
                        competitionId: comp.id
                    });

                });

        }


        /*
         * EVICTION VOTING
         */

        chain.push({
            key: "eviction-voting",
            label: "Eviction Voting"
        });


        /*
         * EVICTION
         */

        chain.push({
            key: "eviction",
            label: "Eviction"
        });


        return chain;
    }


    /*
     * =========================================================
     * PORTRAIT-BASED VOTING
     * =========================================================
     *
     * The voting event ONLY shows votes.
     *
     * It does NOT say:
     *
     * "X will be evicted."
     *
     * The next event handles that.
     * =========================================================
     */

    function runStableEvictionVotingEvent() {

        const s = sim();

        if (!s) return;


        const active =
            activePlayers();


        const nominees =
            (s.currentNominees || [])
                .map(id => player(id))
                .filter(Boolean);


        /*
         * Not enough nominees.
         */

        if (nominees.length < 2) {

            s.pendingEvictionId = null;

            s.evictionVoteResult = null;

            s.currentEventIndex++;

            window.showEvent(
                "Eviction Voting",
                "EVICTION VOTING",
                `
                    <p>
                        There are not enough nominees
                        for a standard eviction vote.
                    </p>
                `
            );

            refreshUI();
            save();

            return;
        }


        /*
         * Eligible voters:
         *
         * HOH does not vote.
         * Nominees do not vote.
         */

        const voters =
            active.filter(h =>
                h.id !== s.currentHOH &&
                !nominees.some(n => n.id === h.id)
            );


        const votes = [];


        voters.forEach(voter => {

            const scored =
                nominees.map(target => {

                    const bond =
                        window.allianceBond
                            ? window.allianceBond(
                                voter.id,
                                target.id
                            )
                            : 0;

                    return {
                        target,
                        score:
                            Math.max(
                                0.1,
                                10 - bond +
                                Math.random() * 5
                            )
                    };

                })
                .sort(
                    (a, b) =>
                        b.score - a.score
                );


            const target =
                scored[0]?.target;


            if (target) {

                votes.push({
                    voter: voter.id,
                    target: target.id
                });

            }

        });


        /*
         * Count votes.
         */

        const counts = {};

        nominees.forEach(n => {
            counts[n.id] = 0;
        });


        votes.forEach(vote => {

            counts[vote.target] =
                (counts[vote.target] || 0) + 1;

        });


        /*
         * Determine target privately.
         *
         * We store it now.
         *
         * We DO NOT display it as the eviction result.
         */

        const sorted =
            nominees
                .slice()
                .sort(
                    (a, b) =>
                        (counts[b.id] || 0) -
                        (counts[a.id] || 0)
                );


        const target =
            sorted[0] || null;

        const other =
            sorted[1] || null;


        s.pendingEvictionId =
            target?.id || null;


        s.evictionVoteResult = {

            target:
                target?.id || null,

            targetVotes:
                target
                    ? counts[target.id] || 0
                    : 0,

            other:
                other?.id || null,

            otherVotes:
                other
                    ? counts[other.id] || 0
                    : 0,

            totalVotes:
                votes.length,

            votes:
                votes

        };


        /*
         * Advance to the separate Eviction event.
         */

        s.currentEventIndex++;


        /*
         * Build portrait voting rows.
         */

        const voteRows =
            votes.map(vote => {

                const voter =
                    player(vote.voter);

                const votedFor =
                    player(vote.target);


                const voterPortrait =
                    window.simulationPortrait
                        ? window.simulationPortrait(
                            voter,
                            "medium"
                        )
                        : "";


                const targetPortrait =
                    window.simulationPortrait
                        ? window.simulationPortrait(
                            votedFor,
                            "medium"
                        )
                        : "";


                return `
                    <div class="bb-vote-card">

                        <div class="bb-vote-person">

                            ${voterPortrait}

                            <strong>
                                ${escape(
                                    playerName(voter?.id)
                                )}
                            </strong>

                        </div>


                        <div class="bb-vote-arrow">

                            <span>
                                votes to evict
                            </span>

                            <strong>→</strong>

                        </div>


                        <div class="bb-vote-person">

                            ${targetPortrait}

                            <strong>
                                ${escape(
                                    playerName(votedFor?.id)
                                )}
                            </strong>

                        </div>

                    </div>
                `;

            }).join("");


        /*
         * IMPORTANT:
         *
         * No "will be evicted" text.
         *
         * No final vote-result announcement.
         */

        window.showEvent(
            "Eviction Voting",
            "EVICTION VOTING",
            `
                <div class="bb-voting-header">

                    <h3>
                        The Houseguests Have Voted
                    </h3>

                    <p>
                        Each eligible Houseguest has
                        cast their vote to evict.
                    </p>

                </div>

                <div class="bb-vote-list">

                    ${voteRows ||
                        "<p>No eligible voters.</p>"
                    }

                </div>

                <div class="bb-vote-counts">

                    <div>
                        <strong>
                            ${escape(
                                playerName(target?.id)
                            )}
                        </strong>

                        <span>
                            ${target
                                ? counts[target.id] || 0
                                : 0
                            } vote(s)
                        </span>

                    </div>


                    <div>
                        <strong>
                            ${escape(
                                playerName(other?.id)
                            )}
                        </strong>

                        <span>
                            ${other
                                ? counts[other.id] || 0
                                : 0
                            } vote(s)
                        </span>

                    </div>

                </div>

                <p class="bb-voting-complete">
                    The vote has been recorded.
                    Press <strong>Proceed</strong>
                    to reveal the eviction.
                </p>
            `
        );


        refreshUI();
        save();

    }


    /*
     * =========================================================
     * SAFETY COMPETITION
     * =========================================================
     */

    function runStableSafetyEvent(competitionId) {

        const s = sim();

        if (!s) return;


        const active =
            activePlayers();


        const comp =
            window.getWeekCompetitions
                ? window.getWeekCompetitions(
                    s.currentWeek
                ).find(
                    c => c.id === competitionId
                )
                : null;


        if (!comp || !active.length) {

            s.currentEventIndex++;

            window.showEvent(
                "Safety Competition",
                "SAFETY COMPETITION",
                "<p>No safety competition was available.</p>"
            );

            refreshUI();
            save();

            return;
        }


        /*
         * Pick winner using the same custom
         * competition system already used by
         * the simulator.
         */

        let winner = null;


        if (
            window.chooseCompetitionWinnerByCustom
        ) {

            winner =
                window.chooseCompetitionWinnerByCustom(
                    active,
                    comp
                );

        }


        if (!winner) {

            winner =
                window.chooseCompetitionWinner
                    ? window.chooseCompetitionWinner(
                        active,
                        "physical",
                        "mental",
                        "general"
                    )
                    : active[
                        Math.floor(
                            Math.random() *
                            active.length
                        )
                    ];

        }


        /*
         * Store the safety winner.
         */

        s.currentSafetyWinner =
            winner?.id || null;


        s.safetyWinner =
            winner?.id || null;


        if (winner) {

            winner.safetyWins =
                Number(
                    winner.safetyWins || 0
                ) + 1;

        }


        s.currentEventIndex++;


        window.showEvent(
            comp.name ||
                "Safety Competition",
            "SAFETY COMPETITION",
            `
                ${
                    window.simulationPortrait
                        ? window.simulationPortrait(
                            winner,
                            "large"
                        )
                        : ""
                }

                <p>

                    <strong>
                        ${escape(
                            playerName(
                                winner?.id
                            )
                        )}
                    </strong>

                    has won

                    <strong>
                        ${escape(
                            comp.name ||
                            "Safety"
                        )}
                    </strong>.

                </p>

                <p>
                    This Houseguest is safe
                    from nomination this week.
                </p>

                ${
                    comp.description
                        ? `<p class="event-description">
                            ${escape(
                                comp.description
                            )}
                           </p>`
                        : ""
                }
            `
        );


        refreshUI();
        save();

    }


    /*
     * =========================================================
     * NOMINATION OVERRIDE
     *
     * Makes the Safety winner ineligible.
     * =========================================================
     */

    function runStableNominationEvent() {

        const s = sim();

        if (!s) return;


        const active =
            activePlayers();


        const hohId =
            s.currentHOH;


        const safetyWinner =
            s.currentSafetyWinner ||
            s.safetyWinner ||
            null;


        /*
         * Safety winner cannot be nominated.
         */

        const eligible =
            active.filter(
                houseguest =>
                    houseguest.id !== hohId &&
                    houseguest.id !== safetyWinner
            );


        const nomineeCount =
            Math.min(
                Number(
                    window.currentSeason
                        ?.rules
                        ?.nomineesPerWeek || 2
                ),
                eligible.length
            );


        let nominees =
            window.chooseRandomPlayers
                ? window.chooseRandomPlayers(
                    eligible,
                    nomineeCount
                )
                : eligible.slice(
                    0,
                    nomineeCount
                );


        /*
         * Store nominees.
         */

        s.currentNominees =
            nominees.map(
                h => h.id
            );


        nominees.forEach(nominee => {

            nominee.nominationCount =
                Number(
                    nominee.nominationCount || 0
                ) + 1;

        });


        s.currentEventIndex++;


        refreshUI();


        const hohPlayer =
            player(hohId);


        window.showEvent(
            "Nomination Ceremony",
            "NOMINATION CEREMONY",
            `
                <div class="ceremony-role-section">

                    <h3>
                        Head of Household
                    </h3>

                    ${
                        window.simulationPortrait
                            ? window.simulationPortrait(
                                hohPlayer,
                                "large"
                            )
                            : ""
                    }

                </div>


                ${
                    safetyWinner
                        ? `
                            <div class="ceremony-role-section">

                                <h3>
                                    Safety
                                </h3>

                                ${
                                    window.simulationPortrait
                                        ? window.simulationPortrait(
                                            player(
                                                safetyWinner
                                            ),
                                            "large"
                                        )
                                        : ""
                                }

                                <p>
                                    <strong>
                                        ${escape(
                                            playerName(
                                                safetyWinner
                                            )
                                        )}
                                    </strong>
                                    is safe and
                                    cannot be nominated.
                                </p>

                            </div>
                        `
                        : ""
                }


                <p class="ceremony-statement">

                    <strong>
                        ${escape(
                            playerName(
                                hohId
                            )
                        )}
                    </strong>

                    has nominated:

                </p>


                <div class="ceremony-role-section">

                    <h3>
                        Nominees
                    </h3>

                    ${
                        window.simulationPortraits
                            ? window.simulationPortraits(
                                s.currentNominees,
                                "large"
                            )
                            : ""
                    }

                </div>
            `
        );


        save();

    }


    /*
     * =========================================================
     * WEEK NAVIGATION
     * =========================================================
     *
     * This is deliberately rendered by the new engine so
     * the sidebar uses the same event chain as Proceed.
     * =========================================================
     */

    function renderStableWeekNavigation() {

        const container =
            document.getElementById(
                "sim-week-navigation"
            );


        const season =
            window.currentSeason;


        if (!container || !season) {
            return;
        }


        const s =
            season.simulation;


        const maxWeeks =
            seasonLength();


        const currentWeek =
            Number(
                s.currentWeek || 1
            );


        const viewingWeek =
            Number(
                s.viewingWeek ||
                currentWeek
            );


        const history =
            Array.isArray(s.history)
                ? s.history
                : [];


        const html = [];


        for (
            let week = 1;
            week <= maxWeeks;
            week++
        ) {

            const isCurrent =
                week === currentWeek;

            const isViewing =
                week === viewingWeek;

            const items =
                history.filter(
                    item =>
                        Number(item.week) === week
                );


            html.push(`
                <div class="sim-week-block
                    ${isCurrent ? "current" : ""}
                    ${isViewing ? "viewing" : ""}
                    ${week < currentWeek ? "past" : ""}
                ">
            `);


            html.push(`
                <button
                    type="button"
                    class="sim-week-label"
                    onclick="viewSimulationWeek(${week})"
                >
                    Week ${week}
                </button>
            `);


            if (isViewing) {

                html.push(`
                    <div class="sim-event-list">
                `);


                items.forEach(
                    (item, index) => {

                        html.push(`
                            <button
                                type="button"
                                class="sim-event-nav completed"
                                onclick="
                                    viewSimulationHistoryEvent(
                                        ${week},
                                        ${index}
                                    )
                                "
                            >
                                <span>
                                    ${escape(
                                        item.label ||
                                        item.title ||
                                        "Event"
                                    )}
                                </span>
                            </button>
                        `);

                    }
                );


                /*
                 * Pending current events.
                 */

                if (
                    isCurrent &&
                    !s.isViewingHistory &&
                    !s.pendingWeekAdvance &&
                    !s.pendingCycle &&
                    s.currentPhase !== "finale"
                ) {

                    const chain =
                        stableWeekEventChain(
                            currentWeek
                        );


                    const index =
                        Number(
                            s.engineEventIndex ??
                            s.currentEventIndex ??
                            0
                        );


                    chain
                        .slice(index)
                        .forEach(
                            (event, offset) => {

                                html.push(`
                                    <div
                                        class="sim-event-nav
                                        ${
                                            offset === 0
                                                ? "active"
                                                : "pending"
                                        }"
                                    >
                                        <span>
                                            ${escape(
                                                event.label
                                            )}
                                        </span>
                                    </div>
                                `);

                            }
                        );

                }


                html.push(`
                    </div>
                `);

            }


            html.push(`
                </div>
            `);

        }


        container.innerHTML =
            html.join("");

    }


    /*
     * =========================================================
     * STABLE PROCEED BUTTON
     * =========================================================
     */

    function runStableNextEvent() {

        const season =
            window.currentSeason;


        if (!season) {

            alert(
                "Please open a saved season first."
            );

            return;

        }


        const s =
            sim();


        /*
         * History mode.
         */

        if (s.isViewingHistory) {

            if (
                window.returnToCurrentSimulation
            ) {

                window.returnToCurrentSimulation();

            }

            return;

        }


        /*
         * =====================================================
         * START NEXT WEEK
         * =====================================================
         */

        if (s.pendingWeekAdvance) {

            const nextWeek =
                Number(
                    s.currentWeek || 1
                ) + 1;


            /*
             * End of regular season.
             */

            if (
                nextWeek >
                seasonLength()
            ) {

                if (
                    window.beginFinale
                ) {

                    window.beginFinale();

                } else if (
                    window.finalizeSeason
                ) {

                    window.finalizeSeason(
                        activePlayers()
                    );

                }

                return;

            }


            /*
             * Reset weekly runtime.
             */

            s.currentWeek =
                nextWeek;

            s.viewingWeek =
                nextWeek;

            s.pendingWeekAdvance =
                false;

            s.pendingCycle =
                false;

            s.evictionsThisWeek =
                0;

            s.currentEventIndex =
                0;

            s.engineEventIndex =
                0;

            s.currentHOH =
                null;

            s.currentSafetyWinner =
                null;

            s.safetyWinner =
                null;

            s.currentNominees =
                [];

            s.currentPOVPlayers =
                [];

            s.currentPOVWinner =
                null;

            s.currentEviction =
                null;

            s.pendingEvictionId =
                null;

            s.evictionVoteResult =
                null;


            s.currentPhase =
                "week";


            refreshUI();


            window.showEvent(
                `Week ${nextWeek}`,
                "WEEK",
                `
                    <p>
                        Week ${nextWeek}
                        is now beginning.
                    </p>
                `,
                {
                    skipHistory: true,
                    week: nextWeek
                }
            );


            save();

            return;

        }


        /*
         * =====================================================
         * FINALE
         * =====================================================
         */

        if (
            s.currentPhase === "finale" ||
            s.finaleStarted
        ) {

            const chain =
                window.getFinaleChain
                    ? window.getFinaleChain()
                    : [];


            const index =
                Number(
                    s.engineEventIndex ??
                    s.currentEventIndex ??
                    0
                );


            const event =
                chain[index];


            if (!event) {

                if (window.beginFinale) {
                    window.beginFinale();
                }

                return;

            }


            s.renderingEventKey =
                event.key;

            s.renderingEventLabel =
                event.label;


            if (
                event.key ===
                "final-hoh"
            ) {

                window.runFinalHOHEvent();

            } else if (
                event.key ===
                "jury-voting"
            ) {

                window.runJuryVotingEvent();

            } else if (
                event.key ===
                "finale-results"
            ) {

                window.runFinaleResultsEvent();

            }


            /*
             * Finale functions use the old
             * currentEventIndex.
             *
             * Keep the engine index synchronized.
             */

            s.engineEventIndex =
                Number(
                    s.currentEventIndex ||
                    index + 1
                );


            refreshUI();
            save();

            return;

        }


        /*
         * =====================================================
         * REGULAR WEEK
         * =====================================================
         */

        const week =
            Number(
                s.currentWeek || 1
            );


        const chain =
            stableWeekEventChain(
                week
            );


        let index =
            Number(
                s.engineEventIndex ??
                0
            );


        /*
         * If this is an older save that doesn't have
         * engineEventIndex, derive it from currentEventIndex.
         */

        if (
            s.engineEventIndex === undefined ||
            s.engineEventIndex === null
        ) {

            index =
                Number(
                    s.currentEventIndex ||
                    0
                );

        }


        const event =
            chain[index];


        /*
         * End of chain.
         */

        if (!event) {

            /*
             * If this is a double eviction cycle,
             * start another cycle in the same week.
             */

            if (
                s.pendingCycle === "double"
            ) {

                s.pendingCycle =
                    false;

                s.engineEventIndex =
                    0;

                s.currentEventIndex =
                    0;

                s.currentHOH =
                    null;

                s.currentSafetyWinner =
                    null;

                s.safetyWinner =
                    null;

                s.currentNominees =
                    [];

                s.currentPOVPlayers =
                    [];

                s.currentPOVWinner =
                    null;

                s.currentEviction =
                    null;

                s.pendingEvictionId =
                    null;

                s.evictionVoteResult =
                    null;


                refreshUI();

                save();

                return;

            }


            s.pendingWeekAdvance =
                true;


            refreshUI();
            save();

            return;

        }


        /*
         * Mark the event for history recording.
         */

        s.renderingEventKey =
            event.key;

        s.renderingEventLabel =
            event.label;


        /*
         * =====================================================
         * DISPATCH
         * =====================================================
         */

        switch (event.key) {


            case "twist":

                if (
                    window.runTwistEvent
                ) {

                    window.runTwistEvent(
                        event.twistId
                    );

                }

                break;


            case "hoh":

                window.runHOHEvent();

                break;


            case "safety":

                runStableSafetyEvent(
                    event.competitionId
                );

                break;


            case "nominations":

                runStableNominationEvent();

                break;


            case "pov-players":

                window.runPOVPlayersEvent();

                break;


            case "pov":

                window.runPOVEvent();

                break;


            case "veto-ceremony":

                window.runVetoCeremonyEvent();

                break;


            case "custom-competition":

                window.runCustomCompetitionEvent(
                    event.competitionId
                );

                break;


            case "eviction-voting":

                runStableEvictionVotingEvent();

                break;


            case "eviction":

                /*
                 * Before running the old eviction function,
                 * ensure it has the correct target.
                 */

                window.runEvictionEvent();

                /*
                 * Detect a double eviction.
                 */

                if (
                    s.evictionsThisWeek >= 1 &&
                    season.rules?.doubleEvictionEnabled === true &&
                    (
                        season.rules?.doubleEvictionWeeks ||
                        []
                    )
                        .map(Number)
                        .includes(week) &&
                    activePlayers().length >
                        Number(
                            season.rules?.finalists || 2
                        )
                ) {

                    s.pendingCycle =
                        "double";

                    s.pendingWeekAdvance =
                        false;

                }

                break;


            default:

                s.currentEventIndex++;

                break;

        }


        /*
         * Advance OUR engine index.
         *
         * The underlying legacy functions may have changed
         * currentEventIndex themselves, so we deliberately
         * keep engineEventIndex authoritative.
         */

        s.engineEventIndex =
            index + 1;


        /*
         * If the eviction function already ended the week,
         * let the next click start the next week.
         */

        if (
            event.key === "eviction" &&
            !s.pendingCycle
        ) {

            if (
                s.currentPhase !== "finale" &&
                activePlayers().length >
                    Number(
                        season.rules?.finalists || 2
                    )
            ) {

                s.pendingWeekAdvance =
                    true;

            }

        }


        refreshUI();
        save();

    }


    /*
     * =========================================================
     * PUBLIC OVERRIDES
     * =========================================================
     */

    window.getWeekEventChain =
        stableWeekEventChain;


    window.runNextEvent =
        runStableNextEvent;


    window.runEvictionVotingEvent =
        runStableEvictionVotingEvent;


    /*
     * We also expose the stable versions so they can be
     * called/debugged from the browser console.
     */

    window.runStableSafetyEvent =
        runStableSafetyEvent;

    window.runStableNominationEvent =
        runStableNominationEvent;

    window.runStableEvictionVotingEvent =
        runStableEvictionVotingEvent;


    /*
     * Replace the navigation renderer.
     */

    window.renderSimulationWeekNavigation =
        renderStableWeekNavigation;


    /*
     * Initial refresh once the script is loaded.
     */

    setTimeout(
        function () {

            try {

                renderStableWeekNavigation();

            } catch (error) {

                console.error(
                    "Stable engine initialization error:",
                    error
                );

            }

        },
        0
    );


})();
