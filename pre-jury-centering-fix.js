/*
 * BIG BROTHER SIMULATOR — PRE-JURY CENTERING FIX
 *
 * Load this file AFTER jury-boundary-fix.js.
 *
 * Purpose:
 * Center each pre-jury Houseguest's portrait, name, and placement
 * horizontally without changing any simulation logic.
 */

(function () {
    "use strict";

    function centerPreJury() {
        // Target the existing "Pre-Jury Houseguests" section created by
        // the finale jury fix.
        const headings = Array.from(document.querySelectorAll("h3"));

        const heading = headings.find(h =>
            h.textContent.trim().toLowerCase() === "pre-jury houseguests"
        );

        if (!heading) return;

        // The section containing the heading is the most reliable anchor.
        const section = heading.closest("section") || heading.parentElement;
        if (!section) return;

        const grid = section.querySelector(
            'div[style*="grid-template-columns"]'
        );

        if (!grid) return;

        // Center the entire grid.
        grid.style.width = "100%";
        grid.style.marginLeft = "auto";
        grid.style.marginRight = "auto";
        grid.style.justifyItems = "center";
        grid.style.alignItems = "start";

        // Center every individual Houseguest card.
        Array.from(grid.children).forEach(card => {
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.alignItems = "center";
            card.style.justifyContent = "flex-start";
            card.style.textAlign = "center";
            card.style.width = "100%";
            card.style.marginLeft = "auto";
            card.style.marginRight = "auto";

            // Center any portrait wrapper/image produced by the simulator.
            Array.from(card.children).forEach(child => {
                child.style.marginLeft = "auto";
                child.style.marginRight = "auto";
                child.style.textAlign = "center";
            });
        });
    }

    // Run after the results/finale DOM is rendered.
    function apply() {
        centerPreJury();
        setTimeout(centerPreJury, 100);
        setTimeout(centerPreJury, 500);
    }

    // Initial load.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    } else {
        apply();
    }

    // Also watch for the Results page being rendered dynamically.
    const observer = new MutationObserver(() => {
        centerPreJury();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log(
        "PRE-JURY CENTERING FIX loaded — portraits and names centered."
        
    );
})();
