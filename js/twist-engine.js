/*
 * BIG BROTHER SIMULATOR
 * TWIST ENGINE
 *
 * Step 1:
 * Separates all twist creation, editing, scheduling, runtime state,
 * and simulator-effect logic from app.js.
 *
 * This file is loaded AFTER app.js so these functions become the
 * authoritative twist functions without requiring the entire simulator
 * to be rewritten at once.
 */

(function () {
    "use strict";

    /*
     * ---------------------------------------------------------
     * CONSTANTS
     * ---------------------------------------------------------
     */

    const TWIST_EFFECTS = {
        display: "Display / Story Only",
        nominationVoid: "Nomination Void",
        diamondPOV: "Diamond POV Upgrade",
        haltingHex: "Halting Hex",
        immunity: "Immunity / Safety"
    };


    /*
     * ---------------------------------------------------------
     * RUNTIME STATE
     * ---------------------------------------------------------
     */

    function ensureTwistRuntimeState(sim) {
        if (!sim) return null;

        if (
            !sim.twistState ||
            typeof sim.twistState !== "object" ||
            Array.isArray(sim.twistState)
        ) {
            sim.twistState = {};
        }

        return sim;
    }


    function getTwistState(twistId) {
        const sim =
            ensureTwistRuntimeState(
                currentSeason?.simulation
            );

        if (!sim || !twistId) return null;

        return sim.twistState[twistId] || null;
    }


    function createTwistRuntimeState(twistId) {
        const sim =
            ensureTwistRuntimeState(
                currentSeason?.simulation
            );

        if (!sim || !twistId) return null;

        if (!sim.twistState[twistId]) {
            sim.twistState[twistId] = {
                holderId: null,
                awardedWeek: null,
                used: false
            };
        }

        return sim.twistState[twistId];
    }


    /*
     * ---------------------------------------------------------
     * TWIST NORMALIZATION
     * ---------------------------------------------------------
     */

    function normalizeTwist(twist) {
        if (!twist) return null;

        const startWeek =
            Math.max(
                1,
                Number(
                    twist.startWeek ||
                    twist.week ||
                    1
                )
            );

        const endWeek =
            Math.max(
                startWeek,
                Number(
                    twist.endWeek ||
                    startWeek
                )
            );

        const powerUntil =
            Math.max(
                startWeek,
                Number(
                    twist.powerUntil ||
                    endWeek
                )
            );

        return {
            ...twist,

            startWeek,

            endWeek,

            week: startWeek,

            powerUntil,

            effectType:
                twist.effectType ||
                "display",

            active:
                twist.active !== false,

            power:
                String(
                    twist.power || ""
                ),

            description:
                String(
                    twist.description || ""
                )
        };
    }


    /*
     * ---------------------------------------------------------
     * SCHEDULED TWISTS
     * ---------------------------------------------------------
     */

    function getScheduledTwistsForWeek(week) {
        const season =
            currentSeason;

        if (!season) return [];

        const targetWeek =
            Number(week || 1);

        const source =
            Array.isArray(season.twists)
                ? season.twists
                : [];

        const seen =
            new Set();

        return source
            .map(normalizeTwist)
            .filter(twist => {

                if (!twist) {
                    return false;
                }

                if (!twist.active) {
                    return false;
                }

                if (seen.has(twist.id)) {
                    return false;
                }

                if (
                    targetWeek <
                    twist.startWeek
                ) {
                    return false;
                }

                if (
                    targetWeek >
                    twist.endWeek
                ) {
                    return false;
                }

                seen.add(twist.id);

                return true;
            });
    }


    /*
     * ---------------------------------------------------------
     * ACTIVE POWER STATES
     * ---------------------------------------------------------
     */

    function getUsableTwistStates(
        week,
        effectType
    ) {
        const sim =
            ensureTwistRuntimeState(
                currentSeason?.simulation
            );

        if (!sim) return [];

        const targetWeek =
            Number(
                week ||
                sim.currentWeek ||
                1
            );

        const twists =
            Array.isArray(
                currentSeason?.twists
            )
                ? currentSeason.twists
                : [];

        return twists
            .map(normalizeTwist)
            .map(twist => ({
                twist,

                state:
                    sim.twistState[
                        twist.id
                    ]
            }))
            .filter(({ twist, state }) => {

                if (!state) {
                    return false;
                }

                if (!state.holderId) {
                    return false;
                }

                if (state.used) {
                    return false;
                }

                if (
                    targetWeek <
                    twist.startWeek
                ) {
                    return false;
                }

                const usableThrough =
                    Number(
                        twist.powerUntil ||
                        twist.endWeek ||
                        twist.startWeek
                    );

                if (
                    targetWeek >
                    usableThrough
                ) {
                    return false;
                }

                return (
                    (
                        twist.effectType ||
                        "display"
                    ) === effectType
                );
            });
    }


    /*
     * ---------------------------------------------------------
     * HOLDER ASSIGNMENT
     * ---------------------------------------------------------
     *
     * A holder is assigned ONLY ONCE.
     *
     * Viewing an old week or rerendering an event can never
     * randomly assign a new holder.
     */

    function assignTwistHolder(twist) {
        if (!twist) return null;

        const effect =
            twist.effectType ||
            "display";

        /*
         * Story-only twists do not get a power holder.
         */
        if (effect === "display") {
            return null;
        }

        const state =
            createTwistRuntimeState(
                twist.id
            );

        if (!state) {
            return null;
        }

        /*
         * CRITICAL:
         *
         * If a holder already exists, return that same player.
         */
        if (state.holderId) {
            return getHouseguestForSimulation(
                state.holderId
            );
        }

        /*
         * A used power can never receive a new holder.
         */
        if (state.used) {
            return null;
        }

        const active =
            getActiveHouseguests();

        if (!active.length) {
            return null;
        }

        const holder =
            randomItem(active);

        if (!holder) {
            return null;
        }

        state.holderId =
            holder.id;

        state.awardedWeek =
            Number(
                currentSeason
                    ?.simulation
                    ?.currentWeek ||
                1
            );

        return holder;
    }


    /*
     * ---------------------------------------------------------
     * USE TWIST
     * ---------------------------------------------------------
     */

    function useTwist(twistId) {
        const state =
            getTwistState(
                twistId
            );

        if (!state) {
            return false;
        }

        if (!state.holderId) {
            return false;
        }

        if (state.used) {
            return false;
        }

        state.used = true;

        return true;
    }


    /*
     * ---------------------------------------------------------
     * TWIST EDITOR
     * ---------------------------------------------------------
     */

    function saveTwist() {
        const s =
            ensureWeekCollections(
                getAdvancedArrays()
            );

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
            getSeasonLength();

        let startWeek =
            getWeekNumber(
                getValue(
                    "twist-start-week"
                ) || 1
            );

        let endWeek =
            getWeekNumber(
                getValue(
                    "twist-end-week"
                ) || startWeek
            );

        let powerUntil =
            getWeekNumber(
                getValue(
                    "twist-power-until"
                ) || endWeek
            );

        startWeek =
            Math.max(
                1,
                Math.min(
                    maxWeeks,
                    startWeek
                )
            );

        endWeek =
            Math.max(
                startWeek,
                Math.min(
                    maxWeeks,
                    endWeek
                )
            );

        powerUntil =
            Math.max(
                startWeek,
                Math.min(
                    maxWeeks,
                    powerUntil
                )
            );

        const id =
            editingTwistId ||
            uid("twist");

        const oldTwist =
            (s.twists || [])
                .find(
                    twist =>
                        twist.id === id
                );

        const obj =
            normalizeTwist({
                id,

                name,

                startWeek,

                endWeek,

                week:
                    startWeek,

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
                    startWeek === endWeek
                        ? `week${startWeek}`
                        : `weeks${startWeek}-${endWeek}`,

                active:
                    getChecked(
                        "twist-active"
                    )
            });

        /*
         * Remove old copies from the weekly index.
         */
        Object.keys(
            s.twistWeeks || {}
        ).forEach(key => {

            s.twistWeeks[key] =
                (
                    s.twistWeeks[key] ||
                    []
                ).filter(
                    twist =>
                        twist.id !== id
                );

            if (
                !s.twistWeeks[key].length
            ) {
                delete s.twistWeeks[key];
            }
        });

        /*
         * Rebuild the weekly index.
         */
        for (
            let week =
                startWeek;
            week <= endWeek;
            week++
        ) {

            if (
                !s.twistWeeks[
                    String(week)
                ]
            ) {
                s.twistWeeks[
                    String(week)
                ] = [];
            }

            s.twistWeeks[
                String(week)
            ].push({
                ...obj,

                week
            });
        }

        /*
         * Keep one master copy.
         */
        s.twists =
            (s.twists || [])
                .filter(
                    twist =>
                        twist.id !== id
                );

        s.twists.push(obj);

        /*
         * IMPORTANT:
         *
         * Editing a twist must not destroy its
         * existing runtime power state.
         */
        if (
            oldTwist &&
            currentSeason?.simulation
                ?.twistState?.[id]
        ) {

            const state =
                currentSeason
                    .simulation
                    .twistState[id];

            currentSeason
                .simulation
                .twistState[id] = {
                    ...state
                };
        }

        resetTwistEditor();

        renderTwists();

        persistCurrentSeasonIfSaved();
    }


    function resetTwistEditor() {

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


    function findTwist(id) {

        const s =
            ensureWeekCollections(
                getAdvancedArrays()
            );

        for (
            const arr of
            Object.values(
                s.twistWeeks || {}
            )
        ) {

            const found =
                (
                    arr || []
                ).find(
                    twist =>
                        twist.id === id
                );

            if (found) {
                return found;
            }
        }

        return (
            s.twists || []
        ).find(
            twist =>
                twist.id === id
        ) || null;
    }


    function editTwist(id) {

        const twist =
            findTwist(id);

        if (!twist) {
            return;
        }

        editingTwistId =
            id;

        setValue(
            "twist-name",
            twist.name || ""
        );

        setValue(
            "twist-start-week",
            twist.startWeek ||
            twist.week ||
            1
        );

        setValue(
            "twist-end-week",
            twist.endWeek ||
            twist.week ||
            1
        );

        setValue(
            "twist-power",
            twist.power || ""
        );

        setValue(
            "twist-effect-type",
            twist.effectType ||
            "display"
        );

        setValue(
            "twist-power-until",
            twist.powerUntil ||
            twist.endWeek ||
            twist.week ||
            1
        );

        setValue(
            "twist-description",
            twist.description ||
            ""
        );

        setChecked(
            "twist-active",
            twist.active !== false
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


    function deleteTwist(id) {

        if (
            !confirm(
                "Delete this twist?"
            )
        ) {
            return;
        }

        const s =
            ensureWeekCollections(
                getAdvancedArrays()
            );

        Object.keys(
            s.twistWeeks || {}
        ).forEach(key => {

            s.twistWeeks[key] =
                (
                    s.twistWeeks[key] ||
                    []
                ).filter(
                    twist =>
                        twist.id !== id
                );

            if (
                !s.twistWeeks[key].length
            ) {
                delete s.twistWeeks[key];
            }
        });

        s.twists =
            (s.twists || [])
                .filter(
                    twist =>
                        twist.id !== id
                );

        /*
         * Remove runtime state too.
         */
        if (
            currentSeason
                ?.simulation
                ?.twistState
        ) {

            delete currentSeason
                .simulation
                .twistState[id];
        }

        renderTwists();

        persistCurrentSeasonIfSaved();
    }


    function renderTwists() {

        const container =
            document.getElementById(
                "twists-container"
            );

        if (!container) {
            return;
        }

        const s =
            ensureWeekCollections(
                getAdvancedArrays()
            );

        const twists =
            [...(
                s.twists || []
            )]
            .map(normalizeTwist)
            .sort(
                (a, b) =>
                    a.startWeek -
                    b.startWeek
            );

        if (!twists.length) {

            container.innerHTML = `
                <div class="empty-state">
                    <p>
                        No weekly twists created yet.
                        Add a twist above if applicable.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            twists
                .map(twist => {

                    const range =
                        twist.startWeek ===
                        twist.endWeek
                            ? `Week ${twist.startWeek}`
                            : `Weeks ${twist.startWeek}–${twist.endWeek}`;

                    const effect =
                        TWIST_EFFECTS[
                            twist.effectType
                        ] ||
                        TWIST_EFFECTS.display;

                    const powerHTML =
                        twist.power
                            ? `
                                <small>
                                    <strong>
                                        Power:
                                    </strong>
                                    ${escapeHTML(
                                        twist.power
                                    )}
                                </small>

                                <small>
                                    <strong>
                                        Usable through:
                                    </strong>
                                    Week
                                    ${twist.powerUntil}
                                </small>

                                <small>
                                    <strong>
                                        Simulator effect:
                                    </strong>
                                    ${escapeHTML(
                                        effect
                                    )}
                                </small>
                            `
                            : `
                                <small>
                                    <strong>
                                        Simulator effect:
                                    </strong>
                                    ${escapeHTML(
                                        effect
                                    )}
                                </small>
                            `;

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
                                            twist.name ||
                                            "Unnamed Twist"
                                        )}
                                    </h4>

                                </div>

                                <span class="feature-status">
                                    ${
                                        twist.active
                                            ? "Active"
                                            : "Inactive"
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

                                        ${powerHTML}

                                    </div>

                                    <div class="advanced-card-actions">

                                        <button
                                            type="button"
                                            onclick="editTwist('${escapeAttribute(twist.id)}')"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            onclick="deleteTwist('${escapeAttribute(twist.id)}')"
                                        >
                                            Delete
                                        </button>

                                    </div>

                                </div>

                            </div>

                        </div>
                    `;
                })
                .join("");
    }


    /*
     * ---------------------------------------------------------
     * LOAD TWISTS
     * ---------------------------------------------------------
     */

    function loadTwists(data) {

        const s =
            getAdvancedArrays();

        if (
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            data.twistWeeks
        ) {

            s.twistWeeks =
                deepClone(
                    data.twistWeeks
                );

            s.twists =
                deepClone(
                    data.twists || []
                );

        } else {

            s.twists =
                deepClone(
                    Array.isArray(data)
                        ? data
                        : []
                );

            s.twistWeeks = {};

            s.twists =
                s.twists.map(
                    normalizeTwist
                );

            s.twists.forEach(
                twist => {

                    for (
                        let week =
                            twist.startWeek;
                        week <=
                            twist.endWeek;
                        week++
                    ) {

                        if (
                            !s.twistWeeks[
                                String(week)
                            ]
                        ) {
                            s.twistWeeks[
                                String(week)
                            ] = [];
                        }

                        s.twistWeeks[
                            String(week)
                        ].push({
                            ...twist,
                            week
                        });
                    }
                }
            );
        }

        /*
         * Normalize existing twists so older seasons
         * automatically receive effectType = display.
         */
        s.twists =
            (s.twists || [])
                .map(normalizeTwist);

        populateWeekSelectors(
            getSeasonLength()
        );

        resetTwistEditor();

        renderTwists();
    }


    /*
     * ---------------------------------------------------------
     * SIMULATOR TWIST EVENT
     * ---------------------------------------------------------
     */

    function runTwistEvent(twistId) {

        const sim =
            ensureTwistRuntimeState(
                currentSeason?.simulation
            );

        if (!sim) {
            return;
        }

        const rawTwist =
            (
                currentSeason
                    ?.twists || []
            ).find(
                twist =>
                    twist.id === twistId
            );

        sim.currentEventIndex =
            Number(
                sim.currentEventIndex ||
                0
            ) + 1;

        if (!rawTwist) {

            showEvent(
                "Twist",
                "TWIST",
                `
                    <p>
                        No twist information is available.
                    </p>
                `
            );

            resetGameChain(
                sim.currentEventIndex
            );

            return;
        }

        const twist =
            normalizeTwist(
                rawTwist
            );

        /*
         * Story-only twists never receive a holder.
         *
         * Real powers receive a holder once and only once.
         */
        const holder =
            assignTwistHolder(
                twist
            );

        const state =
            getTwistState(
                twist.id
            );

        const effect =
            twist.effectType ||
            "display";

        const effectLabel =
            TWIST_EFFECTS[
                effect
            ] ||
            TWIST_EFFECTS.display;

        const holderName =
            holder
                ? getHouseguestDisplayName(
                    holder.id,
                    currentSeason.houseguests
                )
                : "";

        const powerHTML =
            twist.power
                ? `
                    <p>
                        <strong>
                            Power:
                        </strong>
                        ${escapeHTML(
                            twist.power
                        )}
                    </p>

                    <p>
                        <strong>
                            Usable through:
                        </strong>
                        Week
                        ${twist.powerUntil}
                    </p>
                `
                : "";

        const status =
            effect === "display"
                ? "Story / Display Only"
                : state?.used
                    ? "Power Used"
                    : holder
                        ? "Power Active"
                        : "No Holder Available";

        const holderHTML =
            holder
                ? `
                    <div class="twist-power-holder">

                        <h3>
                            Power Holder
                        </h3>

                        ${simulationPortrait(
                            holder,
                            "large"
                        )}

                        <p>
                            <strong>
                                ${escapeHTML(
                                    holderName
                                )}
                            </strong>
                            received this power.
                        </p>

                    </div>
                `
                : "";

        showEvent(
            twist.name ||
                "Twist",
            "TWIST",
            `
                <div class="twist-event-card">

                    <h3>
                        ${escapeHTML(
                            twist.name ||
                            "Twist"
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            twist.description ||
                            "A twist is active this week."
                        )}
                    </p>

                    <p>
                        <strong>
                            Active:
                        </strong>
                        Week
                        ${twist.startWeek}

                        ${
                            twist.endWeek !==
                            twist.startWeek
                                ? ` through Week ${twist.endWeek}`
                                : ""
                        }
                    </p>

                    ${powerHTML}

                    <p>
                        <strong>
                            Simulator Effect:
                        </strong>
                        ${escapeHTML(
                            effectLabel
                        )}
                    </p>

                    <p>
                        <strong>
                            Status:
                        </strong>
                        ${escapeHTML(
                            status
                        )}
                    </p>

                    ${holderHTML}

                </div>
            `
        );

        resetGameChain(
            sim.currentEventIndex
        );
    }


    /*
     * ---------------------------------------------------------
     * GLOBAL API
     * ---------------------------------------------------------
     *
     * app.js and inline HTML handlers can continue using these
     * functions exactly as before.
     */

    window.ensureTwistRuntimeState =
        ensureTwistRuntimeState;

    window.getTwistState =
        getTwistState;

    window.createTwistRuntimeState =
        createTwistRuntimeState;

    window.normalizeTwist =
        normalizeTwist;

    window.getScheduledTwistsForWeek =
        getScheduledTwistsForWeek;

    window.getUsableTwistStates =
        getUsableTwistStates;

    window.assignTwistHolder =
        assignTwistHolder;

    window.useTwist =
        useTwist;

    window.saveTwist =
        saveTwist;

    window.resetTwistEditor =
        resetTwistEditor;

    window.findTwist =
        findTwist;

    window.editTwist =
        editTwist;

    window.deleteTwist =
        deleteTwist;

    window.renderTwists =
        renderTwists;

    window.loadTwists =
        loadTwists;

    window.runTwistEvent =
        runTwistEvent;

})();
