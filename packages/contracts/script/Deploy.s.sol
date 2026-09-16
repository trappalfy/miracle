// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MiracleGame} from "../src/MiracleGame.sol";
import {MiracleConfig} from "./MiracleConfig.sol";

/// Deploys MiracleGame, lists the eight launch assets and opens the beta season:
/// 0.0001 ETH entry, entry open for 24 h, then 7 days of trading on 100 000
/// virtual capital, at most 100 players, top-10 payouts, no platform fee.
///
///   forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --slow
contract Deploy is Script {
    uint256 internal constant BETA_ENTRY_FEE = 0.0001 ether;
    uint256 internal constant BETA_STARTING_CAPITAL = 100_000e18;
    uint32 internal constant BETA_MAX_PARTICIPANTS = 100;

    function run() external returns (MiracleGame game, uint256 seasonId) {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        game = new MiracleGame();
        MiracleConfig.listAssets(game);

        uint64 now_ = uint64(block.timestamp);
        seasonId = game.createSeason(
            BETA_ENTRY_FEE,
            now_,
            now_ + 1 days,
            now_ + 8 days,
            BETA_STARTING_CAPITAL,
            BETA_MAX_PARTICIPANTS,
            0,
            MiracleConfig.topTenCurve()
        );

        vm.stopBroadcast();

        console.log("MiracleGame:", address(game));
        console.log("Beta season:", seasonId);
        console.log("Entry closes (unix):", now_ + 1 days);
        console.log("Trading ends (unix):", now_ + 8 days);
    }
}
