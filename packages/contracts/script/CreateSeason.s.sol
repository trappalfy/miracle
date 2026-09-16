// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MiracleGame} from "../src/MiracleGame.sol";
import {MiracleConfig} from "./MiracleConfig.sol";

/// Creates a season on an existing deployment. Defaults are the agreed
/// production season: 0.01 ETH entry, 3 days of entry, 14 days of trading,
/// 100 000 virtual capital, at most 100 players, top-10 payouts, no fee.
/// Override any of them through the environment. Keep the defaults in step with
/// FIRST_SEASON in packages/shared/src/launch.ts, which the launch countdown shows.
///
///   GAME_ADDRESS=0x... forge script script/CreateSeason.s.sol --rpc-url robinhood --broadcast --slow
contract CreateSeason is Script {
    function run() external returns (uint256 seasonId) {
        MiracleGame game = MiracleGame(vm.envAddress("GAME_ADDRESS"));

        uint256 entryFee = vm.envOr("ENTRY_FEE_WEI", uint256(0.01 ether));
        uint256 opensIn = vm.envOr("ENTRY_OPENS_IN", uint256(0));
        uint256 entryDuration = vm.envOr("ENTRY_DURATION", uint256(3 days));
        uint256 tradingDuration = vm.envOr("TRADING_DURATION", uint256(14 days));
        uint256 startingCapital = vm.envOr("STARTING_CAPITAL", uint256(100_000e18));
        uint32 maxParticipants = uint32(vm.envOr("MAX_PARTICIPANTS", uint256(100)));
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(0)));

        uint64 opensAt = uint64(block.timestamp + opensIn);
        uint64 closesAt = uint64(opensAt + entryDuration);
        uint64 endsAt = uint64(closesAt + tradingDuration);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        seasonId = game.createSeason(
            entryFee, opensAt, closesAt, endsAt, startingCapital, maxParticipants, feeBps, MiracleConfig.topTenCurve()
        );
        vm.stopBroadcast();

        console.log("Season:", seasonId);
        console.log("Entry opens (unix):", opensAt);
        console.log("Entry closes (unix):", closesAt);
        console.log("Trading ends (unix):", endsAt);
        console.log("Max prize pool (wei):", entryFee * maxParticipants);
    }
}
