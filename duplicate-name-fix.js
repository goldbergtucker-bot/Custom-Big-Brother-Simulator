/*
 * Big Brother Simulator — Duplicate Houseguest Name Fix
 *
 * Fixes the creator/editor issue where each houseguest's name appears
 * twice in the card header.
 *
 * The original app.js updates BOTH:
 *   .houseguest-number
 *   .houseguest-display-name
 * to the guest's name.
 *
 * This file keeps the first line as "Houseguest 1", "Houseguest 2", etc.
 * and leaves the second line as the actual guest name.
 *
 * IMPORTANT:
 * Load this file AFTER app.js in index.html.
 */

(function () {
    "use strict";

    function fixHouseguestCardNames() {
        const cards = document.querySelectorAll(".houseguest-card");

        cards.forEach((card, index) => {
            const number = card.querySelector(".houseguest-number");
            const display = card.querySelector(".houseguest-display-name");

            if (number) {
                number.textContent = `Houseguest ${index + 1}`;
            }

            // Do not remove or replace the actual display name.
            // It is populated from the first/last name fields by app.js.
            if (display) {
                const first = card.querySelector(
                    `input[id^="houseguest-first-name-"]`
                );
                const last = card.querySelector(
                    `input[id^="houseguest-last-name-"]`
                );

                const firstName = first ? first.value.trim() : "";
                const lastName = last ? last.value.trim() : "";
                const fullName = [firstName, lastName]
                    .filter(Boolean)
                    .join(" ");

                display.textContent = fullName || "Unnamed Houseguest";
            }
        });
    }

    /*
     * Replace the problematic global function from app.js.
     * This keeps all of its useful live-name updating behavior while
     * preventing the houseguest-number heading from becoming the name.
     */
    window.syncLiveHouseguestNames = function (id) {
        const editor = document.getElementById("houseguest-editor");
        if (!editor) return;

        const cards = editor.querySelectorAll(".houseguest-card");

        cards.forEach((card, index) => {
            const number = card.querySelector(".houseguest-number");
            const display = card.querySelector(".houseguest-display-name");

            if (number) {
                number.textContent = `Houseguest ${index + 1}`;
            }

            if (display) {
                const first = card.querySelector(
                    `input[id^="houseguest-first-name-"]`
                );
                const last = card.querySelector(
                    `input[id^="houseguest-last-name-"]`
                );

                const firstName = first ? first.value.trim() : "";
                const lastName = last ? last.value.trim() : "";
                const fullName = [firstName, lastName]
                    .filter(Boolean)
                    .join(" ");

                display.textContent = fullName || "Unnamed Houseguest";
            }
        });

        // Keep the relationship and alliance labels synchronized.
        const liveGuests = Array.from(cards).map((card, index) => {
            const idValue = card.dataset.houseguestId || `hg-${index + 1}`;
            const first = card.querySelector(
                `input[id^="houseguest-first-name-"]`
            );
            const last = card.querySelector(
                `input[id^="houseguest-last-name-"]`
            );

            return {
                id: idValue,
                name: [first?.value?.trim(), last?.value?.trim()]
                    .filter(Boolean)
                    .join(" ")
            };
        });

        const guestsById = new Map(liveGuests.map(g => [g.id, g]));

        ["relationship-from", "relationship-to"].forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const selected = select.value;

            select.querySelectorAll("option[value]").forEach(option => {
                const guest = guestsById.get(option.value);
                if (guest) {
                    option.textContent =
                        guest.name ||
                        `Houseguest ${liveGuests.findIndex(
                            h => h.id === guest.id
                        ) + 1}`;
                }
            });

            if (selected) select.value = selected;
        });

        const picker = document.getElementById("alliance-member-picker");
        if (picker) {
            picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const guest = guestsById.get(cb.value);
                const label = cb.closest("label");
                const span = label?.querySelector("span");

                if (guest && span) {
                    span.textContent =
                        guest.name ||
                        `Houseguest ${liveGuests.findIndex(
                            h => h.id === guest.id
                        ) + 1}`;
                }
            });
        }

        fixHouseguestCardNames();
    };

    /*
     * Make sure the correction is applied when the creator is first
     * populated, when a saved season is loaded, and after cards are added.
     */
    function runFix() {
        fixHouseguestCardNames();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runFix);
    } else {
        runFix();
    }

    /*
     * Observe the editor for cards being added/rebuilt by app.js.
     * A small delay prevents this observer from fighting with app.js
     * while it is still constructing a card.
     */
    const editor = document.getElementById("houseguest-editor");

    if (editor) {
        const observer = new MutationObserver(() => {
            requestAnimationFrame(fixHouseguestCardNames);
        });

        observer.observe(editor, {
            childList: true,
            subtree: true
        });
    }

    /*
     * Expose a manual repair function in case the simulator is already
     * open when this script is installed.
     */
    window.fixDuplicateHouseguestNames = fixHouseguestCardNames;
})();
