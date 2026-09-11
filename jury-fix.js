/*
 * =========================================================
 * JURY FIX
 * =========================================================
 *
 * Jury Size 9:
 * 3rd through 11th place = 9 jurors.
 *
 * Jury membership is determined ONLY by placement.
 * Status is deliberately ignored.
 * =========================================================
 */

(function () {

    function getCorrectJuryMembers() {

        if (!window.currentSeason) {
            return [];
        }

        const jurySize = Math.max(
            0,
            Number(
                window.currentSeason.rules?.jurySize ?? 7
            )
        );

        if (jurySize === 0) {
            return [];
        }

        // Jury starts at 3rd place.
        // Example:
        // Jury Size 9 = 3rd through 11th.
        const highestJurorPlacement = 2 + jurySize;

        return (window.currentSeason.houseguests || [])
            .filter(player => {

                const placement =
                    Number(player.placement);

                return (
                    Number.isFinite(placement) &&
                    placement >= 3 &&
                    placement <= highestJurorPlacement
                );
            })
            .sort((a, b) =>
                Number(a.placement) -
                Number(b.placement)
            )
            .slice(0, jurySize)
            .map(player => player.id);
    }


    /*
     * Keep the jury synchronized immediately before
     * the simulator performs finale voting.
     */
    const originalRunNextEvent =
        window.runNextEvent;

    if (typeof originalRunNextEvent === "function") {

        window.runNextEvent = function () {

            const sim =
                window.currentSeason?.simulation;

            if (
                sim &&
                (
                    sim.currentPhase === "finale" ||
                    sim.finaleStarted
                )
            ) {

                const chain =
                    typeof window.getFinaleChain === "function"
                        ? window.getFinaleChain()
                        : [];

                const index =
                    Number(sim.currentEventIndex || 0);

                const event =
                    chain[index];

                if (
                    event &&
                    event.key === "jury-voting"
                ) {
                    sim.jury =
                        getCorrectJuryMembers();
                }
            }

            return originalRunNextEvent.apply(
                this,
                arguments
            );
        };
    }


    /*
     * Also expose the corrected function for debugging
     * and other simulator components.
     */
    window.getCorrectJuryMembers =
        getCorrectJuryMembers;

})();
