/*
 * BIG BROTHER SIMULATOR — EVICTED HOUSEGUEST PORTRAIT CENTERING FIX v3
 *
 * Presentation-only fix.
 *
 * Handles:
 *   1. Normal eviction:
 *      #event-content > .sim-portrait.sim-portrait-large
 *   2. Double eviction:
 *      .eviction-result-portrait > .sim-portrait
 *   3. Any wrapper that contains the eviction portrait.
 *
 * The important fix is that the portrait is a FLEX COLUMN with a fixed
 * 120px width. This prevents the broad #event-content > div { width:100% }
 * rule from making the portrait itself a full-width box.
 */

(function () {
    "use strict";

    function isEvictionEvent() {
        const eventType = document.getElementById("event-type");
        const eventTitle = document.getElementById("event-title");

        const type = String(eventType?.textContent || "").trim().toUpperCase();
        const title = String(eventTitle?.textContent || "").trim().toLowerCase();

        return (
            type === "EVICTION" ||
            title === "eviction" ||
            title.includes("eviction")
        );
    }

    function centerPortrait(portrait) {
        if (!portrait) return;

        /*
         * Override every layout property that can make this box appear
         * shifted or stretched by the simulator's broad event-content rules.
         */
        portrait.style.setProperty("display", "flex", "important");
        portrait.style.setProperty("flex-direction", "column", "important");
        portrait.style.setProperty("align-items", "center", "important");
        portrait.style.setProperty("justify-content", "flex-start", "important");
        portrait.style.setProperty("align-self", "center", "important");
        portrait.style.setProperty("justify-self", "center", "important");

        portrait.style.setProperty("width", "120px", "important");
        portrait.style.setProperty("min-width", "120px", "important");
        portrait.style.setProperty("max-width", "120px", "important");

        portrait.style.setProperty("height", "auto", "important");
        portrait.style.setProperty("margin-left", "auto", "important");
        portrait.style.setProperty("margin-right", "auto", "important");
        portrait.style.setProperty("text-align", "center", "important");
        portrait.style.setProperty("box-sizing", "border-box", "important");

        portrait.style.setProperty("position", "relative", "important");
        portrait.style.setProperty("left", "auto", "important");
        portrait.style.setProperty("right", "auto", "important");
        portrait.style.setProperty("transform", "none", "important");
        portrait.style.setProperty("float", "none", "important");

        const image = portrait.querySelector("img");
        if (image) {
            image.style.setProperty("display", "block", "important");
            image.style.setProperty("width", "120px", "important");
            image.style.setProperty("min-width", "120px", "important");
            image.style.setProperty("max-width", "120px", "important");
            image.style.setProperty("height", "145px", "important");
            image.style.setProperty("min-height", "145px", "important");
            image.style.setProperty("max-height", "145px", "important");
            image.style.setProperty("object-fit", "cover", "important");
            image.style.setProperty("margin", "0 auto 7px", "important");
            image.style.setProperty("transform", "none", "important");
            image.style.setProperty("float", "none", "important");
        }

        const placeholder = portrait.querySelector(".sim-portrait-placeholder");
        if (placeholder) {
            placeholder.style.setProperty("display", "flex", "important");
            placeholder.style.setProperty("width", "120px", "important");
            placeholder.style.setProperty("min-width", "120px", "important");
            placeholder.style.setProperty("max-width", "120px", "important");
            placeholder.style.setProperty("height", "145px", "important");
            placeholder.style.setProperty("min-height", "145px", "important");
            placeholder.style.setProperty("max-height", "145px", "important");
            placeholder.style.setProperty("margin", "0 auto 7px", "important");
            placeholder.style.setProperty("box-sizing", "border-box", "important");
            placeholder.style.setProperty("align-items", "center", "important");
            placeholder.style.setProperty("justify-content", "center", "important");
        }

        /*
         * The name must be part of the same 120px centered column so it
         * cannot drift to the side of the portrait.
         */
        const name = portrait.querySelector(":scope > span");
        if (name) {
            name.style.setProperty("display", "block", "important");
            name.style.setProperty("width", "120px", "important");
            name.style.setProperty("min-width", "120px", "important");
            name.style.setProperty("max-width", "120px", "important");
            name.style.setProperty("margin", "0 auto", "important");
            name.style.setProperty("text-align", "center", "important");
            name.style.setProperty("line-height", "1.2", "important");
            name.style.setProperty("box-sizing", "border-box", "important");
        }
    }

    function centerEvictionWrapper(wrapper) {
        if (!wrapper) return;

        /*
         * This is especially important for the double-eviction markup,
         * where the portrait is inside .eviction-result-portrait.
         */
        wrapper.style.setProperty("width", "100%", "important");
        wrapper.style.setProperty("display", "flex", "important");
        wrapper.style.setProperty("flex-direction", "column", "important");
        wrapper.style.setProperty("align-items", "center", "important");
        wrapper.style.setProperty("justify-content", "center", "important");
        wrapper.style.setProperty("text-align", "center", "important");
        wrapper.style.setProperty("margin-left", "auto", "important");
        wrapper.style.setProperty("margin-right", "auto", "important");
        wrapper.style.setProperty("box-sizing", "border-box", "important");

        wrapper.querySelectorAll(".sim-portrait").forEach(centerPortrait);
    }

    function fixEvictionPortrait() {
        const eventContent = document.getElementById("event-content");
        if (!eventContent || !isEvictionEvent()) return;

        /*
         * Normal eviction: portrait is a direct child of #event-content.
         */
        eventContent.querySelectorAll(":scope > .sim-portrait").forEach(centerPortrait);

        /*
         * Double eviction and any future wrapper-based eviction layout.
         */
        eventContent.querySelectorAll(".eviction-result-portrait").forEach(
            centerEvictionWrapper
        );

        /*
         * Fallback: if an eviction portrait is present but neither of the
         * known structures matched, center any portrait in the event area.
         */
        if (!eventContent.querySelector(".eviction-result-portrait")) {
            eventContent.querySelectorAll(".sim-portrait-large").forEach(
                centerPortrait
            );
        }
    }

    function applyFix() {
        fixEvictionPortrait();

        // showEvent() can replace innerHTML asynchronously.
        setTimeout(fixEvictionPortrait, 0);
        setTimeout(fixEvictionPortrait, 25);
        setTimeout(fixEvictionPortrait, 75);
        setTimeout(fixEvictionPortrait, 150);
        setTimeout(fixEvictionPortrait, 300);
        setTimeout(fixEvictionPortrait, 600);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyFix);
    } else {
        applyFix();
    }

    const eventContent = document.getElementById("event-content");
    if (eventContent) {
        const observer = new MutationObserver(() => {
            if (isEvictionEvent()) fixEvictionPortrait();
        });

        observer.observe(eventContent, {
            childList: true,
            subtree: true
        });
    }

    const eventType = document.getElementById("event-type");
    const eventTitle = document.getElementById("event-title");

    [eventType, eventTitle].forEach(node => {
        if (!node) return;

        const observer = new MutationObserver(applyFix);
        observer.observe(node, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });

    console.log(
        "EVICTED PORTRAIT CENTERING FIX v3 loaded — fixed-width centered portrait column."
    );
})();
