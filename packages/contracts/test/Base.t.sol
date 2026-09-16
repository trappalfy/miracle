// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MiracleGame} from "../src/MiracleGame.sol";
import {MockFeed} from "./mocks/MockFeed.sol";

/// @dev Shared fixture: a game with SPY (1.0x) and BTC (2.0x, always open)
/// on mock feeds, and one season in its entry phase.
abstract contract BaseTest is Test {
    MiracleGame internal game;
    MockFeed internal spy;
    MockFeed internal btc;

    bytes32 internal constant SPY = "SPY";
    bytes32 internal constant BTC = "BTC";

    uint256 internal constant FEE = 1 ether;
    uint256 internal constant CAPITAL = 100_000e18;
    uint32 internal constant MAX_PLAYERS = 100;

    uint256 internal seasonId;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public virtual {
        vm.warp(1_790_000_000);

        game = new MiracleGame();
        spy = new MockFeed(8);
        btc = new MockFeed(8);
        spy.push(100e8, block.timestamp);
        btc.push(50_000e8, block.timestamp);

        game.listAsset(SPY, address(spy), 10_000, false);
        game.listAsset(BTC, address(btc), 20_000, true);

        seasonId = _createSeason(FEE, MAX_PLAYERS, 0, _topTen());

        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 1_000 ether);
        vm.deal(carol, 1_000 ether);
    }

    // --- season setup ---

    function _topTen() internal pure returns (uint16[] memory curve) {
        curve = new uint16[](10);
        uint16[10] memory shares = [uint16(2500), 1800, 1300, 1000, 800, 700, 600, 500, 400, 400];
        for (uint256 i; i < 10; i++) {
            curve[i] = shares[i];
        }
    }

    function _curve3(uint16 first, uint16 second, uint16 third) internal pure returns (uint16[] memory curve) {
        curve = new uint16[](3);
        curve[0] = first;
        curve[1] = second;
        curve[2] = third;
    }

    /// Entry opens now, trading starts in a day and runs for a week.
    function _createSeason(uint256 fee, uint32 maxPlayers, uint16 feeBps, uint16[] memory curve)
        internal
        returns (uint256)
    {
        uint64 now_ = uint64(block.timestamp);
        return game.createSeason(fee, now_, now_ + 1 days, now_ + 8 days, CAPITAL, maxPlayers, feeBps, curve);
    }

    function _season() internal view returns (MiracleGame.SeasonView memory) {
        return game.getSeason(seasonId);
    }

    function _player(address who) internal view returns (MiracleGame.PlayerView memory) {
        return game.getPlayer(seasonId, who);
    }

    function _position(address who, uint256 positionId) internal view returns (MiracleGame.Position memory) {
        return game.getPositions(seasonId, who)[positionId];
    }

    // --- time ---

    function _toLive() internal {
        vm.warp(_season().entryClosesAt);
    }

    function _toEnd() internal {
        vm.warp(_season().tradingEndsAt);
    }

    function _tick() internal {
        vm.warp(block.timestamp + 60);
    }

    // --- actions ---

    function _join(address who) internal {
        vm.prank(who);
        game.joinSeason{value: FEE}(seasonId);
    }

    function _open(address who, bytes32 symbol, bool isLong, uint256 notional) internal returns (uint256 positionId) {
        vm.prank(who);
        positionId = game.openPosition(seasonId, symbol, isLong, notional);
    }

    function _close(address who, uint256 positionId) internal {
        vm.prank(who);
        game.closePosition(seasonId, positionId);
    }

    /// Publishes a price one tick later, so it lands strictly after anything done now.
    function _publish(MockFeed feed, int256 price8) internal returns (uint80 roundId) {
        _tick();
        roundId = feed.push(price8, block.timestamp);
    }

    /// Opens, closes and settles a position so the player ends with `pnl` on
    /// SPY's price path 100 -> exitPrice8. Must be called during trading.
    function _tradeSpy(address who, bool isLong, uint256 notional, int256 exitPrice8) internal {
        uint256 positionId = _open(who, SPY, isLong, notional);
        uint80 entry = _publish(spy, 100e8);
        _close(who, positionId);
        uint80 exit = _publish(spy, exitPrice8);
        game.settlePosition(seasonId, who, positionId, entry, exit);
    }
}
