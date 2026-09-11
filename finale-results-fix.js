/*
 * BIG BROTHER SIMULATOR — FINALE / HOH ELIGIBILITY FIX
 *
 * Standalone compatibility layer. It does not replace app.js or twist-engine.js.
 *
 * Fixes:
 *  1. The outgoing HOH cannot win the immediately following HOH unless a
 *     future twist explicitly adds that rule.
 *  2. The finale jury is rebuilt from actual eviction placements.
 *     Jury Size 9 = 3rd through 11th place.
 *     Pre-jury players cannot vote.
 *  3. The finale results screen explicitly shows every jury vote, the tally,
 *     the winner, and the runner-up.
 */

(function () {
    "use strict";

    const STYLE_ID = "finale-results-fix-style";
    const ORIGINAL_NEXT = window.runNextEvent;
    const ORIGINAL_HOH = window.runHOHEvent;

    function season() {
        return window.currentSeason || null;
    }

    function sim() {
        return season()?.simulation || null;
    }

    function allPlayers() {
        return season()?.houseguests || [];
    }

    function activePlayers() {
        return window.getActiveHouseguests
            ? window.getActiveHouseguests()
            : allPlayers().filter(
                p =>
                    p.status !== "evicted" &&
                    p.status !== "winner" &&
                    p.status !== "runner-up"
            );
    }

    function byId(id) {
        return allPlayers().find(
            p => String(p.id) === String(id)
        ) || null;
    }

    function nameOf(p) {
        if (!p) return "Unknown Houseguest";

        return window.getHouseguestDisplayName
            ? window.getHouseguestDisplayName(
                p.id,
                allPlayers()
            )
            : (
                p.name ||
                `${p.firstName || ""} ${p.lastName || ""}`.trim() ||
                "Unknown Houseguest"
            );
    }

    function esc(v) {
        return window.escapeHTML
            ? window.escapeHTML(String(v ?? ""))
            : String(v ?? "");
    }

    function portrait(p, size) {
        return window.simulationPortrait
            ? window.simulationPortrait(
                p,
                size || "medium"
            )
            : "";
    }

    function portraits(ids, size) {
        return window.simulationPortraits
            ? window.simulationPortraits(
                ids,
                size || "medium"
            )
            : ids
                .map(id => portrait(byId(id), size))
                .join("");
    }

    function save() {
        if (window.persistCurrentSeason) {
            window.persistCurrentSeason();
        }
    }

    function addStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");

        style.id = STYLE_ID;

        style.textContent = `
            .finale-fix-jury {
                width: min(900px, 100%);
                margin: 0 auto;
                text-align: center;
            }

            .finale-fix-jury-finalists {
                display: flex;
                justify-content: center;
                align-items: flex-start;
                flex-wrap: wrap;
                gap: 28px;
                margin: 18px auto 28px;
            }

            .finale-fix-jury-list {
                width: min(760px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .finale-fix-juror-row {
                display: grid;
                grid-template-columns:
                    minmax(150px, 1fr)
                    44px
                    minmax(150px, 1fr);
                align-items: center;
                gap: 14px;
                padding: 10px 14px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 10px;
                background: rgba(255,255,255,.045);
                text-align: center;
            }

            .finale-fix-juror-side {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                min-width: 0;
            }

            .finale-fix-juror-side .sim-portrait {
                flex: 0 0 auto;
            }

            .finale-fix-juror-side > strong {
                overflow-wrap: anywhere;
            }

            .finale-fix-arrow {
                font-size: 20px;
                font-weight: 900;
            }

            .finale-fix-tally {
                width: min(520px, 100%);
                margin: 24px auto;
                border: 1px solid rgba(255,255,255,.14);
                border-radius: 10px;
                overflow: hidden;
            }

            .finale-fix-tally-row {
                display: flex;
                justify-content: space-between;
                gap: 14px;
                padding: 11px 15px;
                border-bottom: 1px solid rgba(255,255,255,.10);
            }

            .finale-fix-tally-row:last-child {
                border-bottom: 0;
            }

            .finale-fix-results {
                width: min(1000px, 100%);
                margin: 0 auto;
                text-align: center;
            }

            .finale-fix-champions {
                display: flex;
                justify-content: center;
                align-items: flex-start;
                flex-wrap: wrap;
                gap: 60px;
                margin: 20px auto 30px;
            }

            .finale-fix-champion-card {
                min-width: 180px;
            }

            .finale-fix-champion-card .sim-portrait {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .finale-fix-results-jury {
                width: min(760px, 100%);
                margin: 28px auto;
            }

            @media (max-width: 620px) {
                .finale-fix-juror-row {
                    grid-template-columns: 1fr;
                    gap: 7px;
                }

                .finale-fix-arrow {
                    transform: rotate(90deg);
                }

                .finale-fix-champions {
                    gap: 28px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function inferLastHOH() {
        const s = sim();

        if (!s) return null;

        if (s.lastHOHId && byId(s.lastHOHId)) {
            return s.lastHOHId;
        }

        const history = Array.isArray(s.history)
            ? s.history
                .slice()
                .sort(
                    (a, b) =>
                        Number(b.timestamp || 0) -
                        Number(a.timestamp || 0)
                )
            : [];

        const item = history.find(
            h =>
                h.event === "hoh" ||
                /HOH/i.test(String(h.type || ""))
        );

        if (item && item.content) {
            const match = String(item.content).match(
                /<img[^>]*alt=["']([^"']+)["']/i
            );

            if (match) {
                const found = allPlayers().find(
                    p =>
                        nameOf(p) === match[1] ||
                        p.name === match[1]
                );

                if (found) {
                    return found.id;
                }
            }
        }

        const maxWins = Math.max(
            0,
            ...allPlayers().map(
                p => Number(p.hohWins || 0)
            )
        );

        if (maxWins > 0) {
            const candidates = allPlayers().filter(
                p =>
                    Number(p.hohWins || 0) === maxWins &&
                    p.status !== "evicted"
            );

            if (candidates.length === 1) {
                return candidates[0].id;
            }
        }

        return null;
    }

    function chooseHOHWithoutOutgoing(pool, comp) {
        if (!pool.length) return null;

        let winner = null;

        if (
            comp &&
            window.chooseCompetitionWinnerByCustom
        ) {
            winner =
                window.chooseCompetitionWinnerByCustom(
                    pool,
                    comp
                );
        }

        if (
            !winner &&
            window.chooseCompetitionWinner
        ) {
            winner =
                window.chooseCompetitionWinner(
                    pool,
                    comp?.primary || "physical",
                    comp?.secondary || "mental",
                    "general"
                );
        }

        return (
            winner ||
            pool[
                Math.floor(
                    Math.random() * pool.length
                )
            ]
        );
    }

    function fixedHOHEvent() {
        const s = sim();

        if (!s) return;

        const active = activePlayers();

        if (!active.length) return;

        const previousHOH =
            Number(s.currentWeek || 1) > 1
                ? inferLastHOH()
                : null;

        let pool = active.filter(
            p =>
                !previousHOH ||
                p.id !== previousHOH
        );

        let hoh = null;

        if (
            Number(s.currentWeek || 1) === 1 &&
            season()?.rules?.startingHOH === "specific" &&
            season()?.rules?.specificStartingHOH
        ) {
            hoh =
                pool.find(
                    p =>
                        p.id ===
                        season().rules
                            .specificStartingHOH
                ) ||
                active.find(
                    p =>
                        p.id ===
                        season().rules
                            .specificStartingHOH
                ) ||
                null;
        }

        if (!hoh) {
            const comp =
                window.getCompetitionForWeekType
                    ? window.getCompetitionForWeekType(
                        s.currentWeek,
                        "hoh"
                    )
                    : null;

            hoh =
                chooseHOHWithoutOutgoing(
                    pool,
                    comp
                );
        }

        if (!hoh) {
            hoh = active[0];
        }

        s.currentHOH = hoh.id;
        s.lastHOHId = hoh.id;

        hoh.hohWins =
            Number(hoh.hohWins || 0) + 1;

        s.currentEventIndex =
            Number(s.currentEventIndex || 0) + 1;

        if (window.updateSimulatorStatus) {
            window.updateSimulatorStatus(s);
        }

        if (window.resetGameChain) {
            window.resetGameChain(
                s.currentEventIndex
            );
        }

        const comp =
            window.getCompetitionForWeekType
                ? window.getCompetitionForWeekType(
                    s.currentWeek,
                    "hoh"
                )
                : null;

        const title =
            comp?.name ||
            "Head of Household";

        if (window.showEvent) {
            window.showEvent(
                title,
                "HOH COMPETITION",
                `
                <div
                    class="stable-event-card"
                    style="
                        text-align:center;
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:flex-start;
                        width:100%;
                        max-width:900px;
                        margin:0 auto;
                    "
                >
                    ${portrait(hoh, "large")}

                    <h3>
                        ${esc(nameOf(hoh))}
                    </h3>

                    <p>
                        has won
                        <strong>${esc(title)}</strong>.
                    </p>

                    ${
                        comp?.description
                            ? `
                                <p class="event-description">
                                    ${esc(comp.description)}
                                </p>
                            `
                            : ""
                    }
                </div>
                `
            );
        }

        save();
    }

    /*
     * ============================================================
     * CORRECTED JURY LOGIC
     * ============================================================
     *
     * Jury Size 9:
     *
     * 1st  = Finalist
     * 2nd  = Finalist
     * 3rd  = Juror
     * 4th  = Juror
     * 5th  = Juror
     * 6th  = Juror
     * 7th  = Juror
     * 8th  = Juror
     * 9th  = Juror
     * 10th = Juror
     * 11th = Juror
     * 12th+ = Pre-jury
     *
     * Therefore:
     *
     * minimum jury placement = 3
     * maximum jury placement = 2 + jurySize
     *
     * For jurySize 9:
     * 2 + 9 = 11
     *
     * So the jury is exactly 3rd through 11th.
     * ============================================================
     */

    function eligibleJury() {
        const configured = Math.max(
            0,
            Number(
                season()?.rules?.jurySize ?? 7
            )
        );

        const maxPlacement =
            2 + configured;

        return allPlayers()
            .filter(p => {
                const placement =
                    Number(p.placement);

                return (
                    p.status === "evicted" &&
                    Number.isFinite(placement) &&
                    placement >= 3 &&
                    placement <= maxPlacement
                );
            })
            .sort(
                (a, b) =>
                    Number(a.placement) -
                    Number(b.placement)
            );
    }

    function finalTwo() {
        const s = sim();

        return (s?.finalists || [])
            .map(byId)
            .filter(Boolean)
            .slice(0, 2);
    }

    function calculateJuryVotes() {
        const s = sim();

        const finalists = finalTwo();

        const jury = eligibleJury();

        const votes = [];

        const counts = {};

        finalists.forEach(
            p => {
                counts[p.id] = 0;
            }
        );

        jury.forEach(juror => {
            const ranked =
                finalists
                    .map(f => {
                        const bond =
                            window.allianceBond
                                ? Number(
                                    window.allianceBond(
                                        juror.id,
                                        f.id
                                    ) || 0
                                )
                                : 0;

                        const score =
                            Number(
                                f.ratings?.social || 0
                            ) * .4 +

                            Number(
                                f.ratings?.strategic || 0
                            ) * .35 +

                            Number(
                                f.ratings?.general || 0
                            ) * .15 +

                            Number(
                                f.ratings?.mental || 0
                            ) * .1 +

                            bond * .15 +

                            Math.random() * 3;

                        return {
                            f,
                            score
                        };
                    })
                    .sort(
                        (a, b) =>
                            b.score - a.score
                    );

            if (ranked[0]) {
                votes.push({
                    juror: juror.id,
                    vote: ranked[0].f.id
                });

                counts[
                    ranked[0].f.id
                ] =
                    Number(
                        counts[
                            ranked[0].f.id
                        ] || 0
                    ) + 1;
            }
        });

        /*
         * IMPORTANT:
         * Save the corrected jury directly into the simulation.
         */
        s.jury =
            jury.map(
                p => p.id
            );

        s.juryVotes = votes;

        s.finaleVoteResults = {
            votes,
            counts
        };

        return {
            finalists,
            jury,
            votes,
            counts
        };
    }

    function juryContent() {
        const data =
            calculateJuryVotes();

        const {
            finalists,
            jury,
            votes,
            counts
        } = data;

        const rows =
            jury
                .map(juror => {
                    const vote =
                        votes.find(
                            v =>
                                v.juror ===
                                juror.id
                        );

                    const target =
                        vote
                            ? byId(vote.vote)
                            : null;

                    return `
                        <div class="finale-fix-juror-row">

                            <div class="finale-fix-juror-side">
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
                            </div>

                            <div class="finale-fix-arrow">
                                →
                            </div>

                            <div class="finale-fix-juror-side">
                                ${portrait(
                                    target,
                                    "small"
                                )}

                                <strong>
                                    ${esc(
                                        nameOf(
                                            target
                                        )
                                    )}
                                </strong>
                            </div>

                        </div>
                    `;
                })
                .join("");

        const tally =
            finalists
                .map(
                    p => `
                        <div class="finale-fix-tally-row">
                            <span>
                                ${esc(
                                    nameOf(p)
                                )}
                            </span>

                            <strong>
                                ${
                                    Number(
                                        counts[p.id] ||
                                        0
                                    )
                                }
                                vote${
                                    Number(
                                        counts[p.id] ||
                                        0
                                    ) === 1
                                        ? ""
                                        : "s"
                                }
                            </strong>
                        </div>
                    `
                )
                .join("");

        return `
            <div class="finale-fix-jury">

                <h2>
                    The Jury Votes
                </h2>

                <div class="finale-fix-jury-finalists">
                    ${portraits(
                        finalists.map(
                            p => p.id
                        ),
                        "large"
                    )}
                </div>

                <p>
                    <strong>
                        ${jury.length}
                    </strong>
                    eligible juror${
                        jury.length === 1
                            ? ""
                            : "s"
                    }
                    voted.
                </p>

                <div class="finale-fix-jury-list">
                    ${
                        rows ||
                        "<p>No eligible jury members were found.</p>"
                    }
                </div>

                <h3>
                    Jury Tally
                </h3>

                <div class="finale-fix-tally">
                    ${tally}
                </div>

                <p>
                    Press
                    <strong>
                        Proceed
                    </strong>
                    to see the winner and runner-up.
                </p>

            </div>
        `;
    }

    function showFinaleJury() {
        const s = sim();

        if (
            !s ||
            !window.showEvent
        ) {
            return;
        }

        const content =
            juryContent();

        window.showEvent(
            "Jury Voting",
            "JURY VOTING",
            content,
            {
                skipHistory: true,
                skipLiveView: false,
                week: s.currentWeek
            }
        );

        const history =
            Array.isArray(s.history)
                ? s.history
                : [];

        const item =
            history
                .slice()
                .reverse()
                .find(
                    h =>
                        h.event ===
                            "jury-voting" ||
                        h.label ===
                            "Jury Voting"
                );

        if (item) {
            item.content =
                content;
        }

        save();
    }

    function winnerAndRunner() {
        const s = sim();

        const finalists =
            finalTwo();

        const counts =
            s?.finaleVoteResults
                ?.counts || {};

        const ranked =
            finalists
                .slice()
                .sort(
                    (a, b) => {
                        const diff =
                            Number(
                                counts[b.id] ||
                                0
                            ) -
                            Number(
                                counts[a.id] ||
                                0
                            );

                        return (
                            diff ||
                            Number(
                                b.ratings?.social ||
                                0
                            ) -
                            Number(
                                a.ratings?.social ||
                                0
                            )
                        );
                    }
                );

        return {
            winner:
                ranked[0] || null,

            runner:
                ranked[1] || null,

            finalists,

            counts
        };
    }

    function resultsContent() {
        const s = sim();

        const data =
            winnerAndRunner();

        const {
            winner,
            runner,
            finalists,
            counts
        } = data;

        if (winner) {
            winner.status =
                "winner";

            winner.placement =
                1;

            s.winner =
                winner.id;
        }

        if (runner) {
            runner.status =
                "runner-up";

            runner.placement =
                2;

            s.runnerUp =
                runner.id;
        }

        /*
         * Recalculate using the corrected jury boundary.
         */
        const jury =
            eligibleJury();

        const votes =
            s.finaleVoteResults
                ?.votes || [];

        const voteRows =
            jury
                .map(j => {
                    const v =
                        votes.find(
                            x =>
                                x.juror ===
                                j.id
                        );

                    return `
                        <div class="finale-fix-juror-row">

                            <div class="finale-fix-juror-side">
                                ${portrait(
                                    j,
                                    "small"
                                )}

                                <strong>
                                    ${esc(
                                        nameOf(j)
                                    )}
                                </strong>
                            </div>

                            <div class="finale-fix-arrow">
                                →
                            </div>

                            <div class="finale-fix-juror-side">
                                ${portrait(
                                    v
                                        ? byId(
                                            v.vote
                                        )
                                        : null,
                                    "small"
                                )}

                                <strong>
                                    ${
                                        esc(
                                            v
                                                ? nameOf(
                                                    byId(
                                                        v.vote
                                                    )
                                                )
                                                : "No vote recorded"
                                        )
                                    }
                                </strong>
                            </div>

                        </div>
                    `;
                })
                .join("");

        s.completed =
            true;

        s.currentPhase =
            "complete";

        return `
            <div class="finale-fix-results">

                <h2>
                    Final Results
                </h2>

                <div class="finale-fix-champions">

                    ${
                        winner
                            ? `
                                <div class="finale-fix-champion-card">

                                    ${portrait(
                                        winner,
                                        "large"
                                    )}

                                    <h2>
                                        ${esc(
                                            nameOf(
                                                winner
                                            )
                                        )}
                                    </h2>

                                    <p>
                                        <strong>
                                            WINNER
                                        </strong>
                                    </p>

                                    <p>
                                        ${
                                            Number(
                                                counts[
                                                    winner.id
                                                ] || 0
                                            )
                                        }
                                        jury vote${
                                            Number(
                                                counts[
                                                    winner.id
                                                ] || 0
                                            ) === 1
                                                ? ""
                                                : "s"
                                        }
                                    </p>

                                </div>
                            `
                            : ""
                    }

                    ${
                        runner
                            ? `
                                <div class="finale-fix-champion-card">

                                    ${portrait(
                                        runner,
                                        "large"
                                    )}

                                    <h2>
                                        ${esc(
                                            nameOf(
                                                runner
                                            )
                                        )}
                                    </h2>

                                    <p>
                                        <strong>
                                            RUNNER-UP
                                        </strong>
                                    </p>

                                    <p>
                                        ${
                                            Number(
                                                counts[
                                                    runner.id
                                                ] || 0
                                            )
                                        }
                                        jury vote${
                                            Number(
                                                counts[
                                                    runner.id
                                                ] || 0
                                            ) === 1
                                                ? ""
                                                : "s"
                                        }
                                    </p>

                                </div>
                            `
                            : ""
                    }

                </div>

                <h3>
                    Complete Jury Vote
                </h3>

                <div class="finale-fix-results-jury">

                    <div class="finale-fix-jury-list">

                        ${
                            voteRows ||
                            "<p>No eligible jury votes were recorded.</p>"
                        }

                    </div>

                </div>

                <h3>
                    Jury Tally
                </h3>

                <div class="finale-fix-tally">

                    ${
                        finalists
                            .map(
                                p => `
                                    <div class="finale-fix-tally-row">

                                        <span>
                                            ${esc(
                                                nameOf(
                                                    p
                                                )
                                            )}
                                        </span>

                                        <strong>
                                            ${
                                                Number(
                                                    counts[
                                                        p.id
                                                    ] || 0
                                                )
                                            }
                                        </strong>

                                    </div>
                                `
                            )
                            .join("")
                    }

                </div>

                <p>

                    <strong>
                        ${
                            winner
                                ? esc(
                                    nameOf(
                                        winner
                                    )
                                )
                                : "No winner"
                        }
                    </strong>

                    is the winner and

                    <strong>
                        ${
                            runner
                                ? esc(
                                    nameOf(
                                        runner
                                    )
                                )
                                : "No runner-up"
                        }
                    </strong>

                    is the runner-up.

                </p>

                <button
                    type="button"
                    class="primary-button"
                    onclick="showResults()"
                >
                    View Full Results
                </button>

            </div>
        `;
    }

    function renderFullResults() {
        const s =
            season();

        const simulation =
            sim();

        if (
            !s ||
            !simulation
        ) {
            return;
        }

        const winner =
            byId(
                simulation.winner
            );

        const runner =
            byId(
                simulation.runnerUp
            );

        const resultBox =
            document.getElementById(
                "final-jury-results"
            );

        const rows =
            (simulation.jury || [])
                .map(jid => {
                    const juror =
                        byId(jid);

                    const vote =
                        (
                            simulation.juryVotes ||
                            []
                        ).find(
                            v =>
                                v.juror ===
                                jid
                        );

                    return `
                        <div class="finale-fix-juror-row">

                            <div class="finale-fix-juror-side">
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
                            </div>

                            <div class="finale-fix-arrow">
                                →
                            </div>

                            <div class="finale-fix-juror-side">
                                ${portrait(
                                    vote
                                        ? byId(
                                            vote.vote
                                        )
                                        : null,
                                    "small"
                                )}

                                <strong>
                                    ${
                                        esc(
                                            vote
                                                ? nameOf(
                                                    byId(
                                                        vote.vote
                                                    )
                                                )
                                                : "No vote recorded"
                                        )
                                    }
                                </strong>
                            </div>

                        </div>
                    `;
                })
                .join("");

        if (resultBox) {
            resultBox.innerHTML =
                `
                    <h3>
                        Individual Jury Votes
                    </h3>

                    <div class="finale-fix-jury-list">

                        ${
                            rows ||
                            "<p>No jury members were recorded.</p>"
                        }

                    </div>
                `;
        }

        if (window.setText) {
            window.setText(
                "results-season-name",
                s.name ||
                    "Big Brother"
            );

            window.setText(
                "winner-name",
                winner
                    ? nameOf(winner)
                    : "—"
            );

            window.setText(
                "runner-up-name",
                runner
                    ? nameOf(runner)
                    : "—"
            );
        }

        if (
            window.renderFinalPlacements
        ) {
            window.renderFinalPlacements();
        }

        if (
            window.renderSeasonStatistics
        ) {
            window.renderSeasonStatistics();
        }

        if (window.showPage) {
            window.showPage(
                "results-page"
            );
        }
    }

    function fixedNextEvent() {
        addStyles();

        const s =
            sim();

        if (
            !s ||
            typeof ORIGINAL_NEXT !==
                "function"
        ) {
            return;
        }

        const finale =
            s.currentPhase ===
                "finale" ||
            s.finaleStarted;

        if (finale) {
            const index =
                Number(
                    s.currentEventIndex ||
                    0
                );

            const chain =
                window.getFinaleChain
                    ? window.getFinaleChain()
                    : [];

            const event =
                chain[index];

            if (
                event?.key ===
                "jury-voting"
            ) {
                if (
                    s.pendingFinalEvictionReveal
                ) {
                    ORIGINAL_NEXT();
                    return;
                }

                ORIGINAL_NEXT();

                if (
                    s.finaleVoteResults
                        ?.votes
                ) {
                    showFinaleJury();
                }

                return;
            }

            if (
                event?.key ===
                "finale-results"
            ) {
                ORIGINAL_NEXT();

                const content =
                    resultsContent();

                if (
                    window.showEvent
                ) {
                    window.showEvent(
                        "Final Results",
                        "FINAL RESULTS",
                        content,
                        {
                            skipHistory: true,
                            skipLiveView: false,
                            week:
                                s.currentWeek
                        }
                    );
                }

                save();

                return;
            }
        }

        ORIGINAL_NEXT();
    }

    addStyles();

    window.runHOHEvent =
        fixedHOHEvent;

    window.runNextEvent =
        fixedNextEvent;

    window.showResults =
        renderFullResults;

    console.log(
        "Finale / HOH eligibility fix loaded."
    );

})();
