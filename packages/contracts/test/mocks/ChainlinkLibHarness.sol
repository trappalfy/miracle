// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ChainlinkLib} from "../../src/ChainlinkLib.sol";

/// @dev Exposes the library's internal functions so tests can call them.
contract ChainlinkLibHarness {
    function resolve(address feed, uint8 decimals, uint256 timestamp, uint80 hint)
        external
        view
        returns (ChainlinkLib.Resolution memory)
    {
        return ChainlinkLib.resolveFirstRoundAfter(feed, decimals, timestamp, hint);
    }

    function lastRoundInPhase(address feed, uint16 phase) external view returns (uint64) {
        return ChainlinkLib.lastRoundInPhase(feed, phase);
    }

    function readRound(address feed, uint80 roundId) external view returns (ChainlinkLib.Round memory) {
        return ChainlinkLib.readRound(feed, roundId);
    }

    function toWad(int256 answer, uint8 decimals) external pure returns (uint256) {
        return ChainlinkLib.toWad(answer, decimals);
    }
}
