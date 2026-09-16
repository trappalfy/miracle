// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function getRoundData(uint80 roundId)
        external
        view
        returns (uint80 roundId_, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title ChainlinkLib
/// @notice Reads Chainlink proxies and answers one question: which round was
/// the first one published after a given moment, and at what price.
///
/// Miracle never prices anything at "now". A position's entry is the first
/// round published after it was opened and its exit the first round after it
/// was closed (or after the season ended), so nobody can trade on a price they
/// have already seen. That also makes a heartbeat check pointless here: the
/// round is fixed by the moment, not by how fresh the feed looks.
///
/// "After" is strict. Blocks here are ~0.1s apart but timestamps move in whole
/// seconds, so a round sharing the opening transaction's second may have landed
/// in an earlier block — visible to the player before they opened.
///
/// Proxy facts this relies on, measured on Robinhood Chain mainnet:
/// - round ids are `(phaseId << 64) | aggregatorRound`; aggregator rounds
///   start at 1 and are contiguous within a phase;
/// - a missing round in a known phase comes back as zeros, not a revert;
/// - a round in an unknown phase reverts;
/// - aggregators are access controlled, so every read goes through the proxy.
library ChainlinkLib {
    uint8 internal constant PHASE_OFFSET = 64;

    /// @notice How long a feed may publish nothing after a moment before a
    /// position depending on that moment is voided instead of left unsettleable.
    uint256 internal constant DEAD_FEED_AFTER = 7 days;

    struct Round {
        bool exists;
        uint80 roundId;
        int256 answer;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    struct Resolution {
        /// True when the feed produced no usable round: the position carries no PnL.
        bool voided;
        uint80 roundId;
        /// Price scaled to 1e18. Zero when voided.
        uint256 price;
    }

    /// The hinted round does not exist, or no round after the moment has been published yet.
    error RoundNotPublished(uint80 hint);
    /// The hinted round was published at or before the moment.
    error HintNotAfterTimestamp(uint80 hint);
    /// A round before the hinted one was already after the moment.
    error HintNotFirstAfterTimestamp(uint80 hint);

    function readRound(address feed, uint80 roundId) internal view returns (Round memory round) {
        try AggregatorV3Interface(feed).getRoundData(roundId) returns (
            uint80 returnedId, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound
        ) {
            if (returnedId == roundId && updatedAt != 0) {
                round = Round(true, returnedId, answer, updatedAt, answeredInRound);
            }
        } catch {}
    }

    /// @notice The validity checks a round must pass before its price is used.
    function isUsable(Round memory round) internal pure returns (bool) {
        return round.exists && round.answer > 0 && round.answeredInRound >= round.roundId;
    }

    /// @notice Scales a positive feed answer to 1e18. Feeds with more than 18 decimals are not listed.
    function toWad(int256 answer, uint8 decimals) internal pure returns (uint256) {
        return uint256(answer) * 10 ** (18 - decimals);
    }

    /// @notice Verifies that `hint` is the first round published after
    /// `timestamp` and returns its price.
    ///
    /// Both checks are required: `hint` must be after the moment, and the
    /// round before it must not be. Either alone lets a caller pick any later
    /// round with a better price.
    ///
    /// Voids instead of reverting when the result could otherwise never be
    /// settled: the round is unusable, or the feed has published nothing for
    /// `DEAD_FEED_AFTER` (proved by passing the latest round as `hint`).
    function resolveFirstRoundAfter(address feed, uint8 decimals, uint256 timestamp, uint80 hint)
        internal
        view
        returns (Resolution memory)
    {
        Round memory round = readRound(feed, hint);

        if (!round.exists || round.updatedAt <= timestamp) {
            (uint80 latestId,,, uint256 latestUpdatedAt,) = AggregatorV3Interface(feed).latestRoundData();
            if (latestUpdatedAt > timestamp) {
                if (!round.exists) revert RoundNotPublished(hint);
                revert HintNotAfterTimestamp(hint);
            }
            if (hint == latestId && block.timestamp >= timestamp + DEAD_FEED_AFTER) {
                return Resolution({voided: true, roundId: hint, price: 0});
            }
            revert RoundNotPublished(hint);
        }

        if (_previousUpdatedAt(feed, hint) > timestamp) revert HintNotFirstAfterTimestamp(hint);

        if (!isUsable(round)) return Resolution({voided: true, roundId: hint, price: 0});
        return Resolution({voided: false, roundId: hint, price: toWad(round.answer, decimals)});
    }

    /// @notice Last aggregator round of `phase`, or 0 if the phase has none.
    /// Gallops then bisects on round existence: O(log n) proxy reads.
    function lastRoundInPhase(address feed, uint16 phase) internal view returns (uint64) {
        if (!readRound(feed, _roundId(phase, 1)).exists) return 0;

        uint64 lo = 1;
        uint64 hi = 2;
        while (readRound(feed, _roundId(phase, hi)).exists) {
            lo = hi;
            hi = hi << 1;
        }
        while (hi - lo > 1) {
            uint64 mid = lo + (hi - lo) / 2;
            if (readRound(feed, _roundId(phase, mid)).exists) lo = mid;
            else hi = mid;
        }
        return lo;
    }

    /// @dev `updatedAt` of the round published just before `roundId`, or 0 if
    /// there is none. Within a phase that is `roundId - 1`. For the first
    /// round of a phase it is the last round of the nearest earlier phase that
    /// published anything — `roundId - 1` would point at round 0, which does
    /// not exist.
    function _previousUpdatedAt(address feed, uint80 roundId) private view returns (uint256) {
        uint16 phase = uint16(roundId >> PHASE_OFFSET);
        uint64 aggregatorRound = uint64(roundId);
        if (aggregatorRound > 1) return readRound(feed, roundId - 1).updatedAt;

        for (uint16 p = phase; p > 1;) {
            --p;
            uint64 last = lastRoundInPhase(feed, p);
            if (last != 0) return readRound(feed, _roundId(p, last)).updatedAt;
        }
        return 0;
    }

    function _roundId(uint16 phase, uint64 aggregatorRound) private pure returns (uint80) {
        return (uint80(phase) << PHASE_OFFSET) | uint80(aggregatorRound);
    }
}
