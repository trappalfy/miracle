// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AggregatorV3Interface, ChainlinkLib} from "./ChainlinkLib.sol";

/// @title MiracleGame
/// @notice A trading tournament. Players pay a real entry fee into a season's
/// prize pool, trade equal virtual capital against Chainlink prices, and are
/// paid by rank. Every piece of game state lives here; nothing is kept on a
/// server and the owner cannot edit positions, prices or the ranking.
///
/// Fixed point: bps where 10_000 = 1.0x; capital, notional, equity and prices
/// in 1e18 (WAD). See docs/CONTRACTS-DESIGN.md for the rules this implements.
contract MiracleGame {
    uint256 public constant BPS = 10_000;
    uint32 public constant MIN_LEVERAGE_BPS = 30_000;
    uint32 public constant LEVERAGE_BPS_PER_SCORE_POINT = 700;
    uint16 public constant MAX_SCORE = 100;
    uint16 public constant MAX_FEE_BPS = 2_000;
    uint256 public constant MAX_PAID_PLACES = 100;
    /// Bounds the work needed to settle a season: every open position must be settled before ranking.
    uint32 public constant MAX_UNSETTLED_POSITIONS = 20;
    uint256 public constant MAX_STARTING_CAPITAL = 1e30;

    enum Phase {
        Upcoming,
        Entry,
        Live,
        Settling,
        Settled
    }

    enum PositionStatus {
        Open,
        Closing,
        Settled
    }

    struct Asset {
        address feed;
        uint16 riskWeightBps;
        bool alwaysOpen;
        uint8 decimals;
    }

    struct Season {
        uint256 entryFee;
        uint256 startingCapital;
        uint256 prizePool;
        uint256 paidOut;
        uint64 entryOpensAt;
        uint64 entryClosesAt;
        uint64 tradingEndsAt;
        uint32 maxParticipants;
        uint16 feeBps;
        bool ranked;
        uint16[] payoutBps;
        address[] participants;
        address[] ranking;
    }

    struct Player {
        bool joined;
        uint32 index;
        /// Career score at the moment of joining; fixes leverage for the season.
        uint16 score;
        uint32 leverageBps;
        uint32 unsettledPositions;
        /// 1-based final place, shared by tied players. Zero until ranked.
        uint32 rank;
        int256 realisedPnl;
        uint256 riskWeightedAum;
    }

    struct Position {
        bytes32 symbol;
        bool isLong;
        PositionStatus status;
        /// Settled without PnL because the feed produced no usable round.
        bool voided;
        uint256 notional;
        uint64 openedAt;
        /// When the player asked to close; zero for positions carried to the season end.
        uint64 closedAt;
        uint80 entryRoundId;
        uint80 exitRoundId;
        uint256 entryPrice;
        uint256 exitPrice;
        int256 pnl;
    }

    struct SettleRequest {
        address player;
        uint256 positionId;
        uint80 entryRoundHint;
        uint80 exitRoundHint;
    }

    struct AssetView {
        bytes32 symbol;
        address feed;
        uint16 riskWeightBps;
        bool alwaysOpen;
        uint8 decimals;
    }

    struct SeasonView {
        uint256 id;
        Phase phase;
        uint256 entryFee;
        uint256 prizePool;
        uint256 paidOut;
        uint256 startingCapital;
        uint64 entryOpensAt;
        uint64 entryClosesAt;
        uint64 tradingEndsAt;
        uint32 participants;
        uint32 maxParticipants;
        uint16 feeBps;
        uint16[] payoutBps;
    }

    struct PlayerView {
        bool joined;
        uint32 index;
        uint16 score;
        uint32 leverageBps;
        uint32 unsettledPositions;
        uint32 rank;
        int256 realisedPnl;
        uint256 riskWeightedAum;
        uint256 aumCapacity;
        uint256 equity;
        uint256 positionCount;
        uint256 claimable;
    }

    event SeasonCreated(uint256 indexed seasonId, uint256 entryFee, uint64 tradingEndsAt);
    event Joined(uint256 indexed seasonId, address indexed player, uint256 fee);
    event PositionOpened(
        uint256 indexed seasonId, address indexed player, uint256 positionId, bytes32 symbol, bool isLong, uint256 notional
    );
    event PositionClosed(uint256 indexed seasonId, address indexed player, uint256 positionId, int256 pnl);
    event RankingSubmitted(uint256 indexed seasonId, address submitter);
    event Claimed(uint256 indexed seasonId, address indexed player, uint256 amount);

    error NotOwner();
    error ZeroAddress();
    error InvalidAsset();
    error AssetAlreadyListed(bytes32 symbol);
    error AssetNotListed(bytes32 symbol);
    error InvalidSeason();
    error SeasonNotFound();
    error WrongPhase(Phase expected, Phase actual);
    error WrongEntryFee();
    error AlreadyJoined();
    error SeasonFull();
    error NotParticipant(address player);
    error ZeroNotional();
    error TooManyUnsettledPositions();
    error CapitalInadequate(uint256 required, uint256 capacity);
    error PositionNotFound();
    error PositionNotOpen();
    error PositionAlreadySettled();
    error PositionStillOpen();
    error RankingLengthMismatch();
    error DuplicatePlayer(address player);
    error UnsettledPositions(address player);
    error RankingOrderViolated(uint256 index);
    error NothingToClaim();
    error TransferFailed();
    error Reentrancy();

    address public owner;
    /// Career score, 0..100. Updated when a season's ranking is accepted.
    mapping(address => uint16) public scoreOf;

    uint256 private _lock = 1;
    mapping(bytes32 => Asset) private _assets;
    bytes32[] private _assetSymbols;
    Season[] private _seasons;
    mapping(uint256 => mapping(address => Player)) private _players;
    mapping(uint256 => mapping(address => Position[])) private _positions;
    mapping(uint256 => mapping(address => uint256)) private _claimable;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor() {
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Lists a tradeable asset. A symbol can be listed once and never
    /// changed, so no feed can be swapped under open positions.
    function listAsset(bytes32 symbol, address feed, uint16 riskWeightBps, bool alwaysOpen) external onlyOwner {
        if (symbol == bytes32(0) || feed.code.length == 0 || riskWeightBps == 0) revert InvalidAsset();
        if (_assets[symbol].feed != address(0)) revert AssetAlreadyListed(symbol);

        uint8 decimals = AggregatorV3Interface(feed).decimals();
        if (decimals > 18) revert InvalidAsset();

        _assets[symbol] = Asset(feed, riskWeightBps, alwaysOpen, decimals);
        _assetSymbols.push(symbol);
    }

    /// @notice Creates a season. Its rules — fee, timings, capital, cap and
    /// payout curve — are fixed here and cannot be changed afterwards.
    function createSeason(
        uint256 entryFee,
        uint64 entryOpensAt,
        uint64 entryClosesAt,
        uint64 tradingEndsAt,
        uint256 startingCapital,
        uint32 maxParticipants,
        uint16 feeBps,
        uint16[] calldata payoutBps
    ) external onlyOwner returns (uint256 seasonId) {
        if (
            entryOpensAt >= entryClosesAt || entryClosesAt >= tradingEndsAt || tradingEndsAt <= block.timestamp
                || startingCapital == 0 || startingCapital > MAX_STARTING_CAPITAL || maxParticipants == 0
                || feeBps > MAX_FEE_BPS
        ) revert InvalidSeason();
        _validatePayoutCurve(payoutBps);

        Season storage s = _seasons.push();
        s.entryFee = entryFee;
        s.startingCapital = startingCapital;
        s.entryOpensAt = entryOpensAt;
        s.entryClosesAt = entryClosesAt;
        s.tradingEndsAt = tradingEndsAt;
        s.maxParticipants = maxParticipants;
        s.feeBps = feeBps;
        s.payoutBps = payoutBps;

        seasonId = _seasons.length;
        emit SeasonCreated(seasonId, entryFee, tradingEndsAt);
    }

    // ---------------------------------------------------------------------
    // Playing
    // ---------------------------------------------------------------------

    function joinSeason(uint256 seasonId) external payable {
        Season storage s = _season(seasonId);
        _requirePhase(s, Phase.Entry);
        if (msg.value != s.entryFee) revert WrongEntryFee();

        Player storage p = _players[seasonId][msg.sender];
        if (p.joined) revert AlreadyJoined();
        if (s.participants.length >= s.maxParticipants) revert SeasonFull();

        uint16 score = scoreOf[msg.sender];
        p.joined = true;
        p.index = uint32(s.participants.length);
        p.score = score;
        p.leverageBps = leverageBpsFromScore(score);

        s.participants.push(msg.sender);
        s.prizePool += msg.value;

        emit Joined(seasonId, msg.sender, msg.value);
    }

    /// @notice Opens a position. No price is read: the entry price is the
    /// first oracle round published after this transaction, resolved at settlement.
    function openPosition(uint256 seasonId, bytes32 symbol, bool isLong, uint256 notional)
        external
        returns (uint256 positionId)
    {
        Season storage s = _season(seasonId);
        _requirePhase(s, Phase.Live);
        Player storage p = _participant(seasonId, msg.sender);
        Asset storage asset = _asset(symbol);
        if (notional == 0) revert ZeroNotional();
        if (p.unsettledPositions >= MAX_UNSETTLED_POSITIONS) revert TooManyUnsettledPositions();

        uint256 aum = p.riskWeightedAum + _riskWeighted(notional, asset);
        uint256 capacity = _capacity(s, p);
        if (aum > capacity) revert CapitalInadequate(aum, capacity);

        p.riskWeightedAum = aum;
        p.unsettledPositions++;

        Position[] storage positions = _positions[seasonId][msg.sender];
        positionId = positions.length;
        Position storage pos = positions.push();
        pos.symbol = symbol;
        pos.isLong = isLong;
        pos.notional = notional;
        pos.openedAt = uint64(block.timestamp);

        emit PositionOpened(seasonId, msg.sender, positionId, symbol, isLong, notional);
    }

    /// @notice Asks to close a position. The exit price is the first oracle
    /// round published after this transaction, so the PnL is known only once
    /// that round exists and someone settles the position.
    function closePosition(uint256 seasonId, uint256 positionId) external {
        Season storage s = _season(seasonId);
        _requirePhase(s, Phase.Live);
        Position storage pos = _position(seasonId, msg.sender, positionId);
        if (pos.status != PositionStatus.Open) revert PositionNotOpen();

        pos.status = PositionStatus.Closing;
        pos.closedAt = uint64(block.timestamp);
    }

    /// @notice Settles a closing position, or an open one once trading has
    /// ended. Anyone may call it: the hints are verified, not trusted.
    function settlePosition(
        uint256 seasonId,
        address player,
        uint256 positionId,
        uint80 entryRoundHint,
        uint80 exitRoundHint
    ) external {
        Season storage s = _season(seasonId);
        Position storage pos = _position(seasonId, player, positionId);
        if (pos.status == PositionStatus.Settled) revert PositionAlreadySettled();
        _settle(seasonId, s, player, positionId, pos, entryRoundHint, exitRoundHint);
    }

    /// @notice Batch form of `settlePosition`. Positions already settled are
    /// skipped so that racing settlers do not make each other revert.
    function settlePositions(uint256 seasonId, SettleRequest[] calldata requests) external {
        Season storage s = _season(seasonId);
        for (uint256 i; i < requests.length; ++i) {
            SettleRequest calldata r = requests[i];
            Position storage pos = _position(seasonId, r.player, r.positionId);
            if (pos.status == PositionStatus.Settled) continue;
            _settle(seasonId, s, r.player, r.positionId, pos, r.entryRoundHint, r.exitRoundHint);
        }
    }

    // ---------------------------------------------------------------------
    // Results
    // ---------------------------------------------------------------------

    /// @notice Accepts the final order of the season. Anyone may compute it
    /// offchain and submit it; the contract checks it in one pass and the
    /// first valid submission wins. Payouts and career scores are assigned here.
    function submitRanking(uint256 seasonId, address[] calldata ordered) external {
        Season storage s = _season(seasonId);
        _requirePhase(s, Phase.Settling);

        uint256 n = s.participants.length;
        if (ordered.length != n) revert RankingLengthMismatch();

        uint256[] memory seen = new uint256[]((n >> 8) + 1);
        uint256[] memory equities = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            address who = ordered[i];
            Player storage p = _players[seasonId][who];
            if (!p.joined) revert NotParticipant(who);

            uint256 word = p.index >> 8;
            uint256 bit = 1 << (p.index & 0xff);
            if (seen[word] & bit != 0) revert DuplicatePlayer(who);
            seen[word] |= bit;

            if (p.unsettledPositions != 0) revert UnsettledPositions(who);

            equities[i] = _equity(s, p);
            if (i > 0 && equities[i] > equities[i - 1]) revert RankingOrderViolated(i);
        }

        s.ranked = true;
        s.ranking = ordered;
        _distribute(seasonId, s, ordered, equities);

        emit RankingSubmitted(seasonId, msg.sender);
    }

    function claim(uint256 seasonId) external nonReentrant {
        Season storage s = _season(seasonId);
        _requirePhase(s, Phase.Settled);

        uint256 amount = _claimable[seasonId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        _claimable[seasonId][msg.sender] = 0;
        s.paidOut += amount;

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Claimed(seasonId, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function seasonCount() external view returns (uint256) {
        return _seasons.length;
    }

    function getSeason(uint256 seasonId) external view returns (SeasonView memory v) {
        Season storage s = _season(seasonId);
        v.id = seasonId;
        v.phase = _phase(s);
        v.entryFee = s.entryFee;
        v.prizePool = s.prizePool;
        v.paidOut = s.paidOut;
        v.startingCapital = s.startingCapital;
        v.entryOpensAt = s.entryOpensAt;
        v.entryClosesAt = s.entryClosesAt;
        v.tradingEndsAt = s.tradingEndsAt;
        v.participants = uint32(s.participants.length);
        v.maxParticipants = s.maxParticipants;
        v.feeBps = s.feeBps;
        v.payoutBps = s.payoutBps;
    }

    function getPlayer(uint256 seasonId, address who) external view returns (PlayerView memory v) {
        Season storage s = _season(seasonId);
        Player storage p = _players[seasonId][who];
        v.joined = p.joined;
        v.index = p.index;
        v.score = p.score;
        v.leverageBps = p.leverageBps;
        v.unsettledPositions = p.unsettledPositions;
        v.rank = p.rank;
        v.realisedPnl = p.realisedPnl;
        v.riskWeightedAum = p.riskWeightedAum;
        v.aumCapacity = _capacity(s, p);
        v.equity = _equity(s, p);
        v.positionCount = _positions[seasonId][who].length;
        v.claimable = _claimable[seasonId][who];
    }

    function getPositions(uint256 seasonId, address who) external view returns (Position[] memory) {
        _season(seasonId);
        return _positions[seasonId][who];
    }

    function getParticipants(uint256 seasonId, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        address[] storage all = _season(seasonId).participants;
        if (offset >= all.length) return new address[](0);

        uint256 count = all.length - offset;
        if (limit < count) count = limit;
        page = new address[](count);
        for (uint256 i; i < count; ++i) {
            page[i] = all[offset + i];
        }
    }

    /// @notice The accepted order, best first. Empty until the season is settled.
    function getRanking(uint256 seasonId) external view returns (address[] memory) {
        return _season(seasonId).ranking;
    }

    function getAssets() external view returns (AssetView[] memory assets) {
        assets = new AssetView[](_assetSymbols.length);
        for (uint256 i; i < assets.length; ++i) {
            bytes32 symbol = _assetSymbols[i];
            Asset storage a = _assets[symbol];
            assets[i] = AssetView(symbol, a.feed, a.riskWeightBps, a.alwaysOpen, a.decimals);
        }
    }

    /// @notice Starting capital plus realised PnL, floored at zero. Open and
    /// unsettled positions are not included; after trading ends and every
    /// position is settled, this is the final equity the ranking is checked against.
    function equityOf(uint256 seasonId, address who) external view returns (uint256) {
        return _equity(_season(seasonId), _players[seasonId][who]);
    }

    function claimableOf(uint256 seasonId, address who) external view returns (uint256) {
        _season(seasonId);
        return _claimable[seasonId][who];
    }

    /// @notice `leverageBps = 30000 + score * 700`: 3x at score 0, 10x at 100.
    function leverageBpsFromScore(uint16 score) public pure returns (uint32) {
        if (score > MAX_SCORE) score = MAX_SCORE;
        return MIN_LEVERAGE_BPS + uint32(score) * LEVERAGE_BPS_PER_SCORE_POINT;
    }

    /// @notice `notional * (exit - entry) / entry`, negated for a short.
    function positionPnl(bool isLong, uint256 notional, uint256 entryPrice, uint256 exitPrice)
        public
        pure
        returns (int256)
    {
        int256 pnl = int256(notional) * (int256(exitPrice) - int256(entryPrice)) / int256(entryPrice);
        return isLong ? pnl : -pnl;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _settle(
        uint256 seasonId,
        Season storage s,
        address player,
        uint256 positionId,
        Position storage pos,
        uint80 entryRoundHint,
        uint80 exitRoundHint
    ) private {
        uint256 exitAfter;
        if (pos.status == PositionStatus.Closing) {
            exitAfter = pos.closedAt;
        } else {
            if (block.timestamp < s.tradingEndsAt) revert PositionStillOpen();
            exitAfter = s.tradingEndsAt;
        }

        Asset storage asset = _assets[pos.symbol];
        ChainlinkLib.Resolution memory entry =
            ChainlinkLib.resolveFirstRoundAfter(asset.feed, asset.decimals, pos.openedAt, entryRoundHint);
        ChainlinkLib.Resolution memory exit =
            ChainlinkLib.resolveFirstRoundAfter(asset.feed, asset.decimals, exitAfter, exitRoundHint);

        int256 pnl;
        if (entry.voided || exit.voided) {
            pos.voided = true;
        } else {
            pnl = positionPnl(pos.isLong, pos.notional, entry.price, exit.price);
        }

        pos.status = PositionStatus.Settled;
        pos.entryRoundId = entry.roundId;
        pos.exitRoundId = exit.roundId;
        pos.entryPrice = entry.price;
        pos.exitPrice = exit.price;
        pos.pnl = pnl;

        Player storage p = _players[seasonId][player];
        p.realisedPnl += pnl;
        p.riskWeightedAum -= _riskWeighted(pos.notional, asset);
        p.unsettledPositions--;

        emit PositionClosed(seasonId, player, positionId, pnl);
    }

    /// @dev Credits payouts, the platform fee and career scores for an
    /// accepted ranking. Players with equal equity form a group that shares
    /// the prizes of the places it spans equally, so the order a submitter
    /// picks inside a tie changes nothing.
    function _distribute(uint256 seasonId, Season storage s, address[] calldata ordered, uint256[] memory equities)
        private
    {
        uint256 n = ordered.length;
        if (n == 0) return;

        uint256 fee = s.prizePool * s.feeBps / BPS;
        if (fee > 0) _claimable[seasonId][owner] += fee;
        uint256[] memory prizes = _placePrizes(s, s.prizePool - fee, n);

        uint256 groupStart;
        for (uint256 i; i < n; ++i) {
            if (i + 1 < n && equities[i + 1] == equities[i]) continue;
            _creditGroup(seasonId, ordered, prizes, groupStart, i + 1);
            groupStart = i + 1;
        }
    }

    /// @dev Prize for each paid place. With fewer players than paid places,
    /// the curve is renormalised over the places that exist.
    function _placePrizes(Season storage s, uint256 distributable, uint256 players)
        private
        view
        returns (uint256[] memory prizes)
    {
        uint256 places = s.payoutBps.length < players ? s.payoutBps.length : players;
        uint256 totalBps;
        for (uint256 r; r < places; ++r) {
            totalBps += s.payoutBps[r];
        }

        prizes = new uint256[](places);
        for (uint256 r; r < places; ++r) {
            prizes[r] = distributable * s.payoutBps[r] / totalBps;
        }
    }

    /// @dev Credits the tied players at places [from, to).
    function _creditGroup(
        uint256 seasonId,
        address[] calldata ordered,
        uint256[] memory prizes,
        uint256 from,
        uint256 to
    ) private {
        uint256 groupPrize;
        for (uint256 r = from; r < to && r < prizes.length; ++r) {
            groupPrize += prizes[r];
        }
        uint256 each = groupPrize / (to - from);

        // Percentile of the group's average place: first = 100, last = 0.
        uint256 n = ordered.length;
        uint256 percentile = n >= 2 ? 100 * (2 * (n - 1) - (from + to - 1)) / (2 * (n - 1)) : 0;

        for (uint256 j = from; j < to; ++j) {
            address who = ordered[j];
            if (each > 0) _claimable[seasonId][who] += each;
            _players[seasonId][who].rank = uint32(from + 1);
            if (n >= 2) scoreOf[who] = uint16((uint256(scoreOf[who]) + percentile) / 2);
        }
    }

    function _validatePayoutCurve(uint16[] calldata payoutBps) private pure {
        uint256 places = payoutBps.length;
        if (places == 0 || places > MAX_PAID_PLACES) revert InvalidSeason();

        uint256 total;
        for (uint256 i; i < places; ++i) {
            if (payoutBps[i] == 0 || (i > 0 && payoutBps[i] > payoutBps[i - 1])) revert InvalidSeason();
            total += payoutBps[i];
        }
        if (total != BPS) revert InvalidSeason();
    }

    function _phase(Season storage s) private view returns (Phase) {
        if (s.ranked) return Phase.Settled;
        if (block.timestamp >= s.tradingEndsAt) return Phase.Settling;
        if (block.timestamp >= s.entryClosesAt) return Phase.Live;
        if (block.timestamp >= s.entryOpensAt) return Phase.Entry;
        return Phase.Upcoming;
    }

    function _requirePhase(Season storage s, Phase expected) private view {
        Phase actual = _phase(s);
        if (actual != expected) revert WrongPhase(expected, actual);
    }

    function _season(uint256 seasonId) private view returns (Season storage) {
        if (seasonId == 0 || seasonId > _seasons.length) revert SeasonNotFound();
        return _seasons[seasonId - 1];
    }

    function _participant(uint256 seasonId, address who) private view returns (Player storage p) {
        p = _players[seasonId][who];
        if (!p.joined) revert NotParticipant(who);
    }

    function _asset(bytes32 symbol) private view returns (Asset storage a) {
        a = _assets[symbol];
        if (a.feed == address(0)) revert AssetNotListed(symbol);
    }

    function _position(uint256 seasonId, address player, uint256 positionId)
        private
        view
        returns (Position storage)
    {
        Position[] storage positions = _positions[seasonId][player];
        if (positionId >= positions.length) revert PositionNotFound();
        return positions[positionId];
    }

    function _riskWeighted(uint256 notional, Asset storage asset) private view returns (uint256) {
        return notional * asset.riskWeightBps / BPS;
    }

    function _equity(Season storage s, Player storage p) private view returns (uint256) {
        if (!p.joined) return 0;
        int256 equity = int256(s.startingCapital) + p.realisedPnl;
        return equity > 0 ? uint256(equity) : 0;
    }

    function _capacity(Season storage s, Player storage p) private view returns (uint256) {
        return _equity(s, p) * p.leverageBps / BPS;
    }
}
