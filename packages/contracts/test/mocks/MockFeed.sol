// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Test double for a Chainlink AggregatorProxy, reproducing the behaviour
/// measured on Robinhood Chain mainnet:
/// - round ids are `(phaseId << 64) | aggregatorRound`, aggregator rounds start at 1;
/// - a missing round inside a known phase returns zeros (no revert);
/// - a round in an unknown phase reverts with empty data.
contract MockFeed {
    struct StoredRound {
        int256 answer;
        uint256 updatedAt;
        bool unanswered;
    }

    uint8 public immutable decimals;
    uint16 public phaseId = 1;

    mapping(uint16 phase => StoredRound[]) private _rounds;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }

    function startPhase() external {
        phaseId++;
    }

    function push(int256 answer, uint256 updatedAt) external returns (uint80) {
        return _push(phaseId, StoredRound(answer, updatedAt, false));
    }

    /// @dev A round whose `answeredInRound` lags its `roundId`.
    function pushUnanswered(int256 answer, uint256 updatedAt) external returns (uint80) {
        return _push(phaseId, StoredRound(answer, updatedAt, true));
    }

    /// @dev Appends to an earlier phase, as an old aggregator still transmitting would.
    function pushToPhase(uint16 phase, int256 answer, uint256 updatedAt) external returns (uint80) {
        return _push(phase, StoredRound(answer, updatedAt, false));
    }

    function roundCount(uint16 phase) external view returns (uint256) {
        return _rounds[phase].length;
    }

    function getRoundData(uint80 roundId) public view returns (uint80, int256, uint256, uint256, uint80) {
        uint16 phase = uint16(roundId >> 64);
        uint64 aggregatorRound = uint64(roundId);
        if (phase == 0 || phase > phaseId) revert();

        StoredRound[] storage rounds = _rounds[phase];
        if (aggregatorRound == 0 || aggregatorRound > rounds.length) {
            uint80 empty = uint80(phase) << 64;
            return (empty, 0, 0, 0, empty);
        }

        StoredRound storage round = rounds[aggregatorRound - 1];
        uint80 answeredInRound = round.unanswered ? roundId - 1 : roundId;
        return (roundId, round.answer, round.updatedAt, round.updatedAt, answeredInRound);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        uint256 count = _rounds[phaseId].length;
        return getRoundData((uint80(phaseId) << 64) | uint80(count));
    }

    function _push(uint16 phase, StoredRound memory round) private returns (uint80) {
        _rounds[phase].push(round);
        return (uint80(phase) << 64) | uint80(_rounds[phase].length);
    }
}
