// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {MiracleGame} from "../src/MiracleGame.sol";

/// @dev Tries to claim twice by re-entering from its receive hook.
contract ReentrantClaimer {
    MiracleGame private immutable _game;
    uint256 private _seasonId;
    bool private _swallowReentryError;
    bool private _reentered;

    constructor(MiracleGame game) {
        _game = game;
    }

    function join(uint256 seasonId) external payable {
        _seasonId = seasonId;
        _game.joinSeason{value: msg.value}(seasonId);
    }

    function open(bytes32 symbol, uint256 notional) external returns (uint256) {
        return _game.openPosition(_seasonId, symbol, true, notional);
    }

    function close(uint256 positionId) external {
        _game.closePosition(_seasonId, positionId);
    }

    function attack(bool swallowReentryError) external {
        _swallowReentryError = swallowReentryError;
        _reentered = false;
        _game.claim(_seasonId);
    }

    receive() external payable {
        if (_reentered) return;
        _reentered = true;
        if (_swallowReentryError) {
            try _game.claim(_seasonId) {} catch {}
        } else {
            _game.claim(_seasonId);
        }
    }
}

contract RankingTest is BaseTest {
    receive() external payable {} // the owner (this contract) collects platform fees

    /// alice +1000, bob +500, carol -500 on 10k SPY longs; trading then ends.
    function _playThreePlayerSeason() internal {
        _join(alice);
        _join(bob);
        _join(carol);
        _toLive();
        _tradeSpy(alice, true, 10_000e18, 110e8);
        _tradeSpy(bob, true, 10_000e18, 105e8);
        _tradeSpy(carol, true, 10_000e18, 95e8);
        _toEnd();
    }

    function _order(address first, address second, address third) internal pure returns (address[] memory list) {
        list = new address[](3);
        list[0] = first;
        list[1] = second;
        list[2] = third;
    }

    function _claim(address who) internal returns (uint256 received) {
        uint256 before = who.balance;
        vm.prank(who);
        game.claim(seasonId);
        received = who.balance - before;
    }

    // --- brief §9.1: joinSeason accounts the fee ---

    function test_joinAccountsFeeIntoPool() public {
        vm.expectEmit(address(game));
        emit MiracleGame.Joined(seasonId, alice, FEE);
        _join(alice);
        _join(bob);
        _join(carol);

        assertEq(_season().prizePool, 3 ether);
        assertEq(address(game).balance, 3 ether);
        assertEq(alice.balance, 1_000 ether - FEE);
    }

    // --- brief §9.2: submitRanking rejects a wrong order and duplicates ---

    function test_rankingRejectsWrongOrder() public {
        _playThreePlayerSeason();
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.RankingOrderViolated.selector, 1));
        game.submitRanking(seasonId, _order(bob, alice, carol));

        vm.expectRevert(abi.encodeWithSelector(MiracleGame.RankingOrderViolated.selector, 2));
        game.submitRanking(seasonId, _order(alice, carol, bob));
    }

    function test_rankingRejectsDuplicates() public {
        _playThreePlayerSeason();
        // One winner submitted many times is the attack the bitmap exists for.
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.DuplicatePlayer.selector, alice));
        game.submitRanking(seasonId, _order(alice, alice, alice));

        vm.expectRevert(abi.encodeWithSelector(MiracleGame.DuplicatePlayer.selector, alice));
        game.submitRanking(seasonId, _order(alice, alice, bob));
    }

    function test_rankingRejectsWrongLength() public {
        _playThreePlayerSeason();
        address[] memory two = new address[](2);
        two[0] = alice;
        two[1] = bob;
        vm.expectRevert(MiracleGame.RankingLengthMismatch.selector);
        game.submitRanking(seasonId, two);
    }

    function test_rankingRejectsNonParticipant() public {
        _playThreePlayerSeason();
        address dave = makeAddr("dave");
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.NotParticipant.selector, dave));
        game.submitRanking(seasonId, _order(alice, bob, dave));
    }

    function test_rankingRejectsUnsettledPositions() public {
        _join(alice);
        _join(bob);
        _toLive();
        _open(bob, SPY, true, 1_000e18);
        _toEnd();

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.UnsettledPositions.selector, bob));
        game.submitRanking(seasonId, list);
    }

    function test_rankingRejectsBeforeTradingEnds() public {
        _join(alice);
        _toLive();
        address[] memory list = new address[](1);
        list[0] = alice;
        vm.expectRevert(
            abi.encodeWithSelector(MiracleGame.WrongPhase.selector, MiracleGame.Phase.Settling, MiracleGame.Phase.Live)
        );
        game.submitRanking(seasonId, list);
    }

    function test_firstValidRankingWins() public {
        _playThreePlayerSeason();
        vm.expectEmit(address(game));
        emit MiracleGame.RankingSubmitted(seasonId, bob);
        vm.prank(bob);
        game.submitRanking(seasonId, _order(alice, bob, carol));

        assertEq(uint8(_season().phase), uint8(MiracleGame.Phase.Settled));
        address[] memory ranking = game.getRanking(seasonId);
        assertEq(ranking.length, 3);
        assertEq(ranking[0], alice);
        assertEq(ranking[2], carol);

        vm.expectRevert(
            abi.encodeWithSelector(
                MiracleGame.WrongPhase.selector, MiracleGame.Phase.Settling, MiracleGame.Phase.Settled
            )
        );
        game.submitRanking(seasonId, _order(alice, bob, carol));
    }

    // --- brief §9.3: claim pays the right amount ---

    function test_claimPaysCurveShare() public {
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _curve3(5_000, 3_000, 2_000));
        _playThreePlayerSeason();
        game.submitRanking(seasonId, _order(alice, bob, carol));

        assertEq(game.claimableOf(seasonId, alice), 1.5 ether);
        assertEq(game.claimableOf(seasonId, bob), 0.9 ether);
        assertEq(game.claimableOf(seasonId, carol), 0.6 ether);
        assertEq(_player(alice).rank, 1);
        assertEq(_player(bob).rank, 2);
        assertEq(_player(carol).rank, 3);

        vm.expectEmit(address(game));
        emit MiracleGame.Claimed(seasonId, alice, 1.5 ether);
        assertEq(_claim(alice), 1.5 ether);
        assertEq(_claim(bob), 0.9 ether);
        assertEq(_claim(carol), 0.6 ether);

        assertEq(_season().paidOut, 3 ether);
        assertEq(address(game).balance, 0);
        assertEq(game.claimableOf(seasonId, alice), 0);
    }

    // --- brief §9.4: claim cannot be called twice ---

    function test_claimTwiceReverts() public {
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _curve3(5_000, 3_000, 2_000));
        _playThreePlayerSeason();
        game.submitRanking(seasonId, _order(alice, bob, carol));

        _claim(alice);
        vm.prank(alice);
        vm.expectRevert(MiracleGame.NothingToClaim.selector);
        game.claim(seasonId);
        assertEq(address(game).balance, 1.5 ether);
    }

    function test_claimRejectsBeforeRanking() public {
        _playThreePlayerSeason();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MiracleGame.WrongPhase.selector, MiracleGame.Phase.Settled, MiracleGame.Phase.Settling
            )
        );
        game.claim(seasonId);
    }

    function test_playerOutsidePaidPlacesHasNothingToClaim() public {
        uint16[] memory winnerTakesAll = new uint16[](1);
        winnerTakesAll[0] = 10_000;
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, winnerTakesAll);
        _playThreePlayerSeason();
        game.submitRanking(seasonId, _order(alice, bob, carol));

        assertEq(_claim(alice), 3 ether);
        vm.prank(bob);
        vm.expectRevert(MiracleGame.NothingToClaim.selector);
        game.claim(seasonId);
    }

    // --- payout curve details ---

    function test_fewerPlayersThanPlacesRenormalises() public {
        _join(alice);
        _join(bob);
        _toLive();
        _tradeSpy(alice, true, 10_000e18, 110e8);
        _toEnd();

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        game.submitRanking(seasonId, list);

        // Top-10 curve over two players: 2500 and 1800 out of 4300.
        assertEq(game.claimableOf(seasonId, alice), uint256(2 ether) * 2_500 / 4_300);
        assertEq(game.claimableOf(seasonId, bob), uint256(2 ether) * 1_800 / 4_300);
        assertLe(game.claimableOf(seasonId, alice) + game.claimableOf(seasonId, bob), 2 ether);
    }

    function test_tiesSplitEqually() public {
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _curve3(5_000, 3_000, 2_000));
        _join(alice);
        _join(bob);
        _join(carol);
        _toEnd();

        game.submitRanking(seasonId, _order(carol, alice, bob));

        assertEq(game.claimableOf(seasonId, alice), 1 ether);
        assertEq(game.claimableOf(seasonId, bob), 1 ether);
        assertEq(game.claimableOf(seasonId, carol), 1 ether);
        assertEq(_player(alice).rank, 1);
        assertEq(_player(carol).rank, 1);
    }

    function test_partialTieSharesItsPlaces() public {
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _curve3(5_000, 3_000, 2_000));
        _join(alice);
        _join(bob);
        _join(carol);
        _toLive();
        _tradeSpy(alice, true, 10_000e18, 110e8);
        _toEnd();

        // bob and carol are tied; either order is accepted and pays the same.
        game.submitRanking(seasonId, _order(alice, carol, bob));

        assertEq(game.claimableOf(seasonId, alice), 1.5 ether);
        assertEq(game.claimableOf(seasonId, bob), 0.75 ether);
        assertEq(game.claimableOf(seasonId, carol), 0.75 ether);
        assertEq(_player(bob).rank, 2);
        assertEq(_player(carol).rank, 2);
    }

    function test_feeGoesToOwner() public {
        uint16[] memory winnerTakesAll = new uint16[](1);
        winnerTakesAll[0] = 10_000;
        seasonId = _createSeason(FEE, MAX_PLAYERS, 1_000, winnerTakesAll);
        _playThreePlayerSeason();
        game.submitRanking(seasonId, _order(alice, bob, carol));

        assertEq(game.claimableOf(seasonId, address(this)), 0.3 ether);
        assertEq(game.claimableOf(seasonId, alice), 2.7 ether);

        uint256 before = address(this).balance;
        game.claim(seasonId);
        assertEq(address(this).balance - before, 0.3 ether);
    }

    function test_emptySeasonCanBeRanked() public {
        _toEnd();
        game.submitRanking(seasonId, new address[](0));
        assertEq(uint8(_season().phase), uint8(MiracleGame.Phase.Settled));
        assertEq(game.getRanking(seasonId).length, 0);
    }

    // --- career score ---

    function test_scoresUpdateFromPercentile() public {
        _playThreePlayerSeason();
        game.submitRanking(seasonId, _order(alice, bob, carol));

        // Percentiles 100 / 50 / 0, averaged with the previous score of 0.
        assertEq(game.scoreOf(alice), 50);
        assertEq(game.scoreOf(bob), 25);
        assertEq(game.scoreOf(carol), 0);

        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _topTen());
        _join(alice);
        MiracleGame.PlayerView memory p = _player(alice);
        assertEq(p.score, 50);
        assertEq(p.leverageBps, 65_000);
        assertEq(p.aumCapacity, 650_000e18);
    }

    function test_tiedPlayersShareAveragePercentile() public {
        _join(alice);
        _join(bob);
        _join(carol);
        _toEnd();
        game.submitRanking(seasonId, _order(alice, bob, carol));
        // Everyone tied: average place is the middle, percentile 50.
        assertEq(game.scoreOf(alice), 25);
        assertEq(game.scoreOf(carol), 25);
    }

    function test_singlePlayerSeasonKeepsScore() public {
        _join(alice);
        _toEnd();
        address[] memory list = new address[](1);
        list[0] = alice;
        game.submitRanking(seasonId, list);

        assertEq(game.scoreOf(alice), 0);
        assertEq(_claim(alice), FEE);
    }

    // --- brief §9: claim is reentrancy-safe ---

    function test_claimReentrancyBlocked() public {
        // Other players' money sits in the contract too: a second payout would
        // be funded by them, not fail for lack of balance.
        uint256 otherSeason = _createSeason(FEE, MAX_PLAYERS, 0, _topTen());
        vm.prank(bob);
        game.joinSeason{value: FEE}(otherSeason);
        vm.prank(carol);
        game.joinSeason{value: FEE}(otherSeason);

        uint16[] memory winnerTakesAll = new uint16[](1);
        winnerTakesAll[0] = 10_000;
        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, winnerTakesAll);

        ReentrantClaimer attacker = new ReentrantClaimer(game);
        attacker.join{value: FEE}(seasonId);
        _join(alice);
        _toLive();
        attacker.open(SPY, 10_000e18);
        uint80 entry = _publish(spy, 100e8);
        attacker.close(0);
        uint80 exit = _publish(spy, 120e8);
        game.settlePosition(seasonId, address(attacker), 0, entry, exit);
        _toEnd();

        address[] memory list = new address[](2);
        list[0] = address(attacker);
        list[1] = alice;
        game.submitRanking(seasonId, list);

        // Re-entering makes the whole payout fail rather than pay twice.
        vm.expectRevert(MiracleGame.TransferFailed.selector);
        attacker.attack(false);
        assertEq(address(game).balance, 4 ether);

        // Swallowing the inner failure only gets the single payout.
        attacker.attack(true);
        assertEq(address(attacker).balance, 2 ether);
        assertEq(address(game).balance, 2 ether);
        assertEq(_season().paidOut, 2 ether);

        vm.expectRevert(MiracleGame.NothingToClaim.selector);
        attacker.attack(true);
    }

    // --- brief §9 invariant: payouts never exceed the pool ---

    /// forge-config: default.fuzz.runs = 256
    function testFuzz_payoutsNeverExceedPool(uint8 playerSeed, uint8 placesSeed, uint16 feeSeed, uint256 seed)
        public
    {
        uint256 players = 1 + uint256(playerSeed) % 40;
        uint256 entryFee = 1 + seed % 3 ether;
        uint16 feeBps = uint16(feeSeed % 2_001);
        uint16[] memory curve = _randomCurve(1 + uint256(placesSeed) % 12, seed);

        seasonId = _createSeason(entryFee, uint32(players), feeBps, curve);

        address[] memory everyone = new address[](players);
        for (uint256 i; i < players; ++i) {
            everyone[i] = address(uint160(0x10000 + i));
            vm.deal(everyone[i], entryFee);
            vm.prank(everyone[i]);
            game.joinSeason{value: entryFee}(seasonId);
        }

        _toLive();
        int16[6] memory exits = [int16(90), 95, 100, 105, 110, -1];
        for (uint256 i; i < players; ++i) {
            int16 exitPrice = exits[uint256(keccak256(abi.encode(seed, i))) % exits.length];
            if (exitPrice < 0) continue; // sits the season out
            _tradeSpy(everyone[i], i % 2 == 0, 10_000e18 + i * 1e18, int256(exitPrice) * 1e8);
        }
        _toEnd();

        game.submitRanking(seasonId, _sortByEquity(everyone));

        uint256 claimed;
        for (uint256 i; i < players; ++i) {
            if (game.claimableOf(seasonId, everyone[i]) == 0) continue;
            claimed += _claim(everyone[i]);
        }
        if (game.claimableOf(seasonId, address(this)) > 0) {
            uint256 before = address(this).balance;
            game.claim(seasonId);
            claimed += address(this).balance - before;
        }

        MiracleGame.SeasonView memory s = _season();
        assertEq(s.prizePool, entryFee * players);
        assertLe(s.paidOut, s.prizePool);
        assertEq(claimed, s.paidOut);
        assertEq(address(game).balance, s.prizePool - s.paidOut);
        // Only rounding dust may stay behind.
        assertLe(s.prizePool - s.paidOut, 1 + curve.length + players);
    }

    function _randomCurve(uint256 places, uint256 seed) internal pure returns (uint16[] memory curve) {
        uint256[] memory weights = new uint256[](places);
        uint256 total;
        for (uint256 i; i < places; ++i) {
            weights[i] = 100 + uint256(keccak256(abi.encode(seed, "curve", i))) % 901;
            total += weights[i];
        }
        // Non-increasing: sort descending.
        for (uint256 i = 1; i < places; ++i) {
            for (uint256 j = i; j > 0 && weights[j] > weights[j - 1]; --j) {
                (weights[j], weights[j - 1]) = (weights[j - 1], weights[j]);
            }
        }
        curve = new uint16[](places);
        uint256 sum;
        for (uint256 i; i < places; ++i) {
            curve[i] = uint16(weights[i] * 10_000 / total);
            sum += curve[i];
        }
        curve[0] += uint16(10_000 - sum);
    }

    function _sortByEquity(address[] memory list) internal view returns (address[] memory sorted) {
        sorted = new address[](list.length);
        uint256[] memory equities = new uint256[](list.length);
        for (uint256 i; i < list.length; ++i) {
            uint256 equity = game.equityOf(seasonId, list[i]);
            uint256 j = i;
            while (j > 0 && equities[j - 1] < equity) {
                sorted[j] = sorted[j - 1];
                equities[j] = equities[j - 1];
                --j;
            }
            sorted[j] = list[i];
            equities[j] = equity;
        }
    }
}
