// Generated from packages/contracts by scripts/export-abi.mjs — do not edit.
export const miracleGameAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "LEVERAGE_BPS_PER_SCORE_POINT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_FEE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PAID_PLACES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_SCORE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_STARTING_CAPITAL",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_UNSETTLED_POSITIONS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_LEVERAGE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimableOf",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "who",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "closePosition",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createSeason",
    "inputs": [
      {
        "name": "entryFee",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "entryOpensAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "entryClosesAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tradingEndsAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "startingCapital",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "maxParticipants",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "feeBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "payoutBps",
        "type": "uint16[]",
        "internalType": "uint16[]"
      }
    ],
    "outputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "equityOf",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "who",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAssets",
    "inputs": [],
    "outputs": [
      {
        "name": "assets",
        "type": "tuple[]",
        "internalType": "struct MiracleGame.AssetView[]",
        "components": [
          {
            "name": "symbol",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "feed",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "riskWeightBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "alwaysOpen",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "decimals",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getParticipants",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPlayer",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "who",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "v",
        "type": "tuple",
        "internalType": "struct MiracleGame.PlayerView",
        "components": [
          {
            "name": "joined",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "index",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "score",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "leverageBps",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "unsettledPositions",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "rank",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "realisedPnl",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "riskWeightedAum",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "aumCapacity",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "equity",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "positionCount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "claimable",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPositions",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "who",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct MiracleGame.Position[]",
        "components": [
          {
            "name": "symbol",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "isLong",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum MiracleGame.PositionStatus"
          },
          {
            "name": "voided",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "notional",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "openedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "closedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "entryRoundId",
            "type": "uint80",
            "internalType": "uint80"
          },
          {
            "name": "exitRoundId",
            "type": "uint80",
            "internalType": "uint80"
          },
          {
            "name": "entryPrice",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "exitPrice",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "pnl",
            "type": "int256",
            "internalType": "int256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRanking",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSeason",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "v",
        "type": "tuple",
        "internalType": "struct MiracleGame.SeasonView",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "phase",
            "type": "uint8",
            "internalType": "enum MiracleGame.Phase"
          },
          {
            "name": "entryFee",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "prizePool",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "paidOut",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "startingCapital",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "entryOpensAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "entryClosesAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "tradingEndsAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "participants",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxParticipants",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "feeBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "payoutBps",
            "type": "uint16[]",
            "internalType": "uint16[]"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "joinSeason",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "leverageBpsFromScore",
    "inputs": [
      {
        "name": "score",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "listAsset",
    "inputs": [
      {
        "name": "symbol",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "feed",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "riskWeightBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "alwaysOpen",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "openPosition",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "symbol",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "isLong",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "notional",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "positionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "positionPnl",
    "inputs": [
      {
        "name": "isLong",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "notional",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "entryPrice",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "exitPrice",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "scoreOf",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "seasonCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "settlePosition",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "entryRoundHint",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "exitRoundHint",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settlePositions",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "requests",
        "type": "tuple[]",
        "internalType": "struct MiracleGame.SettleRequest[]",
        "components": [
          {
            "name": "player",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "positionId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "entryRoundHint",
            "type": "uint80",
            "internalType": "uint80"
          },
          {
            "name": "exitRoundHint",
            "type": "uint80",
            "internalType": "uint80"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitRanking",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "ordered",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Joined",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "fee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionClosed",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "pnl",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PositionOpened",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "positionId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "symbol",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "isLong",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "notional",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RankingSubmitted",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "submitter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SeasonCreated",
    "inputs": [
      {
        "name": "seasonId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "entryFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "tradingEndsAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyJoined",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AssetAlreadyListed",
    "inputs": [
      {
        "name": "symbol",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AssetNotListed",
    "inputs": [
      {
        "name": "symbol",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "CapitalInadequate",
    "inputs": [
      {
        "name": "required",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "capacity",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "DuplicatePlayer",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "HintNotAfterTimestamp",
    "inputs": [
      {
        "name": "hint",
        "type": "uint80",
        "internalType": "uint80"
      }
    ]
  },
  {
    "type": "error",
    "name": "HintNotFirstAfterTimestamp",
    "inputs": [
      {
        "name": "hint",
        "type": "uint80",
        "internalType": "uint80"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidAsset",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSeason",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotParticipant",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NothingToClaim",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PositionAlreadySettled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PositionNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PositionNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PositionStillOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RankingLengthMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RankingOrderViolated",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "Reentrancy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundNotPublished",
    "inputs": [
      {
        "name": "hint",
        "type": "uint80",
        "internalType": "uint80"
      }
    ]
  },
  {
    "type": "error",
    "name": "SeasonFull",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SeasonNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TooManyUnsettledPositions",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnsettledPositions",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "WrongEntryFee",
    "inputs": []
  },
  {
    "type": "error",
    "name": "WrongPhase",
    "inputs": [
      {
        "name": "expected",
        "type": "uint8",
        "internalType": "enum MiracleGame.Phase"
      },
      {
        "name": "actual",
        "type": "uint8",
        "internalType": "enum MiracleGame.Phase"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroNotional",
    "inputs": []
  }
] as const;
