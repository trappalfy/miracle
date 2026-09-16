// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MiracleGame} from "../src/MiracleGame.sol";

/// @dev Launch configuration. Feeds and weights mirror packages/shared/src/assets.ts;
/// the feeds are Chainlink proxies on Robinhood Chain mainnet.
library MiracleConfig {
    function listAssets(MiracleGame game) internal {
        game.listAsset("SGOV", 0xa0DF4ee0fFf975306345875E3548Fcc519577A11, 5_000, false);
        game.listAsset("SLV", 0x209b73908e92Ae021826eD79609845451Ecba2ce, 8_000, false);
        game.listAsset("SPY", 0x319724394D3A0e3669269846abE664Cd621f9f6A, 10_000, false);
        game.listAsset("QQQ", 0x80901d846d5D7B030F26B480776EE3b29374C2ae, 12_000, false);
        game.listAsset("NVDA", 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15, 15_000, false);
        game.listAsset("TSLA", 0x4A1166a659A55625345e9515b32adECea5547C38, 18_000, false);
        game.listAsset("BTC", 0xa2c5184bF03d373Dc9dE4876eb4Bce595B460251, 20_000, true);
        game.listAsset("MSTR", 0x396118bdFB181e6240E74D243F266B061c0edc3D, 25_000, false);
    }

    /// Top 10: 25 / 18 / 13 / 10 / 8 / 7 / 6 / 5 / 4 / 4 %.
    function topTenCurve() internal pure returns (uint16[] memory curve) {
        uint16[10] memory shares = [uint16(2_500), 1_800, 1_300, 1_000, 800, 700, 600, 500, 400, 400];
        curve = new uint16[](shares.length);
        for (uint256 i; i < shares.length; ++i) {
            curve[i] = shares[i];
        }
    }
}
