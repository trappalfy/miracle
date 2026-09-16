// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChainlinkLib} from "../src/ChainlinkLib.sol";
import {ChainlinkLibHarness} from "./mocks/ChainlinkLibHarness.sol";

/// @dev Round resolution against the real SPY proxy on Robinhood Chain
/// mainnet, pinned to a block where rounds 129..131 of phase 1 exist.
/// Skipped unless RPC_URL is set.
contract ForkTest is Test {
    address internal constant SPY_FEED = 0x319724394D3A0e3669269846abE664Cd621f9f6A;
    uint256 internal constant PINNED_BLOCK = 64_562_125;

    uint80 internal constant ROUND_129 = (uint80(1) << 64) | 129; // updatedAt 1789458121
    uint80 internal constant ROUND_130 = (uint80(1) << 64) | 130; // updatedAt 1789476942, 761.38125
    uint80 internal constant ROUND_131 = (uint80(1) << 64) | 131; // updatedAt 1789482150

    ChainlinkLibHarness internal lib;

    function setUp() public {
        string memory rpc = vm.envOr("RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc, PINNED_BLOCK);
        lib = new ChainlinkLibHarness();
    }

    function test_resolvesRealRound() public view {
        ChainlinkLib.Resolution memory r = lib.resolve(SPY_FEED, 8, 1_789_458_121, ROUND_130);
        assertFalse(r.voided);
        assertEq(r.roundId, ROUND_130);
        assertEq(r.price, 761.38125e18);
    }

    function test_rejectsLaterRealRound() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, ROUND_131));
        lib.resolve(SPY_FEED, 8, 1_789_458_121, ROUND_131);
    }

    function test_rejectsEarlierRealRound() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotAfterTimestamp.selector, ROUND_129));
        lib.resolve(SPY_FEED, 8, 1_789_458_121, ROUND_129);
    }

    function test_realProxyPhaseShape() public view {
        assertGe(lib.lastRoundInPhase(SPY_FEED, 1), 131);
        assertEq(lib.lastRoundInPhase(SPY_FEED, 2), 0);
        assertFalse(lib.readRound(SPY_FEED, (uint80(1) << 64) | 0).exists);
    }
}
