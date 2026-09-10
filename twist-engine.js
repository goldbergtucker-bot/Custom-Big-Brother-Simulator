/*
 * BIG BROTHER SIMULATOR — TWIST / EVENT ENGINE OVERRIDE
 *
 * Load AFTER app.js.
 *
 * Fixes:
 * - persistent one-time twist awards
 * - no re-rolls while viewing history
 * - display-only twists never receive a holder
 * - twist powers expire at powerUntil
 * - twist effects consume exactly once
 * - legacy twist/twistWeeks data is normalized
 * - safety competition is actually inserted into the event chain
 * - re-simulation resets player state and simulation state
 *
 * This intentionally overrides the unstable duplicate implementations
 * at the end of the existing app.js without replacing the rest of the
 * simulator engine.
 */

(function () {
    "use strict";

    const EFFECT_LABELS = {
        display: "Display / Story Only",
        nominationVoid: "Nomination Void",
        diamondPOV: "Diamond POV Upgrade",
        haltingHex: "Halting Hex",
        immunity: "Immunity / Safety"
    };

    const EFFECT_TYPES = new Set(Object.keys(EFFECT_LABELS));

    function clone(value) {
        if (typeof deepClone === "function") return deepClone(value);
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function seasonLength() {
        return Math.max(
            1,
            Math.min(30, Number(currentSeason?.rules?.seasonWeeks || 30))
        );
    }

    function normalizeTwist(raw, fallbackWeek = 1) {
        const t = raw && typeof raw === "object" ? raw : {};

        const start = Math.max(
            1,
            Math.min(
                seasonLength(),
                Number(t.startWeek || t.week || fallbackWeek) || fallbackWeek
            )
        );

        const end = Math.max(
            start,
            Math.min(
                seasonLength(),
                Number(t.endWeek || start) || start
            )
        );

        const powerUntil = Math.max(
            start,
            Math.min(
                seasonLength(),
                Number(t.powerUntil || end) || end
            )
        );

        return {
            ...clone(t),
            id: t.id || uid("twist"),
            name: String(t.name || "Untitled Twist").trim(),
            startWeek: start,
            endWeek: end,
            week: start,
            power: String(t.power || "").trim(),
            effectType: EFFECT_TYPES.has(t.effectType)
                ? t.effectType
                : "display",
            powerUntil,
            description: String(t.description || "").trim(),
            timing:
                start === end
                    ? `week${start}`
                    : `weeks${start}-${end}`,
            active: t.active !== false,

            // Existing twists are one-time. A saved twist may explicitly
            // set repeatable:true if repeat behavior is desired later.
            repeatable: t.repeatable === true
        };
    }

    function ensureTwistData() {
        if (!currentSeason) return [];

        if (!Array.isArray(currentSeason.twists)) {
            currentSeason.twists = [];
        }

        if (
            !currentSeason.twistWeeks ||
            typeof currentSeason.twistWeeks !== "object"
        ) {
            currentSeason.twistWeeks = {};
        }

        const source = currentSeason.twists.length
            ? currentSeason.twists
            : Object.values(currentSeason.twistWeeks).flat();

        const byId = new Map();

        source.forEach(raw => {
            if (!raw) return;

            const normalized = normalizeTwist(
                raw,
                raw.week || 1
            );

            if (!byId.has(normalized.id)) {
                byId.set(normalized.id, normalized);
            }
        });

        currentSeason.twists = [...byId.values()];

        const rebuiltWeeks = {};

        currentSeason.twists.forEach(twist => {
            for (
                let week = twist.startWeek;
                week <= twist.endWeek;
                week++
            ) {
                (rebuiltWeeks[String(week)] ||= []).push({
                    ...clone(twist),
                    week
                });
            }
        });

        currentSeason.twistWeeks = rebuiltWeeks;

        return currentSeason.twists;
    }

    function ensureSimState() {
        if (!currentSeason) return null;

        if (!currentSeason.simulation) {
            currentSeason.simulation =
                typeof createDefaultSimulation === "function"
                    ? createDefaultSimulation()
                    : {};
        }

        const sim = currentSeason.simulation;

        if (!Array.isArray(sim.history)) sim.history = [];

        if (
            !sim.twistState ||
            typeof sim.twistState !== "object"
        ) {
            sim.twistState = {};
        }

        if (!Array.isArray(sim.lastVetoDrawnIds)) {
            sim.lastVetoDrawnIds = [];
        }

        if (
            !sim.vetoDrawCounts ||
            typeof sim.vetoDrawCounts !== "object"
        ) {
            sim.vetoDrawCounts = {};
        }

        if (typeof sim.isViewingHistory !== "boolean") {
            sim.isViewingHistory = false;
        }

        if (!sim.liveView || typeof sim.liveView !== "object") {
            sim.liveView = null;
        }

        return sim;
    }

    function activeTwistsForWeek(week) {
        const w = Number(week || 1);

        return ensureTwistData().filter(twist => {
            if (!twist.active) return false;

            return (
                w >= twist.startWeek &&
                w <= twist.endWeek
            );
        });
    }

    function twistWasShown(sim, twist, week) {
        const state = sim.twistState[twist.id];

        if (!state) return false;

        if (twist.repeatable) {
            return (
                Number(state.lastShownWeek) ===
                Number(week)
            );
        }

        return state.eventShown === true;
    }

    function getScheduledTwistsForWeekFixed(week) {
        const sim = ensureSimState();

        if (!sim) return [];

        return activeTwistsForWeek(week).filter(twist => {
            return !twistWasShown(
                sim,
                twist,
                week
            );
        });
    }

    function getUsableTwistStatesFixed(
        week,
        effectType
    ) {
        const sim = ensureSimState();

        if (!sim) return [];

        const w = Number(
            week ||
            sim.currentWeek ||
            1
        );

        return ensureTwistData()
            .map(twist => ({
                twist,
                state: sim.twistState[twist.id]
            }))
            .filter(({ twist, state }) => {
                if (!state || !state.holderId) return false;
                if (state.used) return false;
                if (!twist.active) return false;

                const start = Number(
                    twist.startWeek ||
                    twist.week ||
                    1
                );

                const end = Number(
                    twist.endWeek ||
                    start
                );

                const until = Number(
                    twist.powerUntil ||
                    end
                );

                return (
                    w >= start &&
                    w <= end &&
                    w <= until &&
                    (twist.effectType || "display") ===
                        effectType
                );
            });
    }

    function getTwistById(id) {
        return (
            ensureTwistData().find(
                twist => twist.id === id
            ) || null
        );
    }

    function getOrCreateTwistState(twist) {
        const sim = ensureSimState();

        if (!sim.twistState[twist.id]) {
            sim.twistState[twist.id] = {
                holderId: null,
                used: false,
                awardedWeek: null,
                eventShown: false,
                lastShownWeek: null
            };
        }

        return sim.twistState[twist.id];
    }

    function awardTwistIfNeeded(twist, week) {
        const sim = ensureSimState();
        const state = getOrCreateTwistState(twist);

        /*
         * Display/story twists have no simulator power and therefore
         * never get a random holder.
         */
        if (
            twist.effectType === "display" ||
            !twist.power
        ) {
            return state;
        }

        /*
         * Normal twists are awarded once for the entire simulation.
         */
        if (
            !twist.repeatable &&
            state.holderId
        ) {
            return state;
        }

        /*
         * Explicitly repeatable twists may receive a new holder
         * when they activate in a new week.
         */
        if (
            twist.repeatable &&
            Number(state.lastShownWeek) !==
                Number(week)
        ) {
            state.holderId = null;
            state.used = false;
        }

        if (!state.holderId) {
            const active =
                typeof getActiveHouseguests ===
                "function"
                    ? getActiveHouseguests()
                    : [];

            const holder = active.length
                ? active[
                      Math.floor(
                          Math.random() *
                              active.length
                      )
                  ]
                : null;

            if (holder) {
                state.holderId = holder.id;
                state.awardedWeek =
                    Number(week);
                state.used = false;
            }
        }

        sim.twistState[twist.id] = state;

        return state;
    }

    function runTwistEventFixed(twistId) {
        const sim = ensureSimState();
        const twist = getTwistById(twistId);

        if (!sim) return;

        if (!twist) {
            sim.currentEventIndex =
                Number(
                    sim.currentEventIndex || 0
                ) + 1;

            showEvent(
                "Twist",
                "TWIST",
                "<p>No twist information is available.</p>"
            );

            return;
        }

        const week = Number(
            sim.currentWeek || 1
        );

        const state =
            awardTwistIfNeeded(
                twist,
                week
            );

        /*
         * Mark the twist event as seen before rendering it.
         * This is the important part that prevents history navigation
         * or chain re-rendering from awarding it again.
         */
        state.eventShown = true;
        state.lastShownWeek = week;

        const holder =
            state.holderId &&
            typeof getHouseguestForSimulation ===
                "function"
                ? getHouseguestForSimulation(
                      state.holderId
                  )
                : null;

        const start = Number(
            twist.startWeek ||
            twist.week ||
            1
        );

        const end = Number(
            twist.endWeek ||
            start
        );

        const until = Number(
            twist.powerUntil ||
            end
        );

        const effect =
            twist.effectType ||
            "display";

        const powerLine = twist.power
            ? `
                <p>
                    <strong>Power:</strong>
                    ${escapeHTML(twist.power)}
                    · usable through Week ${until}
                </p>
                <p>
                    <strong>Simulator effect:</strong>
                    ${escapeHTML(
                        EFFECT_LABELS[effect] ||
                        EFFECT_LABELS.display
                    )}
                </p>
              `
            : "";

        const holderBlock = holder
            ? `
                <div class="twist-power-holder">
                    <h3>Power Holder</h3>
                    ${simulationPortrait(
                        holder,
                        "large"
                    )}
                </div>
              `
            : "";

        sim.currentEventIndex =
            Number(
                sim.currentEventIndex || 0
            ) + 1;

        if (
            typeof resetGameChain ===
            "function"
        ) {
            resetGameChain(
                sim.currentEventIndex
            );
        }

        showEvent(
            twist.name,
            "TWIST",
            `
                <div class="twist-event-card">
                    <h3>
                        ${escapeHTML(
                            twist.name
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            twist.description ||
                                "A twist is active this week."
                        )}
                    </p>

                    <p>
                        <strong>Active:</strong>
                        Week ${start}
                        ${
                            end !== start
                                ? ` through Week ${end}`
                                : ""
                        }
                    </p>

                    ${powerLine}

                    ${holderBlock}
                </div>
            `
        );
    }

    function getWeekEventChainFixed(week) {
        const sim = ensureSimState();

        if (!sim) return [];

        if (
            sim.currentPhase ===
                "finale" ||
            sim.finaleStarted
        ) {
            return typeof getFinaleChain ===
                "function"
                ? getFinaleChain()
                : [];
        }

        const w = Number(
            week ||
            sim.currentWeek ||
            1
        );

        const chain = [];

        getScheduledTwistsForWeekFixed(
            w
        ).forEach(twist => {
            chain.push({
                key: "twist",
                label:
                    twist.name ||
                    "Twist",
                twistId: twist.id
            });
        });

        const hoh =
            typeof getCompetitionForWeekType ===
            "function"
                ? getCompetitionForWeekType(
                      w,
                      "hoh"
                  )
                : null;

        chain.push({
            key: "hoh",
            label:
                hoh?.name ||
                "HOH Competition"
        });

        /*
         * Safety is a real event now. If the user enabled the
         * season-wide safety setting but did not create a custom
         * Safety competition, a built-in Safety Competition is used.
         */
        const safetyEnabled =
            currentSeason?.rules
                ?.safetyCompetitionEnabled ===
            true;

        const safetyCompetitions =
            typeof getWeekCompetitions ===
            "function"
                ? getWeekCompetitions(
                      w
                  ).filter(
                      c =>
                          c.type ===
                          "safety"
                  )
                : [];

        if (
            safetyEnabled ||
            safetyCompetitions.length
        ) {
            if (
                safetyCompetitions.length
            ) {
                safetyCompetitions.forEach(
                    comp => {
                        chain.push({
                            key:
                                "custom-competition",
                            label:
                                comp.name ||
                                "Safety Competition",
                            competitionId:
                                comp.id
                        });
                    }
                );
            } else {
                chain.push({
                    key:
                        "built-in-safety",
                    label:
                        "Safety Competition"
                });
            }
        }

        chain.push({
            key: "nominations",
            label:
                "Nomination Ceremony"
        });

        chain.push({
            key: "pov-players",
            label:
                "Veto Selections"
        });

        const pov =
            typeof getCompetitionForWeekType ===
            "function"
                ? getCompetitionForWeekType(
                      w,
                      "pov"
                  )
                : null;

        chain.push({
            key: "pov",
            label:
                pov?.name ||
                "POV Competition"
        });

        chain.push({
            key:
                "veto-ceremony",
            label:
                "Veto Ceremony"
        });

        const otherCompetitions =
            typeof getWeekCompetitions ===
            "function"
                ? getWeekCompetitions(
                      w
                  ).filter(
                      c =>
                          c.type ===
                              "special" ||
                          c.type ===
                              "luxury"
                  )
                : [];

        otherCompetitions.forEach(
            comp => {
                chain.push({
                    key:
                        "custom-competition",
                    label:
                        comp.name ||
                        "Special Competition",
                    competitionId:
                        comp.id
                });
            }
        );

        chain.push(
            {
                key:
                    "eviction-voting",
                label:
                    "Eviction Voting"
            },
            {
                key:
                    "eviction",
                label:
                    "Eviction"
            }
        );

        return chain;
    }

    function runBuiltInSafetyEvent() {
        const sim = ensureSimState();

        const active =
            typeof getActiveHouseguests ===
            "function"
                ? getActiveHouseguests()
                : [];

        if (!active.length) {
            sim.currentEventIndex++;
            return;
        }

        const winner =
            typeof chooseCompetitionWinner ===
            "function"
                ? chooseCompetitionWinner(
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

        sim.currentSafetyWinner =
            winner?.id || null;

        if (winner) {
            winner.safetyWins =
                Number(
                    winner.safetyWins || 0
                ) + 1;
        }

        sim.currentEventIndex++;

        if (
            typeof updateSimulatorStatus ===
            "function"
        ) {
            updateSimulatorStatus(
                sim
            );
        }

        if (
            typeof resetGameChain ===
            "function"
        ) {
            resetGameChain(
                sim.currentEventIndex
            );
        }

        showEvent(
            "Safety Competition",
            "SAFETY COMPETITION",
            `
                ${simulationPortrait(
                    winner,
                    "large"
                )}

                <p>
                    <strong>
                        ${escapeHTML(
                            getHouseguestDisplayName(
                                winner?.id,
                                currentSeason.houseguests
                            )
                        )}
                    </strong>
                    has won the Safety Competition.
                </p>

                <p>
                    This player is safe from
                    this week's nominations.
                </p>
            `
        );
    }

    function runCustomCompetitionEventFixed(
        competitionId
    ) {
        const sim = ensureSimState();

        const players =
            getActiveHouseguests();

        const comp =
            getWeekCompetitions(
                sim.currentWeek
            ).find(
                c =>
                    c.id ===
                    competitionId
            );

        if (
            !comp ||
            !players.length
        ) {
            sim.currentEventIndex++;
            return;
        }

        const winner =
            chooseCompetitionWinnerByCustom(
                players,
                comp
            );

        if (
            comp.type ===
            "safety"
        ) {
            sim.currentSafetyWinner =
                winner?.id || null;

            if (winner) {
                winner.safetyWins =
                    Number(
                        winner.safetyWins ||
                            0
                    ) + 1;
            }
        }

        sim.currentEventIndex++;

        updateSimulatorStatus(
            sim
        );

        resetGameChain(
            sim.currentEventIndex
        );

        showEvent(
            comp.name ||
                "Special Competition",
            comp.type ===
                "safety"
                ? "SAFETY COMPETITION"
                : "SPECIAL COMPETITION",
            `
                ${simulationPortrait(
                    winner,
                    "large"
                )}

                <p>
                    <strong>
                        ${escapeHTML(
                            getHouseguestDisplayName(
                                winner?.id,
                                currentSeason.houseguests
                            )
                        )}
                    </strong>
                    has won
                    <strong>
                        ${escapeHTML(
                            comp.name ||
                                "the competition"
                        )}
                    </strong>.
                </p>

                ${
                    comp.description
                        ? `<p class="event-description">${escapeHTML(
                              comp.description
                          )}</p>`
                        : ""
                }
            `
        );
    }

    function applySafetyProtection(
        eligible,
        week
    ) {
        const sim = ensureSimState();
        const protectedIds =
            new Set();

        if (
            sim.currentSafetyWinner
        ) {
            protectedIds.add(
                sim.currentSafetyWinner
            );
        }

        getUsableTwistStatesFixed(
            week,
            "immunity"
        ).forEach(
            ({ state }) => {
                if (
                    state.holderId
                ) {
                    protectedIds.add(
                        state.holderId
                    );
                }
            }
        );

        return eligible.filter(
            player =>
                !protectedIds.has(
                    player.id
                )
        );
    }

    function runNominationEventFixed() {
        const sim = ensureSimState();

        const active =
            getActiveHouseguests();

        const hohId =
            sim.currentHOH;

        let eligible =
            active.filter(
                p =>
                    p.id !==
                    hohId
            );

        eligible =
            applySafetyProtection(
                eligible,
                Number(
                    sim.currentWeek ||
                        1
                )
            );

        const nomineeCount =
            Math.min(
                Number(
                    currentSeason
                        .rules
                        ?.nomineesPerWeek ||
                        2
                ),
                eligible.length
            );

        let nominees =
            chooseRandomPlayers(
                eligible,
                nomineeCount
            );

        let twistNote = "";

        const voidPower =
            getUsableTwistStatesFixed(
                sim.currentWeek,
                "nominationVoid"
            ).find(
                ({ state }) =>
                    nominees.some(
                        p =>
                            p.id ===
                            state.holderId
                    )
            );

        if (voidPower) {
            const originalIds =
                nominees.map(
                    p => p.id
                );

            voidPower.state.used =
                true;

            const rerollPool =
                eligible.filter(
                    p =>
                        !originalIds.includes(
                            p.id
                        )
                );

            const replacements =
                chooseRandomPlayers(
                    rerollPool,
                    Math.min(
                        nomineeCount,
                        rerollPool.length
                    )
                );

            if (
                replacements.length ===
                nomineeCount
            ) {
                nominees =
                    replacements;
            }

            twistNote = `
                <p class="ceremony-statement">
                    <strong>
                        ${escapeHTML(
                            voidPower.twist.power ||
                                voidPower.twist.name
                        )}
                    </strong>
                    was used. The original
                    nominations were voided.
                </p>
            `;
        }

        sim.currentNominees =
            nominees.map(
                p => p.id
            );

        nominees.forEach(p => {
            p.nominationCount =
                Number(
                    p.nominationCount ||
                        0
                ) + 1;
        });

        sim.currentEventIndex++;

        updateSimulatorStatus(
            sim
        );

        resetGameChain(
            sim.currentEventIndex
        );

        const hohPlayer =
            getHouseguestForSimulation(
                sim.currentHOH
            );

        showEvent(
            "Nomination Ceremony",
            "NOMINATION CEREMONY",
            `
                <div class="ceremony-role-section">
                    <h3>
                        Head of Household
                    </h3>
                    ${simulationPortrait(
                        hohPlayer,
                        "large"
                    )}
                </div>

                ${twistNote}

                <p class="ceremony-statement">
                    <strong>
                        ${escapeHTML(
                            getHouseguestDisplayName(
                                sim.currentHOH,
                                active
                            )
                        )}
                    </strong>
                    has nominated:
                </p>

                <div class="ceremony-role-section">
                    <h3>
                        Nominees
                    </h3>
                    ${simulationPortraits(
                        nominees.map(
                            p => p.id
                        ),
                        "large"
                    )}
                </div>
            `
        );
    }

    function runVetoCeremonyEventFixed() {
        const sim =
            ensureSimState();

        if (
            currentSeason.rules
                ?.vetoEnabled ===
            false
        ) {
            sim.currentEventIndex++;

            resetGameChain(
                sim.currentEventIndex
            );

            showEvent(
                "Veto Ceremony",
                "VETO CEREMONY",
                "<p>The Power of Veto is not enabled for this season.</p>"
            );

            return;
        }

        const vetoWinner =
            sim.currentPOVWinner;

        const originalNominees =
            [
                ...(sim.currentNominees ||
                    [])
            ];

        let vetoUsed = false;
        let replacementId =
            null;

        let diamondNote =
            "";

        if (
            vetoWinner &&
            originalNominees.includes(
                vetoWinner
            )
        ) {
            const remaining =
                getActiveHouseguests().filter(
                    p =>
                        p.id !==
                            sim.currentHOH &&
                        !originalNominees.includes(
                            p.id
                        )
                );

            if (
                remaining.length
            ) {
                const diamond =
                    getUsableTwistStatesFixed(
                        sim.currentWeek,
                        "diamondPOV"
                    ).find(
                        ({ state }) =>
                            state.holderId ===
                            vetoWinner
                    );

                let replacement;

                if (diamond) {
                    replacement =
                        remaining
                            .slice()
                            .sort(
                                (a, b) =>
                                    allianceBond(
                                        vetoWinner,
                                        a.id
                                    ) -
                                    allianceBond(
                                        vetoWinner,
                                        b.id
                                    )
                            )[0] ||
                        randomItem(
                            remaining
                        );

                    diamond.state.used =
                        true;

                    diamondNote = `
                        <p class="ceremony-statement">
                            <strong>
                                ${escapeHTML(
                                    diamond.twist.power ||
                                        diamond.twist.name
                                )}
                            </strong>
                            upgraded the veto to
                            a Diamond POV.
                        </p>
                    `;
                } else {
                    replacement =
                        randomItem(
                            remaining
                        );
                }

                const index =
                    sim.currentNominees.indexOf(
                        vetoWinner
                    );

                if (
                    index >= 0 &&
                    replacement
                ) {
                    sim.currentNominees[
                        index
                    ] =
                        replacement.id;

                    replacementId =
                        replacement.id;

                    vetoUsed =
                        true;
                }
            }
        }

        sim.currentEventIndex++;

        updateSimulatorStatus(
            sim
        );

        resetGameChain(
            sim.currentEventIndex
        );

        showEvent(
            "Veto Ceremony",
            "VETO CEREMONY",
            `
                <div class="ceremony-leaders">

                    <div class="ceremony-role-section">
                        <h3>
                            Head of Household
                        </h3>
                        ${simulationPortrait(
                            getHouseguestForSimulation(
                                sim.currentHOH
                            ),
                            "large"
                        )}
                    </div>

                    <div class="ceremony-role-section">
                        <h3>
                            Power of Veto Holder
                        </h3>
                        ${simulationPortrait(
                            getHouseguestForSimulation(
                                vetoWinner
                            ),
                            "large"
                        )}
                    </div>

                </div>

                ${diamondNote}

                <p class="ceremony-statement">
                    ${
                        vetoUsed
                            ? `
                                <strong>
                                    ${escapeHTML(
                                        getHouseguestDisplayName(
                                            vetoWinner,
                                            currentSeason.houseguests
                                        )
                                    )}
                                </strong>
                                used the Power of Veto.

                                ${
                                    replacementId
                                        ? `
                                            <strong>
                                                ${escapeHTML(
                                                    getHouseguestDisplayName(
                                                        replacementId,
                                                        currentSeason.houseguests
                                                    )
                                                )}
                                            </strong>
                                            was named as the
                                            replacement nominee.
                                          `
                                        : ""
                                }
                              `
                            : vetoWinner
                                ? `
                                    <strong>
                                        ${escapeHTML(
                                            getHouseguestDisplayName(
                                                vetoWinner,
                                                currentSeason.houseguests
                                            )
                                        )}
                                    </strong>
                                    did not use the
                                    Power of Veto.
                                  `
                                : "No Power of Veto holder was available."
                    }
                </p>

                <div class="ceremony-role-section">
                    <h3>
                        Final Nominees
                    </h3>
                    ${simulationPortraits(
                        sim.currentNominees,
                        "large"
                    )}
                </div>
            `
        );
    }

    /*
     * Halting Hex is handled here, then the original eviction engine is
     * allowed to handle ordinary evictions. This prevents unrelated
     * eviction logic from being rewritten.
     */
    const legacyEvictionEvent =
        window.runEvictionEvent;

    function runEvictionEventFixed() {
        const sim =
            ensureSimState();

        const nominees =
            sim.currentNominees ||
            [];

        const week =
            Number(
                sim.currentWeek ||
                    1
            );

        const hex =
            getUsableTwistStatesFixed(
                week,
                "haltingHex"
            ).find(
                ({ state }) =>
                    nominees.includes(
                        state.holderId
                    )
            );

        if (hex) {
            hex.state.used =
                true;

            sim.currentEventIndex =
                getWeekEventChainFixed(
                    week
                ).length;

            sim.pendingEvictionId =
                null;

            sim.evictionVoteResult =
                null;

            sim.pendingWeekAdvance =
                true;

            sim.pendingCycle =
                "nextWeek";

            resetGameChain(
                sim.currentEventIndex
            );

            const holder =
                getHouseguestForSimulation(
                    hex.state.holderId
                );

            showEvent(
                "Halting Hex",
                "EVICTION HALTED",
                `
                    ${simulationPortrait(
                        holder,
                        "large"
                    )}

                    <p>
                        <strong>
                            ${escapeHTML(
                                hex.twist.power ||
                                    hex.twist.name
                            )}
                        </strong>
                        has been used.
                    </p>

                    <p>
                        The Week ${week}
                        eviction is cancelled.
                        Nobody is evicted.
                    </p>

                    <p>
                        Press
                        <strong>
                            Proceed
                        </strong>
                        to begin the next week.
                    </p>
                `
            );

            return;
        }

        if (
            typeof legacyEvictionEvent ===
            "function"
        ) {
            return legacyEvictionEvent();
        }
    }

    function saveTwistFixed() {
        const s =
            getAdvancedArrays();

        if (!Array.isArray(s.twists)) {
            s.twists = [];
        }

        if (
            !s.twistWeeks ||
            typeof s.twistWeeks !==
                "object"
        ) {
            s.twistWeeks = {};
        }

        const name =
            getInputValue(
                "twist-name"
            ).trim();

        if (!name) {
            alert(
                "Please enter a twist name."
            );
            return;
        }

        const maxWeeks =
            seasonLength();

        const startWeek =
            Math.min(
                maxWeeks,
                Math.max(
                    1,
                    getWeekNumber(
                        getValue(
                            "twist-start-week"
                        ) || 1
                    )
                )
            );

        const endWeek =
            Math.max(
                startWeek,
                Math.min(
                    maxWeeks,
                    getWeekNumber(
                        getValue(
                            "twist-end-week"
                        ) ||
                            startWeek
                    )
                )
            );

        const powerUntil =
            Math.max(
                startWeek,
                Math.min(
                    maxWeeks,
                    getWeekNumber(
                        getValue(
                            "twist-power-until"
                        ) ||
                            endWeek
                    )
                )
            );

        const obj =
            normalizeTwist({
                id:
                    editingTwistId ||
                    uid("twist"),

                name,

                startWeek,

                endWeek,

                week: startWeek,

                power:
                    getInputValue(
                        "twist-power"
                    ).trim(),

                effectType:
                    getValue(
                        "twist-effect-type"
                    ) ||
                    "display",

                powerUntil,

                description:
                    getInputValue(
                        "twist-description"
                    ).trim(),

                timing:
                    startWeek ===
                    endWeek
                        ? `week${startWeek}`
                        : `weeks${startWeek}-${endWeek}`,

                active:
                    getChecked(
                        "twist-active"
                    )
            });

        const index =
            s.twists.findIndex(
                t =>
                    t.id ===
                    obj.id
            );

        if (index >= 0) {
            s.twists[index] =
                obj;
        } else {
            s.twists.push(
                obj
            );
        }

        ensureTwistData();

        editingTwistId =
            null;

        resetTwistEditorFixed();
        renderTwistsFixed();

        if (
            typeof persistCurrentSeasonIfSaved ===
            "function"
        ) {
            persistCurrentSeasonIfSaved();
        }
    }

    function resetTwistEditorFixed() {
        editingTwistId =
            null;

        setValue(
            "twist-name",
            ""
        );

        setValue(
            "twist-start-week",
            "1"
        );

        setValue(
            "twist-end-week",
            "1"
        );

        setValue(
            "twist-power",
            ""
        );

        setValue(
            "twist-effect-type",
            "display"
        );

        setValue(
            "twist-power-until",
            "1"
        );

        setValue(
            "twist-description",
            ""
        );

        setChecked(
            "twist-active",
            true
        );

        setText(
            "twist-form-title",
            "Create Twist"
        );

        setText(
            "save-twist-btn",
            "Add Twist"
        );
    }

    function editTwistFixed(id) {
        const twist =
            getTwistById(id);

        if (!twist) return;

        editingTwistId =
            id;

        setValue(
            "twist-name",
            twist.name
        );

        setValue(
            "twist-start-week",
            twist.startWeek
        );

        setValue(
            "twist-end-week",
            twist.endWeek
        );

        setValue(
            "twist-power",
            twist.power ||
                ""
        );

        setValue(
            "twist-effect-type",
            twist.effectType ||
                "display"
        );

        setValue(
            "twist-power-until",
            twist.powerUntil ||
                twist.endWeek
        );

        setValue(
            "twist-description",
            twist.description ||
                ""
        );

        setChecked(
            "twist-active",
            twist.active !==
                false
        );

        setText(
            "twist-form-title",
            "Edit Twist"
        );

        setText(
            "save-twist-btn",
            "Save Twist"
        );

        document
            .getElementById(
                "twist-name"
            )
            ?.scrollIntoView({
                behavior:
                    "smooth",
                block:
                    "center"
            });
    }

    function deleteTwistFixed(id) {
        if (
            !confirm(
                "Delete this twist?"
            )
        ) {
            return;
        }

        currentSeason.twists =
            (
                currentSeason.twists ||
                []
            ).filter(
                t =>
                    t.id !==
                    id
            );

        ensureTwistData();

        const sim =
            ensureSimState();

        if (
            sim?.twistState
        ) {
            delete sim.twistState[
                id
            ];
        }

        renderTwistsFixed();

        if (
            typeof persistCurrentSeasonIfSaved ===
            "function"
        ) {
            persistCurrentSeasonIfSaved();
        }
    }

    function renderTwistsFixed() {
        const container =
            document.getElementById(
                "twists-container"
            );

        if (!container)
            return;

        const twists =
            ensureTwistData()
                .slice()
                .sort(
                    (a, b) =>
                        a.startWeek -
                        b.startWeek
                );

        if (!twists.length) {
            container.innerHTML =
                '<div class="empty-state"><p>No weekly twists created yet. Add a twist above if applicable.</p></div>';

            return;
        }

        container.innerHTML =
            twists
                .map(
                    twist => {
                        const range =
                            twist.startWeek ===
                            twist.endWeek
                                ? `Week ${twist.startWeek}`
                                : `Weeks ${twist.startWeek}–${twist.endWeek}`;

                        const effect =
                            EFFECT_LABELS[
                                twist.effectType ||
                                    "display"
                            ] ||
                            EFFECT_LABELS.display;

                        return `
                            <div class="week-editor-card">

                                <div class="week-editor-header">

                                    <div>
                                        <span class="section-label">
                                            ${escapeHTML(
                                                range.toUpperCase()
                                            )}
                                        </span>

                                        <h4>
                                            ${escapeHTML(
                                                twist.name
                                            )}
                                        </h4>
                                    </div>

                                    <span class="feature-status">
                                        ${
                                            twist.active ===
                                            false
                                                ? "Inactive"
                                                : "Active"
                                        }
                                    </span>

                                </div>

                                <div class="week-item-list">

                                    <div class="week-item">

                                        <div>

                                            <p>
                                                ${escapeHTML(
                                                    twist.description ||
                                                        "No description."
                                                )}
                                            </p>

                                            <small>
                                                <strong>
                                                    Active period:
                                                </strong>
                                                ${escapeHTML(
                                                    range
                                                )}
                                            </small>

                                            <small>
                                                <strong>
                                                    Simulator effect:
                                                </strong>
                                                ${escapeHTML(
                                                    effect
                                                )}
                                            </small>

                                            ${
                                                twist.power
                                                    ? `
                                                        <small>
                                                            <strong>
                                                                Power:
                                                            </strong>
                                                            ${escapeHTML(
                                                                twist.power
                                                            )}
                                                            · Usable through
                                                            Week
                                                            ${twist.powerUntil}
                                                        </small>
                                                      `
                                                    : ""
                                            }

                                        </div>

                                        <div class="advanced-card-actions">

                                            <button
                                                type="button"
                                                onclick="editTwist('${escapeAttribute(
                                                    twist.id
                                                )}')"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                onclick="deleteTwist('${escapeAttribute(
                                                    twist.id
                                                )}')"
                                            >
                                                Delete
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");
    }

    function loadTwistsFixed(data) {
        const s =
            getAdvancedArrays();

        const incoming =
            data &&
            typeof data ===
                "object" &&
            !Array.isArray(data)
                ? data.twists
                : data;

        s.twists =
            Array.isArray(
                incoming
            )
                ? clone(
                      incoming
                  ).map(
                      t =>
                          normalizeTwist(
                              t
                          )
                  )
                : [];

        /*
         * Old saved seasons may have only twistWeeks.
         * Convert those into canonical twists.
         */
        if (
            !s.twists.length &&
            data?.twistWeeks
        ) {
            s.twists =
                Object.values(
                    data.twistWeeks
                )
                    .flat()
                    .map(
                        t =>
                            normalizeTwist(
                                t
                            )
                    );
        }

        const unique =
            new Map();

        s.twists.forEach(
            twist => {
                if (
                    !unique.has(
                        twist.id
                    )
                ) {
                    unique.set(
                        twist.id,
                        twist
                    );
                }
            }
        );

        s.twists =
            [...unique.values()];

        ensureTwistData();

        if (
            typeof populateWeekSelectors ===
            "function"
        ) {
            populateWeekSelectors(
                seasonLength()
            );
        }

        resetTwistEditorFixed();
        renderTwistsFixed();
    }

    function resimulateSeasonFixed() {
        if (!currentSeason) {
            alert(
                "Please open a saved season first."
            );
            return;
        }

        if (
            !confirm(
                "Re-simulate this season from the beginning? The current simulation results will be replaced."
            )
        ) {
            return;
        }

        /*
         * Reset only mutable simulation/player fields.
         * Images, names, ratings, relationships, alliances,
         * competitions, and twists remain intact.
         */
        (
            currentSeason.houseguests ||
            []
        ).forEach(
            player => {
                player.status =
                    "active";

                player.placement =
                    null;

                player.weeksInGame =
                    0;

                player.hohWins =
                    0;

                player.povWins =
                    0;

                player.safetyWins =
                    0;

                player.nominationCount =
                    0;

                player.vetoUsedOn =
                    [];

                player.evictionVotesReceived =
                    0;
            }
        );

        const sim =
            typeof createDefaultSimulation ===
            "function"
                ? createDefaultSimulation()
                : {};

        sim.started =
            false;

        sim.completed =
            false;

        sim.currentWeek =
            1;

        sim.currentPhase =
            "week";

        sim.currentEventIndex =
            0;

        sim.history =
            [];

        sim.weekHistory =
            [];

        sim.finalPlacements =
            [];

        sim.winner =
            null;

        sim.runnerUp =
            null;

        sim.jury =
            [];

        sim.finalists =
            [];

        sim.currentHOH =
            null;

        sim.currentNominees =
            [];

        sim.currentPOVPlayers =
            [];

        sim.currentPOVWinner =
            null;

        sim.currentSafetyWinner =
            null;

        sim.currentEviction =
            null;

        sim.pendingEvictionId =
            null;

        sim.evictionVoteResult =
            null;

        sim.evictionsThisWeek =
            0;

        sim.pendingWeekAdvance =
            false;

        sim.pendingCycle =
            null;

        sim.viewingWeek =
            1;

        sim.isViewingHistory =
            false;

        sim.liveView =
            null;

        sim.vetoDrawCounts =
            {};

        sim.lastVetoDrawnIds =
            [];

        sim.twistState =
            {};

        currentSeason.simulation =
            sim;

        ensureTwistData();

        if (
            typeof initializeSimulator ===
            "function"
        ) {
            initializeSimulator(
                currentSeason
            );
        }

        if (
            typeof persistCurrentSeason ===
            "function"
        ) {
            persistCurrentSeason();
        }

        showPage(
            "simulator-page"
        );
    }

    function ensureResimulationButton() {
        const results =
            document.getElementById(
                "results-page"
            );

        if (!results) return;

        if (
            document.getElementById(
                "resimulate-season-button"
            )
        ) {
            return;
        }

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.id =
            "resimulate-season-button";

        button.className =
            "primary-button large-button";

        button.textContent =
            "RE-SIMULATE SEASON";

        button.addEventListener(
            "click",
            resimulateSeasonFixed
        );

        const header =
            results.querySelector(
                ".results-header"
            );

        if (header) {
            header.appendChild(
                button
            );
        } else {
            results.insertBefore(
                button,
                results.firstChild
            );
        }
    }

    /*
     * Install the stable implementations.
     */
    window.getScheduledTwistsForWeek =
        getScheduledTwistsForWeekFixed;

    window.getUsableTwistStates =
        getUsableTwistStatesFixed;

    window.getWeekEventChain =
        getWeekEventChainFixed;

    window.runTwistEvent =
        runTwistEventFixed;

    window.runNominationEvent =
        runNominationEventFixed;

    window.runVetoCeremonyEvent =
        runVetoCeremonyEventFixed;

    window.runEvictionEvent =
        runEvictionEventFixed;

    window.runCustomCompetitionEvent =
        runCustomCompetitionEventFixed;

    window.saveTwist =
        saveTwistFixed;

    window.resetTwistEditor =
        resetTwistEditorFixed;

    window.editTwist =
        editTwistFixed;

    window.deleteTwist =
        deleteTwistFixed;

    window.renderTwists =
        renderTwistsFixed;

    window.loadTwists =
        loadTwistsFixed;

    window.resimulateSeason =
        resimulateSeasonFixed;

    /*
     * Wrap the existing runNextEvent so the normal HOH/POV/eviction/
     * finale engine remains intact. Only the new built-in safety event
     * needs its own dispatcher.
     */
    const legacyRunNextEvent =
        window.runNextEvent;

    window.runNextEvent =
        function () {
            const sim =
                ensureSimState();

            if (
                !sim ||
                !currentSeason
            ) {
                if (
                    typeof legacyRunNextEvent ===
                    "function"
                ) {
                    return legacyRunNextEvent();
                }

                return;
            }

            if (
                sim.isViewingHistory
            ) {
                if (
                    typeof returnToCurrentSimulation ===
                    "function"
                ) {
                    return returnToCurrentSimulation();
                }

                return;
            }

            if (
                sim.pendingWeekAdvance ||
                sim.pendingCycle ===
                    "nextWeek" ||
                sim.pendingCycle ===
                    "double"
            ) {
                return legacyRunNextEvent();
            }

            const chain =
                getWeekEventChainFixed(
                    sim.currentWeek
                );

            const index =
                Number(
                    sim.currentEventIndex ||
                        0
                );

            const event =
                chain[index];

            if (!event) {
                return legacyRunNextEvent();
            }

            sim.renderingEventKey =
                event.key;

            sim.renderingEventLabel =
                event.label;

            if (
                event.key ===
                "built-in-safety"
            ) {
                runBuiltInSafetyEvent();

                if (
                    typeof persistCurrentSeason ===
                    "function"
                ) {
                    persistCurrentSeason();
                }

                if (
                    typeof renderSimulationWeekNavigation ===
                    "function"
                ) {
                    renderSimulationWeekNavigation();
                }

                if (
                    typeof renderMemoryWallMini ===
                    "function"
                ) {
                    renderMemoryWallMini();
                }

                return;
            }

            return legacyRunNextEvent();
        };

    window.runBuiltInSafetyEvent =
        runBuiltInSafetyEvent;

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            try {
                ensureTwistData();

                const saveButton =
                    document.getElementById(
                        "save-twist-btn"
                    );

                const clearButton =
                    document.getElementById(
                        "cancel-twist-btn"
                    );

                if (saveButton) {
                    saveButton.onclick =
                        saveTwistFixed;
                }

                if (clearButton) {
                    clearButton.onclick =
                        resetTwistEditorFixed;
                }

                ensureResimulationButton();
            } catch (error) {
                console.error(
                    "Twist engine initialization failed:",
                    error
                );
            }
        }
    );
})();

/*
 * =========================================================
 * FINAL SIMULATION ENGINE OVERRIDE
 * =========================================================
 *
 * This is intentionally placed LAST in twist-engine.js.
 *
 * It fixes:
 *   1. Safety/Tropical Immunity occurring after POV
 *   2. Special competitions occurring after POV
 *   3. Eviction voting displaying the eviction result too early
 *   4. Eviction voting portraits
 *   5. Portrait centering
 *   6. The old app.js event chain being re-used accidentally
 *
 * The existing app.js remains responsible for the individual
 * competition/event mechanics.
 * This block is the ONE owner of event order.
 */

(function () {
    "use strict";

    function engineState() {
        if (!currentSeason) return null;

        if (!currentSeason.simulation) {
            currentSeason.simulation =
                typeof createDefaultSimulation === "function"
                    ? createDefaultSimulation()
                    : {};
        }

        return currentSeason.simulation;
    }

    function engineChain(week) {
        const sim = engineState();

        if (!sim) return [];

        const w = Number(
            week || sim.currentWeek || 1
        );

        /*
         * Finale is handled separately.
         */
        if (
            sim.currentPhase === "finale" ||
            sim.finaleStarted
        ) {
            return typeof getFinaleChain === "function"
                ? getFinaleChain()
                : [];
        }

        const chain = [];

        /*
         * -----------------------------------------------------
         * TWISTS
         * -----------------------------------------------------
         */
        if (
            typeof getScheduledTwistsForWeekFixed ===
            "function"
        ) {
            getScheduledTwistsForWeekFixed(w).forEach(
                twist => {
                    chain.push({
                        key: "twist",
                        label:
                            twist.name || "Twist",
                        twistId: twist.id
                    });
                }
            );
        }

        /*
         * -----------------------------------------------------
         * HOH
         * -----------------------------------------------------
         */
        const hoh =
            typeof getCompetitionForWeekType ===
            "function"
                ? getCompetitionForWeekType(w, "hoh")
                : null;

        chain.push({
            key: "hoh",
            label:
                hoh?.name ||
                "HOH Competition"
        });

        /*
         * -----------------------------------------------------
         * SAFETY / TROPICAL IMMUNITY
         *
         * THIS MUST HAPPEN BEFORE NOMINATIONS.
         * -----------------------------------------------------
         */
        const safetyCompetitions =
            typeof getWeekCompetitions === "function"
                ? getWeekCompetitions(w).filter(
                      c => c && c.type === "safety"
                  )
                : [];

        const safetyEnabled =
            currentSeason?.rules
                ?.safetyCompetitionEnabled === true;

        if (
            safetyEnabled ||
            safetyCompetitions.length
        ) {
            if (safetyCompetitions.length) {
                safetyCompetitions.forEach(comp => {
                    chain.push({
                        key: "custom-competition",
                        label:
                            comp.name ||
                            "Safety Competition",
                        competitionId: comp.id,
                        competitionType: "safety"
                    });
                });
            } else {
                chain.push({
                    key: "built-in-safety",
                    label: "Safety Competition"
                });
            }
        }

        /*
         * -----------------------------------------------------
         * NOMINATIONS
         * -----------------------------------------------------
         */
        chain.push({
            key: "nominations",
            label: "Nomination Ceremony"
        });

        /*
         * -----------------------------------------------------
         * VETO PLAYER SELECTION
         * -----------------------------------------------------
         */
        chain.push({
            key: "pov-players",
            label: "Veto Selections"
        });

        /*
         * -----------------------------------------------------
         * POV
         * -----------------------------------------------------
         */
        const pov =
            typeof getCompetitionForWeekType ===
            "function"
                ? getCompetitionForWeekType(w, "pov")
                : null;

        chain.push({
            key: "pov",
            label:
                pov?.name ||
                "POV Competition"
        });

        /*
         * -----------------------------------------------------
         * VETO CEREMONY
         * -----------------------------------------------------
         */
        chain.push({
            key: "veto-ceremony",
            label: "Veto Ceremony"
        });

        /*
         * -----------------------------------------------------
         * OTHER CUSTOM COMPETITIONS
         *
         * Safety competitions are deliberately excluded here
         * because they were already inserted above.
         * -----------------------------------------------------
         */
        const otherCompetitions =
            typeof getWeekCompetitions === "function"
                ? getWeekCompetitions(w).filter(
                      c =>
                          c &&
                          (
                              c.type === "special" ||
                              c.type === "luxury"
                          )
                  )
                : [];

        otherCompetitions.forEach(comp => {
            chain.push({
                key: "custom-competition",
                label:
                    comp.name ||
                    "Special Competition",
                competitionId: comp.id,
                competitionType: comp.type
            });
        });

        /*
         * -----------------------------------------------------
         * EVICTION VOTING
         * -----------------------------------------------------
         */
        chain.push({
            key: "eviction-voting",
            label: "Eviction Voting"
        });

        /*
         * -----------------------------------------------------
         * EVICTION RESULT
         * -----------------------------------------------------
         */
        chain.push({
            key: "eviction",
            label: "Eviction"
        });

        return chain;
    }

    /*
     * ---------------------------------------------------------
     * EVICITON VOTING DISPLAY
     * ---------------------------------------------------------
     *
     * Calculate votes here, but DO NOT announce who is evicted.
     *
     * The actual eviction result is displayed by the next
     * "Eviction" event.
     */
    function runEvictionVotingPortraitEvent() {
        const sim = engineState();

        if (!sim) return;

        const active =
            typeof getActiveHouseguests === "function"
                ? getActiveHouseguests()
                : [];

        const nominees =
            (sim.currentNominees || [])
                .map(id =>
                    active.find(
                        p => p.id === id
                    )
                )
                .filter(Boolean);

        if (nominees.length < 2) {
            sim.currentEventIndex++;

            if (
                typeof resetGameChain ===
                "function"
            ) {
                resetGameChain(
                    sim.currentEventIndex
                );
            }

            showEvent(
                "Eviction Voting",
                "EVICTION VOTING",
                `
                    <p>
                        There are not enough nominees
                        for a standard eviction vote.
                    </p>
                `
            );

            return;
        }

        const voters =
            active.filter(
                voter =>
                    voter.id !== sim.currentHOH &&
                    !nominees.some(
                        nominee =>
                            nominee.id === voter.id
                    )
            );

        const votes = [];

        voters.forEach(voter => {
            const scores =
                nominees
                    .map(target => {
                        const bond =
                            typeof allianceBond ===
                            "function"
                                ? allianceBond(
                                      voter.id,
                                      target.id
                                  )
                                : 0;

                        return {
                            target,
                            score:
                                Math.max(
                                    0.1,
                                    10 -
                                        bond +
                                        Math.random() * 5
                                )
                        };
                    })
                    .sort(
                        (a, b) =>
                            b.score -
                            a.score
                    );

            const target =
                scores[0]?.target;

            if (target) {
                votes.push({
                    voter: voter.id,
                    target: target.id
                });
            }
        });

        const counts = {};

        nominees.forEach(
            nominee => {
                counts[nominee.id] = 0;
            }
        );

        votes.forEach(vote => {
            counts[vote.target] =
                Number(
                    counts[vote.target] || 0
                ) + 1;
        });

        /*
         * Store the vote result for the NEXT event.
         * Do not display the result here.
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
            sorted[0];

        const other =
            sorted[1];

        sim.pendingEvictionId =
            target?.id || null;

        sim.evictionVoteResult = {
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
            votes
        };

        /*
         * Advance to the actual Eviction event.
         */
        sim.currentEventIndex++;

        if (
            typeof updateSimulatorStatus ===
            "function"
        ) {
            updateSimulatorStatus(sim);
        }

        if (
            typeof resetGameChain ===
            "function"
        ) {
            resetGameChain(
                sim.currentEventIndex
            );
        }

        /*
         * -----------------------------------------------------
         * PORTRAIT-BASED VOTE DISPLAY
         * -----------------------------------------------------
         */
        const voteRows =
            votes.map(vote => {
                const voter =
                    typeof getHouseguestForSimulation ===
                    "function"
                        ? getHouseguestForSimulation(
                              vote.voter
                          )
                        : null;

                const voted =
                    typeof getHouseguestForSimulation ===
                    "function"
                        ? getHouseguestForSimulation(
                              vote.target
                          )
                        : null;

                if (!voter || !voted) {
                    return "";
                }

                return `
                    <div class="eviction-vote-card">

                        <div class="eviction-voter">
                            ${simulationPortrait(
                                voter,
                                "medium"
                            )}
                        </div>

                        <div class="eviction-vote-arrow">
                            <span>VOTES TO EVICT</span>
                            <strong>→</strong>
                        </div>

                        <div class="eviction-target">
                            ${simulationPortrait(
                                voted,
                                "medium"
                            )}
                        </div>

                    </div>
                `;
            }).join("");

        showEvent(
            "Eviction Voting",
            "EVICTION VOTING",
            `
                <div class="eviction-voting-intro">

                    <h3>
                        The Houseguests Cast Their Votes
                    </h3>

                    <div class="eviction-nominees">
                        ${simulationPortraits(
                            nominees.map(
                                nominee =>
                                    nominee.id
                            ),
                            "large"
                        )}
                    </div>

                </div>

                <div class="eviction-live-votes">
                    ${voteRows ||
                    "<p>No eligible voters.</p>"}
                </div>
            `
        );
    }

    /*
     * ---------------------------------------------------------
     * FINAL EVENT DISPATCHER
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     *
     * We DO NOT call the old runNextEvent here.
     *
     * That was the source of the safety-order bug because the
     * old function calls the old app.js getWeekEventChain().
     */
    function runNextEventClean() {
        if (!currentSeason) {
            alert(
                "Please open a saved season first."
            );
            return;
        }

        const sim =
            engineState();

        if (!sim) return;

        /*
         * History mode does not alter the simulation.
         */
        if (
            sim.isViewingHistory
        ) {
            if (
                typeof returnToCurrentSimulation ===
                "function"
            ) {
                returnToCurrentSimulation();
            }

            return;
        }

        /*
         * Start the next week only after the current eviction
         * screen has already been displayed.
         */
        if (
            sim.pendingWeekAdvance
        ) {
            const nextWeek =
                Number(
                    sim.currentWeek || 1
                ) + 1;

            if (
                nextWeek >
                getSeasonLength(
                    currentSeason
                )
            ) {
                if (
                    typeof beginFinale ===
                    "function"
                ) {
                    beginFinale();
                } else if (
                    typeof finalizeSeason ===
                    "function"
                ) {
                    finalizeSeason(
                        getActiveHouseguests()
                    );
                }

                return;
            }

            if (
                typeof resetCycleForNewHOH ===
                "function"
            ) {
                resetCycleForNewHOH(
                    sim,
                    nextWeek
                );
            } else {
                sim.currentWeek =
                    nextWeek;

                sim.viewingWeek =
                    nextWeek;

                sim.pendingWeekAdvance =
                    false;

                sim.pendingCycle =
                    null;

                sim.currentEventIndex =
                    0;

                sim.currentHOH =
                    null;

                sim.currentNominees =
                    [];

                sim.currentPOVPlayers =
                    [];

                sim.currentPOVWinner =
                    null;

                sim.currentSafetyWinner =
                    null;

                sim.currentEviction =
                    null;

                sim.pendingEvictionId =
                    null;

                sim.evictionVoteResult =
                    null;
            }

            if (
                typeof setText ===
                "function"
            ) {
                setText(
                    "current-week",
                    nextWeek
                );
            }

            if (
                typeof updateSimulatorStatus ===
                "function"
            ) {
                updateSimulatorStatus(
                    sim
                );
            }

            if (
                typeof resetGameChain ===
                "function"
            ) {
                resetGameChain(0);
            }

            showEvent(
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

            if (
                typeof persistCurrentSeason ===
                "function"
            ) {
                persistCurrentSeason();
            }

            return;
        }

        /*
         * Finale.
         */
        if (
            sim.currentPhase ===
                "finale" ||
            sim.finaleStarted
        ) {
            const finaleChain =
                typeof getFinaleChain ===
                "function"
                    ? getFinaleChain()
                    : [];

            const index =
                Number(
                    sim.currentEventIndex || 0
                );

            const event =
                finaleChain[index];

            if (!event) {
                if (
                    typeof beginFinale ===
                    "function"
                ) {
                    beginFinale();
                }

                return;
            }

            sim.renderingEventKey =
                event.key;

            sim.renderingEventLabel =
                event.label;

            switch (event.key) {
                case "final-hoh":
                    runFinalHOHEvent();
                    break;

                case "jury-voting":
                    runJuryVotingEvent();
                    break;

                case "finale-results":
                    runFinaleResultsEvent();
                    break;

                default:
                    sim.currentEventIndex++;
            }

            if (
                typeof persistCurrentSeason ===
                "function"
            ) {
                persistCurrentSeason();
            }

            return;
        }

        /*
         * -----------------------------------------------------
         * THE IMPORTANT PART:
         *
         * ALWAYS use our clean chain.
         * -----------------------------------------------------
         */
        const chain =
            engineChain(
                sim.currentWeek
            );

        const index =
            Number(
                sim.currentEventIndex || 0
            );

        const event =
            chain[index];

        /*
         * Week finished.
         */
        if (!event) {
            sim.pendingWeekAdvance =
                true;

            sim.pendingCycle =
                "nextWeek";

            if (
                typeof persistCurrentSeason ===
                "function"
            ) {
                persistCurrentSeason();
            }

            return;
        }

        sim.viewingWeek =
            Number(
                sim.currentWeek || 1
            );

        sim.renderingEventKey =
            event.key;

        sim.renderingEventLabel =
            event.label;

        switch (event.key) {

            case "twist":
                runTwistEventFixed(
                    event.twistId
                );
                break;

            case "hoh":
                runHOHEvent();
                break;

            case "built-in-safety":
                runBuiltInSafetyEvent();
                break;

            case "nominations":
                runNominationEventFixed();
                break;

            case "pov-players":
                runPOVPlayersEvent();
                break;

            case "pov":
                runPOVEvent();
                break;

            case "veto-ceremony":
                runVetoCeremonyEventFixed();
                break;

            case "custom-competition":
                runCustomCompetitionEventFixed(
                    event.competitionId
                );
                break;

            case "eviction-voting":
                runEvictionVotingPortraitEvent();
                break;

            case "eviction":
                runEvictionEventFixed();
                break;

            default:
                sim.currentEventIndex++;
                break;
        }

        if (
            typeof persistCurrentSeason ===
            "function"
        ) {
            persistCurrentSeason();
        }

        if (
            typeof renderSimulationWeekNavigation ===
            "function"
        ) {
            renderSimulationWeekNavigation();
        }

        if (
            typeof renderMemoryWallMini ===
            "function"
        ) {
            renderMemoryWallMini();
        }
    }

    /*
     * ---------------------------------------------------------
     * PORTRAIT CENTERING
     * ---------------------------------------------------------
     */
    const style =
        document.createElement("style");

    style.textContent = `
        #event-content,
        .sim-main-panel #event-content {
            text-align: center !important;
        }

        #event-content > div,
        .sim-main-panel #event-content > div {
            margin-left: auto !important;
            margin-right: auto !important;
        }

        #event-content .sim-portrait-grid,
        .sim-main-panel #event-content .sim-portrait-grid {
            width: fit-content !important;
            max-width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            justify-content: center !important;
            align-self: center !important;
        }

        .sim-portrait {
            margin-left: auto !important;
            margin-right: auto !important;
        }

        .ceremony-role-section {
            width: 100%;
            text-align: center !important;
        }

        .eviction-voting-intro {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
            text-align: center;
        }

        .eviction-nominees {
            width: fit-content;
            max-width: 100%;
            margin: 20px auto;
        }

        .eviction-live-votes {
            width: min(850px, 100%);
            margin: 25px auto;
        }

        .eviction-vote-card {
            display: grid;
            grid-template-columns:
                minmax(110px, 1fr)
                minmax(130px, auto)
                minmax(110px, 1fr);

            align-items: center;
            justify-items: center;

            gap: 25px;

            width: 100%;

            padding: 18px 10px;

            border-bottom: 1px solid #4a4a4a;
        }

        .eviction-voter,
        .eviction-target {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            width: 100%;
        }

        .eviction-vote-arrow {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 7px;

            text-align: center;
        }

        .eviction-vote-arrow span {
            font-size: 10px;
            font-weight: 900;
            letter-spacing: .7px;
            color: #aaa;
        }

        .eviction-vote-arrow strong {
            font-size: 28px;
            line-height: 1;
        }

        @media (max-width: 600px) {
            .eviction-vote-card {
                grid-template-columns:
                    1fr;
                gap: 10px;
            }

            .eviction-vote-arrow {
                flex-direction: row;
            }
        }
    `;

    document.head.appendChild(style);

    /*
     * ---------------------------------------------------------
     * INSTALL THE CLEAN ENGINE
     * ---------------------------------------------------------
     */
    window.getWeekEventChain =
        engineChain;

    window.runNextEvent =
        runNextEventClean;

    window.runEvictionVotingEvent =
        runEvictionVotingPortraitEvent;

    console.log(
        "Big Brother Simulator: clean event dispatcher loaded."
    );

})();
