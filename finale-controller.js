/*
 * BIG BROTHER SIMULATOR
 * FINALE CONTROLLER
 *
 * Compatibility layer for the finale only.
 *
 * Final sequence:
 *
 * 0  Final HOH Part 1
 * 1  Final HOH Part 2
 * 2  Final HOH Part 3
 * 3  Final 3 Eviction
 * 4  Jury Voting
 * 5  Final Results
 */

(function () {
    "use strict";

    const ORIGINAL_NEXT = window.runNextEvent;

    function season() {
        return window.currentSeason || null;
    }

    function simulation() {
        return season()?.simulation || null;
    }

    function players() {
        return season()?.houseguests || [];
    }

    function byId(id) {
        return players().find(
            p => String(p.id) === String(id)
        ) || null;
    }

    function activePlayers() {
        if (typeof window.getActiveHouseguests === "function") {
            return window.getActiveHouseguests();
        }

        return players().filter(
            p =>
                p.status !== "evicted" &&
                p.status !== "winner" &&
                p.status !== "runner-up"
        );
    }

    function nameOf(player) {
        if (!player) {
            return "Unknown Houseguest";
        }

        if (
            typeof window.getHouseguestDisplayName ===
            "function"
        ) {
            return window.getHouseguestDisplayName(
                player.id,
                players()
            );
        }

        return (
            player.name ||
            `${player.firstName || ""} ${player.lastName || ""}`.trim() ||
            "Unknown Houseguest"
        );
    }

    function esc(value) {
        if (typeof window.escapeHTML === "function") {
            return window.escapeHTML(
                String(value ?? "")
            );
        }

        return String(value ?? "");
    }

    function portrait(player, size = "medium") {
        if (
            player &&
            typeof window.simulationPortrait ===
                "function"
        ) {
            return window.simulationPortrait(
                player,
                size,
                { showName: false }
            );
        }

        return "";
    }

    function portraits(ids, size = "medium") {
        return ids
            .map(id => byId(id))
            .filter(Boolean)
            .map(player => portrait(player, size))
            .join("");
    }

    function save() {
        if (
            typeof window.persistCurrentSeason ===
            "function"
        ) {
            window.persistCurrentSeason();
        }
    }

    function addStyles() {
        if (
            document.getElementById(
                "single-finale-controller-style"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "single-finale-controller-style";

        style.textContent = `
            .single-finale-eviction {
                width: min(900px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }

            .single-finale-eviction .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .single-finale-results {
                width: min(1200px, 100%);
                margin: 0 auto;
                text-align: center;
            }

            .single-finale-grid {
                display: grid;
                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(150px, 1fr)
                    );
                gap: 18px;
                width: 100%;
                max-width: 1100px;
                margin: 20px auto;
                justify-items: center;
            }

            .single-finale-player-card {
                width: 100%;
                max-width: 180px;
                padding: 16px;
                border:
                    1px solid
                    rgba(255,255,255,.10);
                border-radius: 12px;
                background:
                    rgba(255,255,255,.04);
                text-align: center;
            }

            .single-finale-player-card
            .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .single-finale-place {
                font-weight: 900;
                margin-bottom: 8px;
            }

            .single-finale-champions {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(220px, 1fr));
                gap: 24px;
                max-width: 800px;
                margin: 25px auto;
            }

            .single-finale-champion {
                padding: 24px;
                border:
                    1px solid
                    rgba(255,255,255,.12);
                border-radius: 14px;
                background:
                    rgba(255,255,255,.045);
                text-align: center;
            }

            .single-finale-champion
            .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .single-finale-section {
                width: 100%;
                margin: 30px auto;
                padding: 22px;
                border:
                    1px solid
                    rgba(255,255,255,.10);
                border-radius: 14px;
                background:
                    rgba(255,255,255,.025);
            }

            .single-finale-tally {
                width: min(600px, 100%);
                margin: 0 auto;
            }

            .single-finale-tally-row {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                padding: 12px 15px;
                border-bottom:
                    1px solid
                    rgba(255,255,255,.09);
            }

            .single-finale-jury-list {
                width: min(850px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .single-finale-jury-row {
                display: grid;
                grid-template-columns:
                    minmax(180px, 1fr)
                    45px
                    minmax(180px, 1fr);
                align-items: center;
                gap: 12px;
                padding: 12px;
                border:
                    1px solid
                    rgba(255,255,255,.10);
                border-radius: 12px;
                background:
                    rgba(255,255,255,.04);
            }

            .single-finale-juror {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                text-align: center;
            }

            .single-finale-juror
            .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .single-finale-arrow {
                font-size: 24px;
                font-weight: 900;
                text-align: center;
            }

            @media (max-width: 650px) {
                .single-finale-champions {
                    grid-template-columns: 1fr;
                }

                .single-finale-jury-row {
                    grid-template-columns: 1fr;
                }

                .single-finale-arrow {
                    transform: rotate(90deg);
                }
            }
        `;

        document.head.appendChild(style);
    }

    function finalTwo() {
        const s = simulation();

        const active = activePlayers();

        if (active.length === 2) {
            return active.slice();
        }

        const ids =
            Array.isArray(s?.finalists)
                ? s.finalists
                : [];

        const finalists = ids
            .map(byId)
            .filter(Boolean);

        if (finalists.length === 2) {
            return finalists;
        }

        return players()
            .filter(
                p =>
                    Number(p.placement) === 1 ||
                    Number(p.placement) === 2 ||
                    p.status === "winner" ||
                    p.status === "runner-up"
            )
            .sort(
                (a, b) =>
                    Number(a.placement || 99) -
                    Number(b.placement || 99)
            )
            .slice(0, 2);
    }

    function resolveWinnerRunner() {
        const s = simulation();

        const finalists = finalTwo();

        const votes =
            Array.isArray(s?.juryVotes)
                ? s.juryVotes
                : [];

        const counts = {};

        finalists.forEach(player => {
            counts[player.id] = 0;
        });

        votes.forEach(vote => {
            const targetId =
                vote.vote ??
                vote.target ??
                vote.targetId ??
                vote.voteFor ??
                vote.votedFor;

            if (
                Object.prototype.hasOwnProperty.call(
                    counts,
                    targetId
                )
            ) {
                counts[targetId]++;
            }
        });

        const ranked =
            finalists
                .slice()
                .sort((a, b) => {
                    const voteDifference =
                        Number(
                            counts[b.id] || 0
                        ) -
                        Number(
                            counts[a.id] || 0
                        );

                    if (voteDifference !== 0) {
                        return voteDifference;
                    }

                    return (
                        Number(
                            b.ratings?.social || 0
                        ) -
                        Number(
                            a.ratings?.social || 0
                        )
                    );
                });

        const winner =
            ranked[0] || null;

        const runner =
            ranked[1] || null;

        if (s) {
            s.winner =
                winner?.id || null;

            s.runnerUp =
                runner?.id || null;
        }

        if (winner) {
            winner.status = "winner";
            winner.placement = 1;
        }

        if (runner) {
            runner.status = "runner-up";
            runner.placement = 2;
        }

        return {
            finalists,
            winner,
            runner,
            counts
        };
    }

    function rebuildFinalPlacements(
        winner,
        runner
    ) {
        const s = simulation();

        if (!s) {
            return;
        }

        const entries = [];

        if (winner) {
            entries.push({
                id: winner.id,
                name: nameOf(winner),
                placement: 1
            });
        }

        if (runner) {
            entries.push({
                id: runner.id,
                name: nameOf(runner),
                placement: 2
            });
        }

        players().forEach(player => {
            if (
                player.id === winner?.id ||
                player.id === runner?.id
            ) {
                return;
            }

            const placement =
                Number(player.placement || 0);

            if (placement >= 3) {
                entries.push({
                    id: player.id,
                    name: nameOf(player),
                    placement
                });
            }
        });

        entries.sort(
            (a, b) =>
                a.placement -
                b.placement
        );

        s.finalPlacements = entries;
    }

    function ordinal(number) {
        const n = Number(number);

        if (!Number.isFinite(n)) {
            return "";
        }

        const mod100 = n % 100;

        if (
            mod100 >= 11 &&
            mod100 <= 13
        ) {
            return `${n}th`;
        }

        switch (n % 10) {
            case 1:
                return `${n}st`;

            case 2:
                return `${n}nd`;

            case 3:
                return `${n}rd`;

            default:
                return `${n}th`;
        }
    }

    function placementCard(
        player,
        placement
    ) {
        return `
            <div class="single-finale-player-card">

                <div class="single-finale-place">
                    ${esc(ordinal(placement))} place
                </div>

                ${portrait(player, "medium")}

                <strong>
                    ${esc(nameOf(player))}
                </strong>

            </div>
        `;
    }

    function allPlacements() {
        const s = simulation();

        const map = new Map();

        players().forEach(player => {
            const placement =
                Number(
                    player.placement || 0
                );

            if (placement > 0) {
                map.set(
                    player.id,
                    {
                        player,
                        placement
                    }
                );
            }
        });

        if (
            Array.isArray(
                s?.finalPlacements
            )
        ) {
            s.finalPlacements.forEach(
                item => {
                    const player =
                        byId(item.id);

                    const placement =
                        Number(
                            item.placement || 0
                        );

                    if (
                        player &&
                        placement > 0
                    ) {
                        map.set(
                            player.id,
                            {
                                player,
                                placement
                            }
                        );
                    }
                }
            );
        }

        return [...map.values()].sort(
            (a, b) =>
                a.placement -
                b.placement
        );
    }

    function showResults() {
        addStyles();

        const s = simulation();
        const currentSeason =
            season();

        if (
            !s ||
            !currentSeason
        ) {
            return;
        }

        const result =
            resolveWinnerRunner();

        rebuildFinalPlacements(
            result.winner,
            result.runner
        );

        s.completed = true;
        s.currentPhase = "complete";
        s.currentEventIndex = 5;

        const seasonName =
            document.getElementById(
                "results-season-name"
            );

        const winnerName =
            document.getElementById(
                "winner-name"
            );

        const runnerName =
            document.getElementById(
                "runner-up-name"
            );

        if (seasonName) {
            seasonName.textContent =
                currentSeason.name ||
                "Big Brother";
        }

        if (winnerName) {
            winnerName.textContent =
                result.winner
                    ? nameOf(result.winner)
                    : "—";
        }

        if (runnerName) {
            runnerName.textContent =
                result.runner
                    ? nameOf(result.runner)
                    : "—";
        }

        const placementBox =
            document.getElementById(
                "final-placements"
            );

        if (placementBox) {
            placementBox.innerHTML =
                allPlacements()
                    .map(item =>
                        placementCard(
                            item.player,
                            item.placement
                        )
                    )
                    .join("");
        }

        const juryBox =
            document.getElementById(
                "final-jury-results"
            );

        if (juryBox) {
            const votes =
                Array.isArray(
                    s.juryVotes
                )
                    ? s.juryVotes
                    : [];

            const jury =
                players()
                    .filter(
                        player =>
                            Number(
                                player.placement
                            ) >= 3 &&
                            Number(
                                player.placement
                            ) <=
                                2 +
                                    Number(
                                        currentSeason
                                            .rules
                                            ?.jurySize ??
                                            7
                                    )
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.placement
                            ) -
                            Number(
                                b.placement
                            )
                    );

            const voteRows =
                jury
                    .map(juror => {
                        const vote =
                            votes.find(
                                item =>
                                    String(
                                        item.juror ??
                                        item.jurorId ??
                                        item.voter ??
                                        item.voterId
                                    ) ===
                                    String(
                                        juror.id
                                    )
                            );

                        const targetId =
                            vote?.vote ??
                            vote?.target ??
                            vote?.targetId ??
                            vote?.voteFor ??
                            vote?.votedFor;

                        const target =
                            byId(targetId);

                        return `
                            <div class="single-finale-jury-row">

                                <div class="single-finale-juror">
                                    ${portrait(
                                        juror,
                                        "small"
                                    )}

                                    <strong>
                                        ${esc(
                                            nameOf(
                                                juror
                                            )
                                        )}
                                    </strong>

                                    <span>
                                        ${esc(
                                            ordinal(
                                                juror.placement
                                            )
                                        )}
                                    </span>
                                </div>

                                <div class="single-finale-arrow">
                                    →
                                </div>

                                <div class="single-finale-juror">
                                    ${
                                        target
                                            ? portrait(
                                                  target,
                                                  "small"
                                              )
                                            : ""
                                    }

                                    <strong>
                                        ${
                                            target
                                                ? esc(
                                                      nameOf(
                                                          target
                                                      )
                                                  )
                                                : "No vote recorded"
                                        }
                                    </strong>
                                </div>

                            </div>
                        `;
                    })
                    .join("");

            const tally =
                result.finalists
                    .map(
                        finalist => `
                            <div class="single-finale-tally-row">
                                <span>
                                    ${esc(
                                        nameOf(
                                            finalist
                                        )
                                    )}
                                </span>

                                <strong>
                                    ${
                                        Number(
                                            result
                                                .counts[
                                                finalist
                                                    .id
                                            ] || 0
                                        )
                                    }
                                    vote${
                                        Number(
                                            result
                                                .counts[
                                                finalist
                                                    .id
                                            ] || 0
                                        ) === 1
                                            ? ""
                                            : "s"
                                    }
                                </strong>
                            </div>
                        `
                    )
                    .join("");

            juryBox.innerHTML = `
                <h3>Final Vote Count</h3>

                <div class="single-finale-tally">
                    ${tally}
                </div>

                <h3>
                    Jury Members & Votes
                </h3>

                <div class="single-finale-jury-list">
                    ${
                        voteRows ||
                        "<p>No jury members were recorded.</p>"
                    }
                </div>
            `;
        }

        if (
            typeof window.renderSeasonStatistics ===
            "function"
        ) {
            window.renderSeasonStatistics();
        }

        if (
            typeof window.showPage ===
            "function"
        ) {
            window.showPage(
                "results-page"
            );
        }

        save();
    }

    /*
     * The ONLY finale Proceed handler.
     *
     * Part 1–3 are still handled by app.js.
     * This controller only takes over after Part 3.
     */

    window.runNextEvent = function () {
        const s = simulation();

        if (!s) {
            return;
        }

        if (s.isViewingHistory) {
            if (
                typeof window.returnToCurrentSimulation ===
                "function"
            ) {
                window.returnToCurrentSimulation();
            }

            return;
        }

        const isFinale =
            s.currentPhase === "finale" ||
            s.finaleStarted === true;

        if (!isFinale) {
            if (
                typeof ORIGINAL_NEXT ===
                "function"
            ) {
                ORIGINAL_NEXT();
            }

            return;
        }

        const index =
            Number(
                s.currentEventIndex || 0
            );

        /*
         * PARTS 1–3
         *
         * Give control back to app.js.
         */
        if (index <= 2) {
            if (
                typeof ORIGINAL_NEXT ===
                "function"
            ) {
                ORIGINAL_NEXT();
            }

            return;
        }

        /*
         * FINAL 3 → FINAL 2
         */
        if (
            index === 3 &&
            activePlayers().length === 3
        ) {
            const finalists =
                Array.isArray(s.finalists)
                    ? s.finalists
                          .map(byId)
                          .filter(Boolean)
                    : activePlayers();

            const finalHOH =
                byId(
                    s.finalHOH3 ||
                    s.finalHOH
                ) ||
                finalists[0];

            if (!finalHOH) {
                console.error(
                    "Finale: Final HOH could not be determined."
                );

                return;
            }

            const others =
                activePlayers().filter(
                    player =>
                        player.id !==
                        finalHOH.id
                );

            if (others.length !== 2) {
                console.error(
                    "Finale: Could not determine the other two Final 3 players."
                );

                return;
            }

            const chosen =
                others
                    .slice()
                    .sort(
                        (a, b) => {
                            const aBond =
                                typeof window.allianceBond ===
                                "function"
                                    ? Number(
                                          window.allianceBond(
                                              finalHOH.id,
                                              a.id
                                          ) || 0
                                      )
                                    : 0;

                            const bBond =
                                typeof window.allianceBond ===
                                "function"
                                    ? Number(
                                          window.allianceBond(
                                              finalHOH.id,
                                              b.id
                                          ) || 0
                                      )
                                    : 0;

                            return (
                                bBond -
                                aBond
                            );
                        }
                    )[0];

            const third =
                others.find(
                    player =>
                        player.id !==
                        chosen.id
                );

            if (!third) {
                return;
            }

            /*
             * Record the Final 3 eviction.
             */
            third.status = "evicted";
            third.placement = 3;

            const finalTwo = [
                finalHOH,
                chosen
            ];

            s.finalists =
                finalTwo.map(
                    player => player.id
                );

            /*
             * Create jury votes exactly once.
             *
             * The jury-boundary-fix.js loaded by index.html
             * will subsequently normalize the jury to the
             * configured boundary.
             */
            if (
                !Array.isArray(
                    s.juryVotes
                ) ||
                !s.juryVotes.length
            ) {
                const jurySize =
                    Math.max(
                        0,
                        Number(
                            season()
                                ?.rules
                                ?.jurySize ??
                            7
                        )
                    );

                const jury =
                    players()
                        .filter(
                            player => {
                                const place =
                                    Number(
                                        player
                                            .placement
                                    );

                                return (
                                    place >= 3 &&
                                    place <=
                                        2 +
                                            jurySize
                                );
                            }
                        )
                        .sort(
                            (a, b) =>
                                Number(
                                    a.placement
                                ) -
                                Number(
                                    b.placement
                                )
                        );

                const votes =
                    jury.map(
                        juror => {
                            const ranked =
                                finalTwo
                                    .map(
                                        finalist => {
                                            const bond =
                                                typeof window.allianceBond ===
                                                "function"
                                                    ? Number(
                                                          window.allianceBond(
                                                              juror.id,
                                                              finalist.id
                                                          ) || 0
                                                      )
                                                    : 0;

                                            const score =
                                                Number(
                                                    finalist
                                                        .ratings
                                                        ?.social ||
                                                    0
                                                ) *
                                                    0.40 +
                                                Number(
                                                    finalist
                                                        .ratings
                                                        ?.strategic ||
                                                    0
                                                ) *
                                                    0.35 +
                                                Number(
                                                    finalist
                                                        .ratings
                                                        ?.general ||
                                                    0
                                                ) *
                                                    0.15 +
                                                Number(
                                                    finalist
                                                        .ratings
                                                        ?.mental ||
                                                    0
                                                ) *
                                                    0.10 +
                                                bond *
                                                    0.15 +
                                                Math.random() *
                                                    3;

                                            return {
                                                finalist,
                                                score
                                            };
                                        }
                                    )
                                    .sort(
                                        (a, b) =>
                                            b.score -
                                            a.score
                                    );

                            return {
                                juror:
                                    juror.id,
                                vote:
                                    ranked[0]
                                        ?.finalist
                                        ?.id ||
                                    null
                            };
                        }
                    );

                s.juryVotes =
                    votes;

                const counts = {};

                finalTwo.forEach(
                    player => {
                        counts[player.id] = 0;
                    }
                );

                votes.forEach(
                    vote => {
                        if (
                            vote.vote &&
                            Object.prototype.hasOwnProperty.call(
                                counts,
                                vote.vote
                            )
                        ) {
                            counts[
                                vote.vote
                            ]++;
                        }
                    }
                );

                s.finaleVoteResults = {
                    votes,
                    counts
                };
            }

            s.currentEventIndex = 3;

            s.finalEvictionReveal = {
                playerId: third.id,
                juryIndex: 4
            };

            if (
                typeof window.showEvent ===
                "function"
            ) {
                window.showEvent(
                    "Final Eviction",
                    "EVICTION",
                    `
                        <div class="single-finale-eviction">

                            ${portrait(
                                third,
                                "large"
                            )}

                            <h2>
                                ${esc(
                                    nameOf(
                                        third
                                    )
                                )}
                            </h2>

                            <p>
                                <strong>
                                    ${esc(
                                        nameOf(
                                            third
                                        )
                                    )}
                                </strong>
                                has been evicted from
                                the Big Brother house in
                                <strong>
                                    3rd place
                                </strong>.
                            </p>

                            <p>
                                The Final 2 have now
                                been decided.
                            </p>

                            <p>
                                Press
                                <strong>
                                    Proceed
                                </strong>
                                to reveal the jury vote.
                            </p>

                        </div>
                    `,
                    {
                        week:
                            s.currentWeek,
                        skipHistory:
                            true,
                        skipLiveView:
                            false
                    }
                );
            }

            save();

            return;
        }

        /*
         * FINAL EVICTION → JURY VOTING
         *
         * This is intentionally separate from the
         * Final 3 calculation.
         */
        if (
            index === 3 &&
            s.finalEvictionReveal
        ) {
            s.finalEvictionReveal =
                null;

            s.currentEventIndex = 4;

            /*
             * Let the authoritative jury fix loaded by
             * index.html render the final jury.
             */
            if (
                typeof window.syncCorrectJury ===
                "function"
            ) {
                window.syncCorrectJury();
            }

            const juryVotes =
                Array.isArray(
                    s.juryVotes
                )
                    ? s.juryVotes
                    : [];

            if (
                typeof window.showEvent ===
                "function"
            ) {
                window.showEvent(
                    "Jury Voting",
                    "JURY VOTING",
                    `
                        <div class="single-finale-results">

                            ${portraits(
                                finalTwo().map(
                                    p => p.id
                                ),
                                "large"
                            )}

                            <h2>
                                The Jury Votes
                            </h2>

                            <p>
                                The Final 2 have
                                received the jury's
                                votes.
                            </p>

                            <p>
                                Press
                                <strong>
                                    Proceed
                                </strong>
                                to reveal the
                                Final Results.
                            </p>

                        </div>
                    `,
                    {
                        week:
                            s.currentWeek,
                        skipHistory:
                            true,
                        skipLiveView:
                            false
                    }
                );
            }

            save();

            return;
        }

        /*
         * FINAL RESULTS
         */
        if (index >= 4) {
            showResults();
            return;
        }

        /*
         * Safety fallback.
         */
        if (
            typeof ORIGINAL_NEXT ===
            "function"
        ) {
            ORIGINAL_NEXT();
        }
    };

    /*
     * Make sure direct calls to showResults use
     * this controller's result renderer.
     */
    window.showResults = showResults;

    addStyles();

    console.log(
        "Single Finale Controller loaded successfully."
    );
})();
