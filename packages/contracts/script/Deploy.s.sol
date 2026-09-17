// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MiracleGame} from "../src/MiracleGame.sol";
import {MiracleConfig} from "./MiracleConfig.sol";

/// Deploys MiracleGame, lists the eight launch assets and opens season 1:
/// 0.01 ETH entry, entry open for 3 days, then 14 days of trading on 100 000
/// virtual capital, at most 100 players, top-10 payouts, no platform fee.
///
/// There is no beta season. Season 1 of a fresh deployment is the real one, so
/// the number a player sees is the number of the season they are playing.
///
/// Keep these in step with FIRST_SEASON in packages/shared/src/launch.ts, which
/// is what the site shows. Entry opens at deployment time, so whoever runs this
/// is starting the season.
///
///   forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --slow
contract Deploy is Script {
    uint256 internal constant ENTRY_FEE = 0.01 ether;
    uint256 internal constant STARTING_CAPITAL = 100_000e18;
    uint32 internal constant MAX_PARTICIPANTS = 100;
    uint64 internal constant ENTRY_DURATION = 3 days;
    uint64 internal constant TRADING_DURATION = 14 days;

    function run() external returns (MiracleGame game, uint256 seasonId) {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        game = new MiracleGame();
        MiracleConfig.listAssets(game);

        uint64 opensAt = uint64(block.timestamp);
        uint64 closesAt = opensAt + ENTRY_DURATION;
        uint64 endsAt = closesAt + TRADING_DURATION;

        seasonId = game.createSeason(
            ENTRY_FEE,
            opensAt,
            closesAt,
            endsAt,
            STARTING_CAPITAL,
            MAX_PARTICIPANTS,
            0,
            MiracleConfig.topTenCurve()
        );

        vm.stopBroadcast();

        console.log("MiracleGame:", address(game));
        console.log("Season:", seasonId);
        console.log("Entry opens (unix):", opensAt);
        console.log("Entry closes, trading starts (unix):", closesAt);
        console.log("Trading ends (unix):", endsAt);
    }
}
