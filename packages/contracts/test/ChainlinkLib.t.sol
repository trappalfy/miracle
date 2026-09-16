// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChainlinkLib} from "../src/ChainlinkLib.sol";
import {ChainlinkLibHarness} from "./mocks/ChainlinkLibHarness.sol";
import {MockFeed} from "./mocks/MockFeed.sol";

contract ChainlinkLibTest is Test {
    ChainlinkLibHarness internal lib;
    MockFeed internal feed;

    int256 internal constant PRICE = 100_00000000; // 100.00 with 8 decimals

    function setUp() public {
        lib = new ChainlinkLibHarness();
        feed = new MockFeed(8);
        vm.warp(1_000);
    }

    function _id(uint16 phase, uint64 aggregatorRound) internal pure returns (uint80) {
        return (uint80(phase) << 64) | uint80(aggregatorRound);
    }

    function _pushRounds(uint256 first, uint256 second, uint256 third) internal {
        feed.push(PRICE, first);
        feed.push(PRICE * 2, second);
        feed.push(PRICE * 3, third);
    }

    // --- the normal path ---

    function test_resolvesFirstRoundAfterTimestamp() public {
        _pushRounds(100, 200, 300);
        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 150, _id(1, 2));
        assertFalse(r.voided);
        assertEq(r.roundId, _id(1, 2));
        assertEq(r.price, 200e18);
    }

    function test_roundInSameSecondDoesNotCount() public {
        // Same second may mean an earlier block: the player could have seen it.
        _pushRounds(100, 200, 300);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotAfterTimestamp.selector, _id(1, 2)));
        lib.resolve(address(feed), 8, 200, _id(1, 2));

        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 200, _id(1, 3));
        assertEq(r.price, 300e18);
    }

    function test_rejectsHintBeforeTimestamp() public {
        _pushRounds(100, 200, 300);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotAfterTimestamp.selector, _id(1, 2)));
        lib.resolve(address(feed), 8, 250, _id(1, 2));
    }

    function test_rejectsLaterRoundThanFirst() public {
        // Round 3 is also after T, but round 2 came first: picking a later,
        // more favourable round is exactly what the second check prevents.
        _pushRounds(100, 200, 300);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, _id(1, 3)));
        lib.resolve(address(feed), 8, 150, _id(1, 3));
    }

    function test_rejectsUnpublishedRound() public {
        _pushRounds(100, 200, 300);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, _id(1, 4)));
        lib.resolve(address(feed), 8, 350, _id(1, 4));

        // The latest round is before T and the grace period has not passed.
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, _id(1, 3)));
        lib.resolve(address(feed), 8, 350, _id(1, 3));
    }

    function test_rejectsRoundInUnknownPhase() public {
        _pushRounds(100, 200, 300);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, _id(2, 1)));
        lib.resolve(address(feed), 8, 150, _id(2, 1));
    }

    // --- a feed that stops publishing ---

    function test_voidsDeadFeedAfterGrace() public {
        _pushRounds(100, 200, 300);
        vm.warp(350 + ChainlinkLib.DEAD_FEED_AFTER);
        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 350, _id(1, 3));
        assertTrue(r.voided);
        assertEq(r.price, 0);
    }

    function test_deadFeedNeedsLatestRoundAsHint() public {
        _pushRounds(100, 200, 300);
        vm.warp(350 + ChainlinkLib.DEAD_FEED_AFTER);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, _id(1, 2)));
        lib.resolve(address(feed), 8, 350, _id(1, 2));
    }

    function test_deadFeedIsNotDeclaredOneSecondEarly() public {
        _pushRounds(100, 200, 300);
        vm.warp(350 + ChainlinkLib.DEAD_FEED_AFTER - 1);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, _id(1, 3)));
        lib.resolve(address(feed), 8, 350, _id(1, 3));
    }

    // --- unusable rounds ---

    function test_voidsNonPositiveAnswer() public {
        feed.push(PRICE, 100);
        feed.push(0, 200);
        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 150, _id(1, 2));
        assertTrue(r.voided);
    }

    function test_voidsUnansweredRound() public {
        feed.push(PRICE, 100);
        feed.pushUnanswered(PRICE, 200);
        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 150, _id(1, 2));
        assertTrue(r.voided);
    }

    // --- phase boundaries: the round before round 1 lives in the previous phase ---

    function test_firstRoundOfNewPhaseAfterBoundary() public {
        feed.push(PRICE, 100);
        feed.push(PRICE, 200);
        feed.startPhase();
        feed.push(PRICE * 4, 400);
        feed.push(PRICE * 5, 500);

        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 300, _id(2, 1));
        assertFalse(r.voided);
        assertEq(r.price, 400e18);
    }

    function test_phaseBoundaryRejectsNewPhaseWhenOldPhaseHadLaterRound() public {
        feed.push(PRICE, 100);
        feed.push(PRICE, 200);
        feed.push(PRICE * 3, 350);
        feed.startPhase();
        feed.push(PRICE * 4, 400);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, _id(2, 1)));
        lib.resolve(address(feed), 8, 300, _id(2, 1));

        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 300, _id(1, 3));
        assertEq(r.price, 300e18);
    }

    function test_phaseBoundarySkipsEmptyPhase() public {
        feed.push(PRICE, 100);
        feed.push(PRICE * 2, 350);
        feed.startPhase(); // phase 2 never published
        feed.startPhase();
        feed.push(PRICE * 4, 400);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, _id(3, 1)));
        lib.resolve(address(feed), 8, 300, _id(3, 1));

        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 360, _id(3, 1));
        assertEq(r.price, 400e18);
    }

    function test_phaseBoundaryWithManyRoundsInOldPhase() public {
        for (uint256 i = 1; i <= 77; i++) {
            feed.push(PRICE, i * 10);
        }
        feed.startPhase();
        feed.push(PRICE * 9, 1_000);

        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 770, _id(2, 1));
        assertEq(r.price, 900e18);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, _id(2, 1)));
        lib.resolve(address(feed), 8, 769, _id(2, 1));
    }

    function test_firstRoundOfFirstPhaseHasNoPredecessor() public {
        _pushRounds(100, 200, 300);
        ChainlinkLib.Resolution memory r = lib.resolve(address(feed), 8, 50, _id(1, 1));
        assertEq(r.price, 100e18);
    }

    // --- helpers ---

    function test_lastRoundInPhase() public {
        uint256[6] memory counts = [uint256(1), 2, 3, 37, 64, 65];
        for (uint256 c; c < counts.length; c++) {
            MockFeed f = new MockFeed(8);
            for (uint256 i; i < counts[c]; i++) {
                f.push(PRICE, 100 + i);
            }
            assertEq(lib.lastRoundInPhase(address(f), 1), counts[c]);
        }
        assertEq(lib.lastRoundInPhase(address(new MockFeed(8)), 1), 0);
        assertEq(lib.lastRoundInPhase(address(feed), 7), 0);
    }

    function test_readRoundTreatsZerosAndRevertsAsMissing() public {
        feed.push(PRICE, 100);
        assertTrue(lib.readRound(address(feed), _id(1, 1)).exists);
        assertFalse(lib.readRound(address(feed), _id(1, 2)).exists);
        assertFalse(lib.readRound(address(feed), _id(1, 0)).exists);
        assertFalse(lib.readRound(address(feed), _id(5, 1)).exists);
    }

    function test_toWadScalesDecimals() public view {
        assertEq(lib.toWad(123_45000000, 8), 123.45e18);
        assertEq(lib.toWad(7e18, 18), 7e18);
        assertEq(lib.toWad(5, 0), 5e18);
    }
}
