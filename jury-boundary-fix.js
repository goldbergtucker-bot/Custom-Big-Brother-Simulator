/*
 * BIG BROTHER SIMULATOR — AUTHORITATIVE FINALE JURY FIX v2
 *
 * LOAD THIS FILE LAST.
 *
 * REQUIRED RULE:
 *   Jury Size 9 = 3rd through 11th place.
 *   1st/2nd = finalists.
 *   12th+ = pre-jury.
 *
 * This patch is intentionally authoritative. The existing finale-controller.js
 * contains private jury functions that cannot be overridden from outside, so
 * this file takes control of the saved jury/votes and the Final 3 -> Final 2
 * -> Jury -> Results transition after the existing controller runs.
 */

(function () {
    "use strict";

    const ORIGINAL_NEXT_EVENT = window.runNextEvent;
    const ORIGINAL_SHOW_RESULTS = window.showResults;

    function season() {
        return window.currentSeason || null;
    }

    function sim() {
        return season()?.simulation || null;
    }

    function players() {
        return season()?.houseguests || [];
    }

    function byId(id) {
        return players().find(p => String(p.id) === String(id)) || null;
    }

    function activePlayers() {
        return typeof window.getActiveHouseguests === "function"
            ? window.getActiveHouseguests()
            : players().filter(p =>
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
        return p.name ||
            `${p.firstName || ""} ${p.lastName || ""}`.trim() ||
            "Unknown Houseguest";
    }

    function esc(v) {
        return typeof window.escapeHTML === "function"
            ? window.escapeHTML(String(v ?? ""))
            : String(v ?? "");
    }

    function portrait(p, size) {
        return p && typeof window.simulationPortrait === "function"
            ? window.simulationPortrait(p, size || "small")
            : "";
    }

    function save() {
        if (typeof window.persistCurrentSeason === "function") {
            window.persistCurrentSeason();
        }
    }

    function jurySize() {
        return Math.max(
            0,
            Number(season()?.rules?.jurySize ?? 7)
        );
    }

    /*
     * THE AUTHORITATIVE JURY BOUNDARY.
     *
     * Jury size N means:
     *   3rd through (2 + N)th place.
     *
     * Example:
     *   N = 9 -> 3rd through 11th.
     */
    function correctJury() {
        const size = jurySize();
        if (!size) return [];

        const minPlacement = 3;
        const maxPlacement = 2 + size;

        return players()
            .filter(p => {
                const placement = Number(p.placement);
                return (
                    p.status === "evicted" &&
                    Number.isFinite(placement) &&
                    placement >= minPlacement &&
                    placement <= maxPlacement
                );
            })
            .sort(
                (a, b) =>
                    Number(a.placement) - Number(b.placement)
            )
            .slice(0, size);
    }

    function finalists() {
        const s = sim();
        if (!s) return [];

        if (Array.isArray(s.finalists)) {
            const found = s.finalists
                .map(byId)
                .filter(Boolean);

            if (found.length === 2) return found;
        }

        return players()
            .filter(p =>
                p.status !== "evicted" &&
                p.status !== "winner" &&
                p.status !== "runner-up"
            )
            .slice(0, 2);
    }

    function targetFromVote(vote) {
        if (!vote) return null;
        return byId(
            vote.vote ??
            vote.target ??
            vote.targetId ??
            vote.voteFor ??
            vote.votedFor
        );
    }

    function scoreVote(juror, finalist) {
        const bond =
            typeof window.allianceBond === "function"
                ? Number(
                    window.allianceBond(juror.id, finalist.id) || 0
                )
                : 0;

        return (
            Number(finalist.ratings?.social || 0) * 0.40 +
            Number(finalist.ratings?.strategic || 0) * 0.35 +
            Number(finalist.ratings?.general || 0) * 0.15 +
            Number(finalist.ratings?.mental || 0) * 0.10 +
            bond * 0.15 +
            Math.random() * 3
        );
    }

    /*
     * Rebuild the stored jury and votes.
     *
     * Crucially, old votes from 12th+ are discarded. Existing votes for
     * legitimate jurors are preserved. A newly eligible 3rd-place juror gets
     * a new vote if one does not already exist.
     */
    function syncJury() {
        const s = sim();
        if (!s) {
            return {
                jury: [],
                finalists: [],
                votes: [],
                counts: {}
            };
        }

        const jury = correctJury();
        const finalTwo = finalists();

        const oldVotes = Array.isArray(s.juryVotes)
            ? s.juryVotes
            : [];

        const votes = [];

        jury.forEach(juror => {
            const old = oldVotes.find(v =>
                String(
                    v.juror ??
                    v.jurorId ??
                    v.voter ??
                    v.voterId
                ) === String(juror.id)
            );

            let target = targetFromVote(old);

            if (
                !target ||
                !finalTwo.some(f => String(f.id) === String(target.id))
            ) {
                const ranked = finalTwo
                    .map(f => ({
                        finalist: f,
                        score: scoreVote(juror, f)
                    }))
                    .sort((a, b) => b.score - a.score);

                target =
                    ranked[0]?.finalist ||
                    finalTwo[0] ||
                    null;
            }

            if (target) {
                votes.push({
                    juror: juror.id,
                    vote: target.id
                });
            }
        });

        const counts = {};
        finalTwo.forEach(f => {
            counts[f.id] = 0;
        });

        votes.forEach(v => {
            if (Object.prototype.hasOwnProperty.call(counts, v.vote)) {
                counts[v.vote]++;
            }
        });

        s.jury = jury.map(j => j.id);
        s.juryVotes = votes;
        s.finaleVoteResults = {
            votes,
            counts
        };

        s.juryStartPlacement = 3;
        s.juryEndPlacement = 2 + jurySize();
        s.jurySizeConfigured = jurySize();

        s.preJury = players()
            .filter(p => {
                const placement = Number(p.placement);
                return (
                    Number.isFinite(placement) &&
                    placement > 2 + jurySize()
                );
            })
            .sort(
                (a, b) =>
                    Number(b.placement) - Number(a.placement)
            )
            .map(p => p.id);

        return {
            jury,
            finalists: finalTwo,
            votes,
            counts
        };
    }

    function ordinal(n) {
        const x = Number(n);
        if (!Number.isFinite(x)) return "";
        const mod100 = x % 100;
        if (mod100 >= 11 && mod100 <= 13) return `${x}th`;
        const mod10 = x % 10;
        if (mod10 === 1) return `${x}st`;
        if (mod10 === 2) return `${x}nd`;
        if (mod10 === 3) return `${x}rd`;
        return `${x}th`;
    }

    function juryHTML(data) {
        const rows = data.jury.map(juror => {
            const vote = data.votes.find(
                v => String(v.juror) === String(juror.id)
            );
            const target = targetFromVote(vote);

            return `
                <div style="
                    display:grid;
                    grid-template-columns:minmax(160px,1fr) 45px minmax(160px,1fr);
                    align-items:center;
                    gap:12px;
                    padding:12px;
                    margin:8px 0;
                    border:1px solid rgba(255,255,255,.12);
                    border-radius:10px;
                    text-align:center;
                ">
                    <div style="
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        gap:5px;
                    ">
                        ${portrait(juror, "small")}
                        <strong>${esc(nameOf(juror))}</strong>
                        <span>${esc(ordinal(juror.placement))} place</span>
                    </div>

                    <div style="font-size:22px;font-weight:900;">→</div>

                    <div style="
                        display:flex;
                        flex-direction:column;
                        align-items:center;
                        justify-content:center;
                        gap:5px;
                    ">
                        ${target ? portrait(target, "small") : ""}
                        <strong>${target ? esc(nameOf(target)) : "No vote recorded"}</strong>
                    </div>
                </div>
            `;
        }).join("");

        return `
            <div style="width:min(850px,100%);margin:0 auto;text-align:center;">
                <h3>Jury Members & Votes</h3>
                <p>
                    ${data.jury.length}
                    eligible juror${data.jury.length === 1 ? "" : "s"}.
                    Jury begins at 3rd place.
                </p>
                ${rows || "<p>No eligible jury members were recorded.</p>"}
            </div>
        `;
    }

    function showCorrectJuryVoting() {
        const s = sim();
        if (!s || typeof window.showEvent !== "function") return;

        const data = syncJury();

        window.showEvent(
            "Jury Voting",
            "JURY VOTING",
            `
                <div style="text-align:center;">
                    ${typeof window.simulationPortraits === "function"
                        ? window.simulationPortraits(
                            data.finalists.map(p => p.id),
                            "large"
                        )
                        : ""}
                    <h3>The Jury Votes</h3>
                    ${juryHTML(data)}
                    <p>
                        Press <strong>Proceed</strong> to reveal the Final Results.
                    </p>
                </div>
            `,
            {
                week: s.currentWeek,
                skipHistory: true,
                skipLiveView: false
            }
        );

        save();
    }

    function calculateWinner() {
        const s = sim();
        const data = syncJury();
        const finalTwo = data.finalists.slice();

        if (!finalTwo.length) {
            return {
                ...data,
                winner: null,
                runner: null
            };
        }

        const ranked = finalTwo
            .slice()
            .sort((a, b) => {
                const diff =
                    Number(data.counts[b.id] || 0) -
                    Number(data.counts[a.id] || 0);

                if (diff) return diff;

                return (
                    Number(b.ratings?.social || 0) -
                    Number(a.ratings?.social || 0)
                );
            });

        const winner = ranked[0] || null;
        const runner = ranked[1] || null;

        if (s) {
            if (winner) {
                s.winner = winner.id;
                winner.status = "winner";
                winner.placement = 1;
            }

            if (runner) {
                s.runnerUp = runner.id;
                runner.status = "runner-up";
                runner.placement = 2;
            }

            s.finalists = finalTwo.map(p => p.id);
            s.jury = data.jury.map(p => p.id);
            s.juryVotes = data.votes;
            s.finaleVoteResults = {
                votes: data.votes,
                counts: data.counts
            };
        }

        return {
            ...data,
            winner,
            runner
        };
    }

    function allPlacements() {
        const map = new Map();

        players().forEach(p => {
            const place = Number(p.placement);
            if (Number.isFinite(place) && place > 0) {
                map.set(p.id, {
                    player: p,
                    placement: place
                });
            }
        });

        return [...map.values()]
            .sort((a, b) => a.placement - b.placement);
    }

    function renderResultsPage() {
        const s = sim();
        const ss = season();
        if (!s || !ss) return;

        const data = calculateWinner();

        s.completed = true;
        s.currentPhase = "complete";
        s.currentEventIndex = 5;

        const winnerName =
            data.winner ? nameOf(data.winner) : "—";
        const runnerName =
            data.runner ? nameOf(data.runner) : "—";

        const seasonBox =
            document.getElementById("results-season-name");
        const winnerBox =
            document.getElementById("winner-name");
        const runnerBox =
            document.getElementById("runner-up-name");

        if (seasonBox) seasonBox.textContent = ss.name || "Big Brother";
        if (winnerBox) winnerBox.textContent = winnerName;
        if (runnerBox) runnerBox.textContent = runnerName;

        const placementsBox =
            document.getElementById("final-placements");

        if (placementsBox) {
            placementsBox.innerHTML = `
                <div style="
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
                    gap:14px;
                    max-width:1000px;
                    margin:0 auto;
                ">
                    ${allPlacements().map(x => `
                        <div style="
                            text-align:center;
                            padding:14px;
                            border:1px solid rgba(255,255,255,.10);
                            border-radius:12px;
                        ">
                            <strong>${esc(ordinal(x.placement))} place</strong>
                            ${portrait(x.player, "medium")}
                            <div><strong>${esc(nameOf(x.player))}</strong></div>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        const juryBox =
            document.getElementById("final-jury-results");

        if (juryBox) {
            juryBox.innerHTML = `
                <h3>Final Vote Count</h3>
                <div style="
                    width:min(560px,100%);
                    margin:0 auto 28px;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:10px;
                    overflow:hidden;
                ">
                    ${data.finalists.map(f => `
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            gap:20px;
                            padding:12px 15px;
                            border-bottom:1px solid rgba(255,255,255,.09);
                        ">
                            <span>${esc(nameOf(f))}</span>
                            <strong>
                                ${Number(data.counts[f.id] || 0)}
                                vote${Number(data.counts[f.id] || 0) === 1 ? "" : "s"}
                            </strong>
                        </div>
                    `).join("")}
                </div>

                ${juryHTML(data)}

                <section style="margin-top:32px;">
                    <h3>Pre-Jury Houseguests</h3>
                    <p>These Houseguests did not vote.</p>
                    <div style="
                        display:grid;
                        grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
                        gap:12px;
                    ">
                        ${players()
                            .filter(p => {
                                const place = Number(p.placement);
                                return Number.isFinite(place) &&
                                    place > 2 + jurySize();
                            })
                            .sort((a,b) =>
                                Number(b.placement) - Number(a.placement)
                            )
                            .map(p => `
                                <div style="text-align:center;">
                                    ${portrait(p, "small")}
                                    <strong>${esc(nameOf(p))}</strong>
                                    <div>${esc(ordinal(p.placement))} place</div>
                                </div>
                            `).join("")}
                    </div>
                </section>
            `;
        }

        if (typeof window.renderSeasonStatistics === "function") {
            window.renderSeasonStatistics();
        }

        if (typeof window.showPage === "function") {
            window.showPage("results-page");
        }

        save();
    }

    /*
     * Expose diagnostics and the authoritative data source.
     */
    window.getCorrectJury = correctJury;
    window.syncCorrectJury = function () {
        const data = syncJury();
        save();

        return data.jury.map(p => ({
            id: p.id,
            name: nameOf(p),
            placement: Number(p.placement)
        }));
    };

    /*
     * AUTHORITATIVE Proceed handler.
     *
     * We let the existing controller handle normal events.
     * Once the Final 3 exists, this patch owns the remaining finale steps.
     */
    window.runNextEvent = function () {
        const s = sim();

        if (!s) return;

        const hasThird =
            players().some(p => Number(p.placement) === 3);

        /*
         * If the existing controller has just created 3rd place, immediately
         * replace its old 4th+ jury with the correct 3rd+ jury.
         */
        if (hasThird) {
            syncJury();
        }

        /*
         * If the Final 3 eviction reveal is pending, consume it here and show
         * the corrected jury screen instead of allowing the old controller to
         * reuse its stale jury HTML.
         */
        if (s.finalEvictionReveal && hasThird) {
            s.finalEvictionReveal = null;
            s.currentEventIndex = 4;
            showCorrectJuryVoting();
            return;
        }

        /*
         * At Final 3, let the existing controller perform the actual Final 3
         * eviction. The next click is handled by the branch above.
         */
        const finale =
            s.currentPhase === "finale" ||
            s.finaleStarted === true;

        if (
            finale &&
            Number(s.currentEventIndex || 0) === 3 &&
            activePlayers().length === 3
        ) {
            if (typeof ORIGINAL_NEXT_EVENT === "function") {
                ORIGINAL_NEXT_EVENT();
            }
            return;
        }

        /*
         * Final Results: do NOT call the old controller because its private
         * juryMembers() still uses 4th+ and would overwrite the correct vote
         * count. Resolve the result entirely from our authoritative jury.
         */
        if (
            finale &&
            Number(s.currentEventIndex || 0) >= 4
        ) {
            renderResultsPage();
            return;
        }

        if (typeof ORIGINAL_NEXT_EVENT === "function") {
            ORIGINAL_NEXT_EVENT();
        }
    };

    /*
     * If anything calls showResults directly, it must also use the correct
     * jury instead of the old private 4th+ function.
     */
    window.showResults = renderResultsPage;

    /*
     * Keep the saved state clean after page load as well. This only changes
     * the jury after a real 3rd-place placement exists.
     */
    function lateRepair() {
        const s = sim();
        if (!s) return;

        if (players().some(p => Number(p.placement) === 3)) {
            syncJury();
            save();
        }
    }

    setTimeout(lateRepair, 0);
    setTimeout(lateRepair, 250);

    console.log(
        "AUTHORITATIVE FINALE JURY FIX v2 loaded — Jury starts at 3rd place."
    );
})();
