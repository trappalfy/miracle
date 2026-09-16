// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {MiracleGame} from "../src/MiracleGame.sol";
import {ChainlinkLib} from "../src/ChainlinkLib.sol";
import {MockFeed} from "./mocks/MockFeed.sol";

contract MiracleGameTest is BaseTest {
    // --- configuration ---

    function test_onlyOwnerListsAndCreates() public {
        vm.startPrank(alice);
        vm.expectRevert(MiracleGame.NotOwner.selector);
        game.listAsset("ETH", address(spy), 10_000, true);

        uint64 now_ = uint64(block.timestamp);
        vm.expectRevert(MiracleGame.NotOwner.selector);
        game.createSeason(FEE, now_, now_ + 1, now_ + 2, CAPITAL, 10, 0, _topTen());

        vm.expectRevert(MiracleGame.NotOwner.selector);
        game.transferOwnership(alice);
        vm.stopPrank();
    }

    function test_transferOwnership() public {
        game.transferOwnership(alice);
        assertEq(game.owner(), alice);

        vm.expectRevert(MiracleGame.NotOwner.selector);
        game.listAsset("ETH", address(spy), 10_000, true);

        vm.prank(alice);
        vm.expectRevert(MiracleGame.ZeroAddress.selector);
        game.transferOwnership(address(0));
    }

    function test_assetCannotBeRelisted() public {
        // Otherwise the owner could swap a feed under open positions.
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.AssetAlreadyListed.selector, SPY));
        game.listAsset(SPY, address(btc), 5_000, false);
    }

    function test_listAssetValidates() public {
        vm.expectRevert(MiracleGame.InvalidAsset.selector);
        game.listAsset(bytes32(0), address(spy), 10_000, false);

        vm.expectRevert(MiracleGame.InvalidAsset.selector);
        game.listAsset("ETH", alice, 10_000, false);

        vm.expectRevert(MiracleGame.InvalidAsset.selector);
        game.listAsset("ETH", address(spy), 0, false);

        MockFeed wide = new MockFeed(19);
        vm.expectRevert(MiracleGame.InvalidAsset.selector);
        game.listAsset("ETH", address(wide), 10_000, false);
    }

    function test_getAssetsListsEverything() public view {
        MiracleGame.AssetView[] memory assets = game.getAssets();
        assertEq(assets.length, 2);
        assertEq(assets[0].symbol, SPY);
        assertEq(assets[0].feed, address(spy));
        assertEq(assets[0].riskWeightBps, 10_000);
        assertFalse(assets[0].alwaysOpen);
        assertEq(assets[0].decimals, 8);
        assertEq(assets[1].symbol, BTC);
        assertEq(assets[1].riskWeightBps, 20_000);
        assertTrue(assets[1].alwaysOpen);
    }

    function test_rejectsInvalidSeasonParams() public {
        uint64 t = uint64(block.timestamp);
        uint16[] memory curve = _topTen();

        vm.expectRevert(MiracleGame.InvalidSeason.selector); // entry closes before it opens
        game.createSeason(FEE, t + 10, t + 10, t + 20, CAPITAL, 10, 0, curve);

        vm.expectRevert(MiracleGame.InvalidSeason.selector); // trading ends before entry closes
        game.createSeason(FEE, t, t + 20, t + 20, CAPITAL, 10, 0, curve);

        vm.warp(t + 100);
        vm.expectRevert(MiracleGame.InvalidSeason.selector); // already over
        game.createSeason(FEE, t, t + 20, t + 50, CAPITAL, 10, 0, curve);
        vm.warp(t);

        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, 0, 10, 0, curve);

        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, 1e30 + 1, 10, 0, curve);

        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 0, 0, curve);

        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 2_001, curve);

        vm.expectRevert(MiracleGame.InvalidSeason.selector); // sums to 9000
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 0, _curve3(5_000, 2_000, 2_000));

        vm.expectRevert(MiracleGame.InvalidSeason.selector); // increasing
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 0, _curve3(2_000, 5_000, 3_000));

        vm.expectRevert(MiracleGame.InvalidSeason.selector); // zero share
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 0, _curve3(10_000, 0, 0));

        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 0, new uint16[](0));

        uint16[] memory tooMany = new uint16[](101);
        vm.expectRevert(MiracleGame.InvalidSeason.selector);
        game.createSeason(FEE, t, t + 1, t + 2, CAPITAL, 10, 0, tooMany);
    }

    function test_seasonIdsStartAtOne() public {
        assertEq(seasonId, 1);
        assertEq(game.seasonCount(), 1);
        assertEq(_createSeason(FEE, 10, 0, _topTen()), 2);
        assertEq(game.seasonCount(), 2);

        vm.expectRevert(MiracleGame.SeasonNotFound.selector);
        game.getSeason(0);
        vm.expectRevert(MiracleGame.SeasonNotFound.selector);
        game.getSeason(3);
    }

    function test_getSeasonMirrorsParams() public view {
        MiracleGame.SeasonView memory s = _season();
        assertEq(s.id, 1);
        assertEq(uint8(s.phase), uint8(MiracleGame.Phase.Entry));
        assertEq(s.entryFee, FEE);
        assertEq(s.prizePool, 0);
        assertEq(s.startingCapital, CAPITAL);
        assertEq(s.entryOpensAt, block.timestamp);
        assertEq(s.entryClosesAt, block.timestamp + 1 days);
        assertEq(s.tradingEndsAt, block.timestamp + 8 days);
        assertEq(s.participants, 0);
        assertEq(s.maxParticipants, MAX_PLAYERS);
        assertEq(s.feeBps, 0);
        assertEq(s.payoutBps.length, 10);
        assertEq(s.payoutBps[0], 2_500);
    }

    function test_phasesFollowTime() public {
        uint64 t = uint64(block.timestamp);
        uint256 id = game.createSeason(FEE, t + 100, t + 200, t + 300, CAPITAL, 10, 0, _topTen());

        assertEq(uint8(game.getSeason(id).phase), uint8(MiracleGame.Phase.Upcoming));
        vm.warp(t + 100);
        assertEq(uint8(game.getSeason(id).phase), uint8(MiracleGame.Phase.Entry));
        vm.warp(t + 200);
        assertEq(uint8(game.getSeason(id).phase), uint8(MiracleGame.Phase.Live));
        vm.warp(t + 300);
        assertEq(uint8(game.getSeason(id).phase), uint8(MiracleGame.Phase.Settling));
    }

    // --- joining ---

    function test_joinRecordsIndexScoreAndLeverage() public {
        _join(alice);
        _join(bob);

        MiracleGame.PlayerView memory p = _player(bob);
        assertTrue(p.joined);
        assertEq(p.index, 1);
        assertEq(p.score, 0);
        assertEq(p.leverageBps, 30_000);
        assertEq(p.equity, CAPITAL);
        assertEq(p.aumCapacity, 300_000e18);
        assertEq(p.positionCount, 0);

        assertEq(_season().participants, 2);
        address[] memory page = game.getParticipants(seasonId, 1, 10);
        assertEq(page.length, 1);
        assertEq(page[0], bob);
        assertEq(game.getParticipants(seasonId, 0, 1)[0], alice);
        assertEq(game.getParticipants(seasonId, 5, 10).length, 0);
    }

    function test_joinRejectsWrongFee() public {
        vm.startPrank(alice);
        vm.expectRevert(MiracleGame.WrongEntryFee.selector);
        game.joinSeason{value: FEE - 1}(seasonId);
        vm.expectRevert(MiracleGame.WrongEntryFee.selector);
        game.joinSeason{value: FEE + 1}(seasonId);
        vm.stopPrank();
    }

    function test_joinRejectsTwice() public {
        _join(alice);
        vm.prank(alice);
        vm.expectRevert(MiracleGame.AlreadyJoined.selector);
        game.joinSeason{value: FEE}(seasonId);
    }

    function test_joinRejectsOutsideEntry() public {
        _toLive();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MiracleGame.WrongPhase.selector, MiracleGame.Phase.Entry, MiracleGame.Phase.Live)
        );
        game.joinSeason{value: FEE}(seasonId);
    }

    function test_joinRespectsMaxParticipants() public {
        seasonId = _createSeason(FEE, 2, 0, _topTen());
        _join(alice);
        _join(bob);
        vm.prank(carol);
        vm.expectRevert(MiracleGame.SeasonFull.selector);
        game.joinSeason{value: FEE}(seasonId);
    }

    function test_joinUnknownSeason() public {
        vm.prank(alice);
        vm.expectRevert(MiracleGame.SeasonNotFound.selector);
        game.joinSeason{value: FEE}(99);
    }

    // --- parity with packages/shared/src/formulas.ts ---

    function test_leverageMatchesFormulas() public view {
        assertEq(game.leverageBpsFromScore(0), 30_000); // 3x
        assertEq(game.leverageBpsFromScore(50), 65_000); // 6.5x
        assertEq(game.leverageBpsFromScore(100), 100_000); // 10x
        assertEq(game.leverageBpsFromScore(140), 100_000); // clamped
    }

    function test_positionPnlMatchesFormulas() public view {
        assertEq(game.positionPnl(true, 1_000e18, 100e18, 110e18), 100e18);
        assertEq(game.positionPnl(true, 1_000e18, 100e18, 90e18), -100e18);
        assertEq(game.positionPnl(false, 1_000e18, 100e18, 90e18), 100e18);
        assertEq(game.positionPnl(false, 1_000e18, 100e18, 110e18), -100e18);
        assertEq(game.positionPnl(true, 1_234.56e18, 764.29e18, 764.29e18), 0);
    }

    // --- opening ---

    function test_openRecordsTimestampWithoutPrice() public {
        _join(alice);
        _toLive();

        vm.expectEmit(address(game));
        emit MiracleGame.PositionOpened(seasonId, alice, 0, SPY, true, 5_000e18);
        uint256 id = _open(alice, SPY, true, 5_000e18);
        assertEq(id, 0);

        MiracleGame.Position memory pos = _position(alice, 0);
        assertEq(pos.symbol, SPY);
        assertTrue(pos.isLong);
        assertEq(uint8(pos.status), uint8(MiracleGame.PositionStatus.Open));
        assertEq(pos.notional, 5_000e18);
        assertEq(pos.openedAt, block.timestamp);
        assertEq(pos.entryRoundId, 0);
        assertEq(pos.entryPrice, 0);

        MiracleGame.PlayerView memory p = _player(alice);
        assertEq(p.riskWeightedAum, 5_000e18);
        assertEq(p.unsettledPositions, 1);
        assertEq(p.positionCount, 1);
    }

    function test_openRejectsBeforeLive() public {
        _join(alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MiracleGame.WrongPhase.selector, MiracleGame.Phase.Live, MiracleGame.Phase.Entry)
        );
        game.openPosition(seasonId, SPY, true, 1e18);
    }

    function test_openRejectsNonParticipant() public {
        _toLive();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.NotParticipant.selector, bob));
        game.openPosition(seasonId, SPY, true, 1e18);
    }

    function test_openRejectsUnknownAsset() public {
        _join(alice);
        _toLive();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.AssetNotListed.selector, bytes32("ETH")));
        game.openPosition(seasonId, "ETH", true, 1e18);
    }

    function test_openRejectsZeroNotional() public {
        _join(alice);
        _toLive();
        vm.prank(alice);
        vm.expectRevert(MiracleGame.ZeroNotional.selector);
        game.openPosition(seasonId, SPY, true, 0);
    }

    function test_capacityUsesRiskWeights() public {
        _join(alice);
        _toLive();
        // 100k capital at 3x = 300k capacity; BTC weighs 2x, so 150k notional fills it.
        _open(alice, BTC, true, 150_000e18);
        assertEq(_player(alice).riskWeightedAum, 300_000e18);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.CapitalInadequate.selector, 300_000e18 + 1, 300_000e18));
        game.openPosition(seasonId, SPY, true, 1);
    }

    function test_unsettledPositionLimit() public {
        _join(alice);
        _toLive();
        for (uint256 i; i < 20; i++) {
            _open(alice, SPY, true, 1e18);
        }
        vm.prank(alice);
        vm.expectRevert(MiracleGame.TooManyUnsettledPositions.selector);
        game.openPosition(seasonId, SPY, true, 1e18);
    }

    // --- closing ---

    function test_closeMarksClosing() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        _tick();
        _close(alice, 0);

        MiracleGame.Position memory pos = _position(alice, 0);
        assertEq(uint8(pos.status), uint8(MiracleGame.PositionStatus.Closing));
        assertEq(pos.closedAt, block.timestamp);
        // Still consumes capacity until settled.
        assertEq(_player(alice).riskWeightedAum, 1_000e18);

        vm.prank(alice);
        vm.expectRevert(MiracleGame.PositionNotOpen.selector);
        game.closePosition(seasonId, 0);
    }

    function test_closeRejectsOthersAndUnknownPositions() public {
        _join(alice);
        _join(bob);
        _toLive();
        _open(alice, SPY, true, 1_000e18);

        vm.prank(bob);
        vm.expectRevert(MiracleGame.PositionNotFound.selector);
        game.closePosition(seasonId, 0);

        vm.prank(alice);
        vm.expectRevert(MiracleGame.PositionNotFound.selector);
        game.closePosition(seasonId, 1);
    }

    function test_closeRejectsAfterEnd() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        _toEnd();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MiracleGame.WrongPhase.selector, MiracleGame.Phase.Live, MiracleGame.Phase.Settling)
        );
        game.closePosition(seasonId, 0);
    }

    // --- settling ---

    function test_settleClosedLongUsesNextRounds() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        uint80 entry = _publish(spy, 100e8);
        _tick();
        _close(alice, 0);
        uint80 exit = _publish(spy, 110e8);

        vm.expectEmit(address(game));
        emit MiracleGame.PositionClosed(seasonId, alice, 0, 100e18);
        vm.prank(bob); // anyone may settle
        game.settlePosition(seasonId, alice, 0, entry, exit);

        MiracleGame.Position memory pos = _position(alice, 0);
        assertEq(uint8(pos.status), uint8(MiracleGame.PositionStatus.Settled));
        assertFalse(pos.voided);
        assertEq(pos.entryRoundId, entry);
        assertEq(pos.exitRoundId, exit);
        assertEq(pos.entryPrice, 100e18);
        assertEq(pos.exitPrice, 110e18);
        assertEq(pos.pnl, 100e18);

        MiracleGame.PlayerView memory p = _player(alice);
        assertEq(p.realisedPnl, 100e18);
        assertEq(p.riskWeightedAum, 0);
        assertEq(p.unsettledPositions, 0);
        assertEq(p.equity, CAPITAL + 100e18);
        assertEq(game.equityOf(seasonId, alice), CAPITAL + 100e18);
    }

    function test_settleShort() public {
        _join(alice);
        _toLive();
        _tradeSpy(alice, false, 1_000e18, 90e8);
        assertEq(_position(alice, 0).pnl, 100e18);
        _tradeSpy(alice, false, 1_000e18, 110e8);
        assertEq(_position(alice, 1).pnl, -100e18);
        assertEq(_player(alice).realisedPnl, 0);
    }

    function test_priceSeenBeforeOpeningIsNotTheEntry() public {
        _join(alice);
        _toLive();
        uint80 seen = spy.push(100e8, block.timestamp); // same second, earlier block
        _open(alice, SPY, true, 1_000e18);
        _close(alice, 0);
        uint80 next = _publish(spy, 120e8);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotAfterTimestamp.selector, seen));
        game.settlePosition(seasonId, alice, 0, seen, next);

        game.settlePosition(seasonId, alice, 0, next, next);
        assertEq(_position(alice, 0).pnl, 0);
    }

    function test_rejectsFavourableLaterRound() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        uint80 entry = _publish(spy, 100e8);
        uint80 cheaper = _publish(spy, 80e8);
        _close(alice, 0);
        uint80 exit = _publish(spy, 110e8);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.HintNotFirstAfterTimestamp.selector, cheaper));
        game.settlePosition(seasonId, alice, 0, cheaper, exit);

        game.settlePosition(seasonId, alice, 0, entry, exit);
        assertEq(_position(alice, 0).pnl, 100e18);
    }

    function test_settleOpenPositionOnlyAfterEnd() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        uint80 entry = _publish(spy, 100e8);

        vm.expectRevert(MiracleGame.PositionStillOpen.selector);
        game.settlePosition(seasonId, alice, 0, entry, entry);

        _toEnd();
        uint80 exit = _publish(spy, 105e8);
        game.settlePosition(seasonId, alice, 0, entry, exit);
        assertEq(_position(alice, 0).pnl, 50e18);
        assertEq(_position(alice, 0).closedAt, 0);
    }

    function test_sameRoundEntryAndExitIsZeroPnl() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        _close(alice, 0);
        uint80 round = _publish(spy, 150e8);

        game.settlePosition(seasonId, alice, 0, round, round);
        MiracleGame.Position memory pos = _position(alice, 0);
        assertEq(pos.pnl, 0);
        assertFalse(pos.voided);
        assertEq(pos.entryPrice, 150e18);
    }

    function test_deadFeedVoidsPosition() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        _tick();
        _close(alice, 0);
        (uint80 latest,,,,) = spy.latestRoundData();

        vm.expectRevert(abi.encodeWithSelector(ChainlinkLib.RoundNotPublished.selector, latest));
        game.settlePosition(seasonId, alice, 0, latest, latest);

        vm.warp(block.timestamp + 7 days);
        game.settlePosition(seasonId, alice, 0, latest, latest);

        MiracleGame.Position memory pos = _position(alice, 0);
        assertTrue(pos.voided);
        assertEq(pos.pnl, 0);
        assertEq(_player(alice).unsettledPositions, 0);
        assertEq(_player(alice).riskWeightedAum, 0);
    }

    function test_settleTwiceReverts() public {
        _join(alice);
        _toLive();
        _tradeSpy(alice, true, 1_000e18, 110e8);
        MiracleGame.Position memory pos = _position(alice, 0);

        vm.expectRevert(MiracleGame.PositionAlreadySettled.selector);
        game.settlePosition(seasonId, alice, 0, pos.entryRoundId, pos.exitRoundId);
    }

    function test_batchSkipsSettled() public {
        _join(alice);
        _toLive();
        _open(alice, SPY, true, 1_000e18);
        _open(alice, SPY, false, 1_000e18);
        uint80 entry = _publish(spy, 100e8);
        _close(alice, 0);
        _close(alice, 1);
        uint80 exit = _publish(spy, 110e8);

        game.settlePosition(seasonId, alice, 0, entry, exit);

        MiracleGame.SettleRequest[] memory batch = new MiracleGame.SettleRequest[](2);
        batch[0] = MiracleGame.SettleRequest(alice, 0, entry, exit);
        batch[1] = MiracleGame.SettleRequest(alice, 1, entry, exit);
        game.settlePositions(seasonId, batch);

        assertEq(uint8(_position(alice, 1).status), uint8(MiracleGame.PositionStatus.Settled));
        assertEq(_player(alice).realisedPnl, 0);
        assertEq(_player(alice).unsettledPositions, 0);
    }

    function test_realisedLossShrinksCapacity() public {
        _join(alice);
        _toLive();
        _open(alice, BTC, true, 150_000e18);
        uint80 entry = _publish(btc, 50_000e8);
        _close(alice, 0);
        uint80 exit = _publish(btc, 25_000e8);
        game.settlePosition(seasonId, alice, 0, entry, exit);

        // -50% on 150k = -75k: equity 25k, capacity 75k.
        MiracleGame.PlayerView memory p = _player(alice);
        assertEq(p.realisedPnl, -75_000e18);
        assertEq(p.equity, 25_000e18);
        assertEq(p.aumCapacity, 75_000e18);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MiracleGame.CapitalInadequate.selector, 75_000e18 + 1, 75_000e18));
        game.openPosition(seasonId, SPY, true, 75_000e18 + 1);
    }

    function test_lossBeyondCapitalFloorsEquityAtZero() public {
        _join(alice);
        _toLive();
        _open(alice, BTC, false, 150_000e18);
        uint80 entry = _publish(btc, 50_000e8);
        _close(alice, 0);
        uint80 exit = _publish(btc, 100_000e8);
        game.settlePosition(seasonId, alice, 0, entry, exit);

        MiracleGame.PlayerView memory p = _player(alice);
        assertEq(p.realisedPnl, -150_000e18);
        assertEq(p.equity, 0);
        assertEq(p.aumCapacity, 0);
        assertEq(game.equityOf(seasonId, alice), 0);
    }
}
