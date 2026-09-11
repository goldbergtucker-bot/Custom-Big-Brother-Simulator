/*
 * BIG BROTHER SIMULATOR — FINAL JURY BOUNDARY FIX
 *
 * LOAD THIS FILE LAST.
 *
 * Required rule:
 *   Jury Size 9 = 3rd through 11th place.
 *   1st/2nd = finalists.
 *   12th+ = pre-jury.
 *
 * This file is intentionally standalone so it can be added without
 * replacing app.js, twist-engine.js, finale-controller.js, or
 * finale-results-fix.js.
 */

(function () {
    "use strict";

    const ORIGINAL_NEXT_EVENT = window.runNextEvent;

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

    function nameOf(p) {
        if (!p) return "Unknown Houseguest";

        if (typeof window.getHouseguestDisplayName === "function") {
            return window.getHouseguestDisplayName(
                p.id,
                players()
            );
        }

        return (
            p.name ||
            `${p.firstName || ""} ${p.lastName || ""}`.trim() ||
            "Unknown Houseguest"
        );
    }

    function escape(value) {
        return typeof window.escapeHTML === "function"
            ? window.escapeHTML(String(value ?? ""))
            : String(value ?? "");
    }

    function portrait(player, size) {
        if (!player || typeof window.simulationPortrait !== "function") {
            return "";
        }

        return window.simulationPortrait(
            player,
            size || "small"
        );
    }

    /*
     * THE ONE SOURCE OF TRUTH FOR THE JURY.
     *
     * Jury Size 9:
     *   3rd, 4th, 5th, 6th, 7th, 8th, 9th, 10th, 11th
     */
    function getCorrectJury() {
        const size = Math.max(
            0,
            Number(season()?.rules?.jurySize ?? 7)
        );

        if (size === 0) {
            return [];
        }

        const maxPlacement = 2 + size;

        return players()
            .filter(player => {
                const placement =
                    Number(player.placement);

                return (
                    player.status === "evicted" &&
                    Number.isFinite(placement) &&
                    placement >= 3 &&
                    placement <= maxPlacement
                );
            })
            .sort(
                (a, b) =>
                    Number(a.placement) -
                    Number(b.placement)
            )
            .slice(0, size);
    }

    function activeFinalists() {
        const s = simulation();

        if (!s) return [];

        if (Array.isArray(s.finalists)) {
            const found = s.finalists
                .map(byId)
                .filter(Boolean);

            if (found.length === 2) {
                return found;
            }
        }

        return players()
            .filter(
                p =>
                    p.status !== "evicted" &&
                    p.status !== "winner" &&
                    p.status !== "runner-up"
            )
            .slice(0, 2);
    }

    function calculateCorrectVotes() {
        const s = simulation();

        if (!s) {
            return {
                jury: [],
                finalists: [],
                votes: [],
                counts: {}
            };
        }

        const jury = getCorrectJury();
        const finalists = activeFinalists();

        const counts = {};

        finalists.forEach(
            finalist => {
                counts[finalist.id] = 0;
            }
        );

        /*
         * Preserve already-recorded votes for jurors who remain
         * eligible. This prevents unnecessary re-randomization.
         */
        const oldVotes = Array.isArray(s.juryVotes)
            ? s.juryVotes
            : [];

        const votes = [];

        jury.forEach(juror => {
            let existing = oldVotes.find(
                vote =>
                    String(
                        vote.juror ??
                        vote.jurorId ??
                        vote.voter ??
                        vote.voterId
                    ) === String(juror.id)
            );

            let target =
                existing
                    ? byId(
                        existing.vote ??
                        existing.target ??
                        existing.targetId ??
                        existing.voteFor ??
                        existing.votedFor
                    )
                    : null;

            /*
             * If the newly eligible 3rd-place juror has no old vote,
             * generate a deterministic-enough vote using the finalists'
             * ratings and relationship strength.
             */
            if (
                !target ||
                !finalists.some(
                    finalist =>
                        finalist.id === target.id
                )
            ) {
                const ranked = finalists
                    .map(finalist => {
                        const bond =
                            typeof window.allianceBond === "function"
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
                            ) * 0.40 +
                            Number(
                                finalist.ratings?.strategic || 0
                            ) * 0.35 +
                            Number(
                                finalist.ratings?.general || 0
                            ) * 0.15 +
                            Number(
                                finalist.ratings?.mental || 0
                            ) * 0.10 +
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

                target =
                    ranked[0]?.finalist ||
                    finalists[0] ||
                    null;
            }

            if (target) {
                const vote = {
                    juror: juror.id,
                    vote: target.id
                };

                votes.push(vote);

                counts[target.id] =
                    Number(counts[target.id] || 0) + 1;
            }
        });

        /*
         * THIS IS THE IMPORTANT PART.
         * The saved simulation jury is forcibly rebuilt from placements.
         */
        s.jury = jury.map(
            juror => juror.id
        );

        s.juryVotes = votes;

        s.finaleVoteResults = {
            votes,
            counts
        };

        return {
            jury,
            finalists,
            votes,
            counts
        };
    }

    function correctPreJury() {
        const s = simulation();

        if (!s) return;

        const size = Math.max(
            0,
            Number(season()?.rules?.jurySize ?? 7)
        );

        const maxPlacement = 2 + size;

        /*
         * Keep a separate convenience list if the simulator uses one.
         */
        s.preJury = players()
            .filter(player => {
                const placement =
                    Number(player.placement);

                return (
                    Number.isFinite(placement) &&
                    placement > maxPlacement
                );
            })
            .sort(
                (a, b) =>
                    Number(b.placement) -
                    Number(a.placement)
            )
            .map(player => player.id);
    }

    function syncJury() {
        const s = simulation();

        if (!s) return;

        const jury = getCorrectJury();

        /*
         * Only activate once a third-place placement actually exists.
         * This prevents the fix from treating ordinary early evictions
         * as jurors before the finale.
         */
        const hasThirdPlace = players().some(
            player =>
                Number(player.placement) === 3
        );

        if (!hasThirdPlace) {
            return;
        }

        calculateCorrectVotes();
        correctPreJury();

        /*
         * Store an explicit boundary for debugging and compatibility.
         */
        s.juryStartPlacement = 3;
        s.juryEndPlacement =
            2 +
            Math.max(
                0,
                Number(
                    season()?.rules?.jurySize ?? 7
                )
            );

        s.jurySizeConfigured =
            Math.max(
                0,
                Number(
                    season()?.rules?.jurySize ?? 7
                )
            );
    }

    function juryHTML() {
        const data =
            calculateCorrectVotes();

        const rows =
            data.jury
                .map(juror => {
                    const vote =
                        data.votes.find(
                            item =>
                                String(item.juror) ===
                                String(juror.id)
                        );

                    const target =
                        vote
                            ? byId(vote.vote)
                            : null;

                    return `
                        <div
                            class="jury-boundary-fix-row"
                            style="
                                display:grid;
                                grid-template-columns:
                                    minmax(160px,1fr)
                                    45px
                                    minmax(160px,1fr);
                                align-items:center;
                                gap:12px;
                                padding:12px;
                                margin:8px 0;
                                border:1px solid rgba(255,255,255,.12);
                                border-radius:10px;
                            "
                        >
                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    align-items:center;
                                    justify-content:center;
                                    gap:5px;
                                    text-align:center;
                                "
                            >
                                ${portrait(juror, "small")}
                                <strong>
                                    ${escape(nameOf(juror))}
                                </strong>
                                <span>
                                    ${escape(
                                        ordinal(
                                            juror.placement
                                        )
                                    )} place
                                </span>
                            </div>

                            <div
                                style="
                                    text-align:center;
                                    font-size:22px;
                                    font-weight:900;
                                "
                            >
                                →
                            </div>

                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    align-items:center;
                                    justify-content:center;
                                    gap:5px;
                                    text-align:center;
                                "
                            >
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
                                            ? escape(
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

        return `
            <div
                class="jury-boundary-fix"
                style="
                    width:min(850px,100%);
                    margin:0 auto;
                    text-align:center;
                "
            >
                <h3>
                    Jury Members & Votes
                </h3>

                <p>
                    ${data.jury.length}
                    eligible juror${
                        data.jury.length === 1
                            ? ""
                            : "s"
                    }.
                </p>

                <div>
                    ${
                        rows ||
                        "<p>No eligible jury members were recorded.</p>"
                    }
                </div>
            </div>
        `;
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

    function updateCurrentJuryDisplay() {
        const s = simulation();

        if (!s) return;

        /*
         * Update the most recent jury-voting history item if one exists.
         */
        if (Array.isArray(s.history)) {
            const item =
                s.history
                    .slice()
                    .reverse()
                    .find(
                        entry =>
                            entry.event ===
                                "jury-voting" ||
                            entry.label ===
                                "Jury Voting" ||
                            entry.type ===
                                "JURY VOTING"
                    );

            if (item) {
                const finalists =
                    activeFinalists();

                item.content = `
                    <div style="text-align:center;">
                        ${
                            typeof window.simulationPortraits ===
                            "function"
                                ? window.simulationPortraits(
                                    finalists.map(
                                        p => p.id
                                    ),
                                    "large"
                                )
                                : ""
                        }

                        <h3>
                            The Jury Votes
                        </h3>

                        ${juryHTML()}

                        <p>
                            Press
                            <strong>
                                Proceed
                            </strong>
                            to reveal the Final Results.
                        </p>
                    </div>
                `;
            }
        }
    }

    function save() {
        if (
            typeof window.persistCurrentSeason ===
            "function"
        ) {
            window.persistCurrentSeason();
        }
    }

    /*
     * Wrap the already-loaded finale controller.
     *
     * We deliberately call the existing engine first so we do not disturb
     * its Final 3 -> Final 2 flow. Then we correct the jury immediately
     * after it records the Final 3 eviction.
     */
    window.runNextEvent = function () {
        if (
            typeof ORIGINAL_NEXT_EVENT !==
            "function"
        ) {
            return;
        }

        ORIGINAL_NEXT_EVENT();

        const s = simulation();

        if (!s) return;

        const finale =
            s.currentPhase === "finale" ||
            s.finaleStarted === true;

        if (!finale) return;

        /*
         * If 3rd place now exists, the Final 3 eviction has occurred.
         * Correct the jury immediately.
         */
        const thirdPlaceExists =
            players().some(
                player =>
                    Number(player.placement) === 3
            );

        if (thirdPlaceExists) {
            syncJury();
            updateCurrentJuryDisplay();
            save();
        }
    };

    /*
     * Expose diagnostic helpers. These do not interfere with the simulator.
     */
    window.getCorrectJury = getCorrectJury;
    window.syncCorrectJury = function () {
        syncJury();
        updateCurrentJuryDisplay();
        save();
        return getCorrectJury().map(
            player => ({
                name: nameOf(player),
                placement: Number(
                    player.placement
                ),
                id: player.id
            })
        );
    };

    console.log(
        "FINAL JURY BOUNDARY FIX loaded: Jury begins at 3rd place."
    );
})();
