# Miracle — дизайн контрактов

Дополнение к `CONTRACTS-BRIEF.md`. Бриф остаётся основой; здесь — решения владельца по открытым вопросам, найденные на живой сети факты и всё, чем реализация отличается от брифа. Фронтенду достаточно раздела 3.

Утверждено владельцем 2026-09-16.

---

## 1. Факты с живой сети (проверено 2026-09-16)

- **На тестнете 46630 нет Chainlink.** По адресам фидов кода нет; каталог Chainlink знает только `robinhood-mainnet` (57 фидов, все 8 наших на месте, отклонение 0.5%, heartbeat 86400).
- **Фиды обновляются редко.** Раунд появляется при движении на 0.5% или раз в сутки. SGOV — раз в сутки в 00:00 UTC, на выходных пауза до 48 ч; SPY — от 1.5 до 24 ч; BTC — каждые 30–150 мин.
- **Фазы.** Все 8 фидов в фазе 1. Через прокси несуществующий раунд возвращает нули (не ревертит, `roundId` в ответе не равен запрошенному); несуществующая фаза ревертит.
- **Агрегатор** — `DualAggregator 1.0.0` с `checkEnabled = true`: из контракта читается только через прокси.
- **ArbOS 61**, EVM `cancun` поддерживается.

## 2. Решения владельца

| Вопрос | Решение |
|---|---|
| Цена выхода | Первый раунд после закрытия — как вход. Закрытие двухшаговое. |
| Сеть | Сразу мейннет 4663, бета-сезон с копеечным взносом. Тестнет не используется. |
| Часы торговли | 24/7 для всех активов. Ордер вне часов рынка исполняется по первому раунду после открытия рынка. |
| Счёт игрока | После сезона: процентиль места (1-е = 100, последнее = 0); новый счёт = (старый + процентиль) / 2. |
| Кривая выплат | Параметр сезона. По умолчанию топ-10: 25/18/13/10/8/7/6/5/4/4 %. |
| Комиссия площадки | Параметр сезона, потолок 20%. На v1 — 0%. |
| Боевой сезон | Взнос 0.01 ETH, торговля 14 дней (запись — 3 дня перед торговлей). |
| Аудит | Не проводится. Вместо него — потолок фонда: `maxParticipants` в каждом сезоне. |

## 3. Отличия от брифа

1. `createSeason` получает ещё три параметра: `uint32 maxParticipants`, `uint16 feeBps`, `uint16[] payoutBps`.
2. `closePosition(seasonId, positionId)` — без подсказки, только фиксирует `closedAt`.
3. Новые `settlePosition(seasonId, player, positionId, entryRoundHint, exitRoundHint)` и пакетный `settlePositions` — вызывает кто угодно. Событие `PositionClosed` с PnL испускается здесь.
4. `equityOf` = стартовый капитал + реализованный PnL, не ниже 0. Открытые позиции не учитываются: живой лидерборд фронт считает офчейн.
5. Проверка heartbeat из п. 7.3 брифа не применяется: контракт никогда не оценивает по цене «сейчас», только по первому раунду после момента T. Проверки `answer > 0` и `answeredInRound >= roundId` остаются.
6. Не больше 20 нерассчитанных позиций на игрока — чтобы спамом нельзя было заблокировать расчёт сезона.
7. Символ в `listAsset` записывается один раз — владелец не может подменить фид посреди сезона.
8. Новые view: `seasonCount`, `getParticipants`, `getRanking`, `getAssets`, `scoreOf`.
9. Деплой в мейннет, в `DEPLOYMENTS` заполняется только `game` для 4663.
10. «После» строгое: раунд засчитывается при `updatedAt > T`, предыдущий должен быть `updatedAt <= T` (в брифе `>=` и `<`). Блоки идут каждые ~0.1 с, а время в них — целыми секундами: раунд из той же секунды мог попасть в более ранний блок, и игрок видел его цену до открытия.
11. ABI включает ошибки библиотеки (`RoundNotPublished`, `HintNotAfterTimestamp`, `HintNotFirstAfterTimestamp`) — фронт может их расшифровывать.

## 4. Контракт `MiracleGame`

### Интерфейс

```solidity
// конфигурация (владелец)
function listAsset(bytes32 symbol, address feed, uint16 riskWeightBps, bool alwaysOpen) external;
function createSeason(
    uint256 entryFee,
    uint64  entryOpensAt,
    uint64  entryClosesAt,
    uint64  tradingEndsAt,
    uint256 startingCapital,
    uint32  maxParticipants,
    uint16  feeBps,
    uint16[] calldata payoutBps
) external returns (uint256 seasonId);
function transferOwnership(address newOwner) external;

// игра
function joinSeason(uint256 seasonId) external payable;
function openPosition(uint256 seasonId, bytes32 symbol, bool isLong, uint256 notional) external returns (uint256 positionId);
function closePosition(uint256 seasonId, uint256 positionId) external;
function settlePosition(uint256 seasonId, address player, uint256 positionId, uint80 entryRoundHint, uint80 exitRoundHint) external;
function settlePositions(uint256 seasonId, SettleRequest[] calldata requests) external;
function submitRanking(uint256 seasonId, address[] calldata ordered) external;
function claim(uint256 seasonId) external;

// чтение
function seasonCount() external view returns (uint256);
function getSeason(uint256 seasonId) external view returns (SeasonView memory);
function getPlayer(uint256 seasonId, address who) external view returns (PlayerView memory);
function getPositions(uint256 seasonId, address who) external view returns (Position[] memory);
function getParticipants(uint256 seasonId, uint256 offset, uint256 limit) external view returns (address[] memory);
function getRanking(uint256 seasonId) external view returns (address[] memory);
function getAssets() external view returns (AssetView[] memory);
function equityOf(uint256 seasonId, address who) external view returns (uint256);
function claimableOf(uint256 seasonId, address who) external view returns (uint256);
function scoreOf(address who) external view returns (uint16);
```

Сезоны нумеруются с 1. `positionId` — индекс в списке позиций игрока в сезоне.

### Фазы

Порядок совпадает с `SeasonPhase` в `types.ts`:

| Фаза | Условие |
|---|---|
| `Upcoming` (0) | `now < entryOpensAt` |
| `Entry` (1) | `entryOpensAt <= now < entryClosesAt` |
| `Live` (2) | `entryClosesAt <= now < tradingEndsAt` — `tradingStartsAt = entryClosesAt` |
| `Settling` (3) | `now >= tradingEndsAt`, рейтинг не принят |
| `Settled` (4) | рейтинг принят |

### Потоки

**joinSeason** — фаза `Entry`, `msg.value == entryFee`, игрок ещё не в сезоне, участников меньше `maxParticipants`. Игрок получает индекс; счёт снимается в момент входа, плечо `30000 + score * 700` фиксируется на весь сезон.

**openPosition** — фаза `Live`, актив залистен, `notional > 0`, нерассчитанных позиций меньше 20. Цена не читается, пишется `openedAt`. Проверка капитала:

```
capital   = startingCapital + realisedPnl          (≤ 0 → ёмкость 0)
capacity  = capital * leverageBps / 10000
aum'      = aum + notional * riskWeightBps / 10000
требуется aum' <= capacity
```

`aum` включает позиции в статусах `Open` и `Closing`.

**closePosition** — фаза `Live`, позиция `Open` → `Closing`, `closedAt = now`.

**settlePosition** — кто угодно.

- Момент выхода: `closedAt` для `Closing`; `tradingEndsAt` для `Open` (только после конца торговли).
- Вход — первый раунд с `updatedAt > openedAt`, выход — первый раунд с `updatedAt > момент выхода`. Проверка общая, см. раздел 5.
- `pnl = notional * (exit - entry) / entry`, со знаком минус для шорта. Цены в 1e18.
- Если фид мёртв или раунд непригоден — позиция аннулируется, `pnl = 0`.
- `realisedPnl += pnl`, `aum` уменьшается, статус `Settled`, событие `PositionClosed`.
- Пакетная версия пропускает уже рассчитанные позиции, на остальных ошибках ревертит.

**submitRanking** — фаза `Settling`, кто угодно, первая валидная подача. За один проход:

1. длина = числу участников;
2. каждый адрес — участник, индекс не отмечен в битмапе (нет дубликатов);
3. у каждого 0 нерассчитанных позиций;
4. эквити не возрастает вдоль массива.

Выплаты:

```
fee           = prizePool * feeBps / 10000                → claimable владельца
distributable = prizePool - fee
places        = min(payoutBps.length, n)
share(r)      = distributable * payoutBps[r] / Σ payoutBps[0..places)     для r < places
```

Игроки с равным эквити образуют группу `[s, e)`; каждый получает `Σ share(r) по группе / (e - s)`. Место в группе — `s + 1`.

Счёт (только если участников ≥ 2):

```
percentile = 100 * (2(n-1) - (s + e - 1)) / (2(n-1))       // среднее место группы
scoreOf    = (scoreOf + percentile) / 2
```

**claim** — фаза `Settled`, сумма > 0. Долг обнуляется до отправки ETH, плюс guard от реентранси.

### Проверки при создании

- `entryOpensAt < entryClosesAt < tradingEndsAt`, `tradingEndsAt > now`;
- `startingCapital > 0`, `maxParticipants > 0`, `feeBps <= 2000`;
- `payoutBps`: от 1 до 100 элементов, каждый > 0, не возрастают, сумма = 10000.

`listAsset`: символ не пустой и не залистен, у фида есть код, `riskWeightBps > 0`, `decimals() <= 18`.

## 5. `ChainlinkLib.resolveFirstRoundAfter` — первый раунд после момента T

Подсказка `hint` = `(phase << 64) | aggregatorRound`.

1. Прочитать раунд `hint` через прокси (`try/catch`; существует, если не ревертнул, `updatedAt != 0` и `roundId` совпал).
2. Если раунд не существует или `updatedAt <= T`:
   - если после T фид ещё ничего не публиковал, `hint` — его последний раунд и `now >= T + 7 дней` → **фид мёртв, аннулировать**;
   - иначе ревертнуть (`RoundNotPublished` / `HintNotAfterTimestamp`).
3. `updatedAt > T`. Найти предыдущий раунд:
   - `aggregatorRound > 1` → `hint - 1`, требуется `updatedAt <= T`, иначе `HintNotFirstAfterTimestamp`;
   - `aggregatorRound == 1`, фаза 1 → предыдущего раунда нет, проверка пройдена;
   - `aggregatorRound == 1`, фаза > 1 → последний раунд предыдущей фазы ищется галопом и бинарным поиском по существованию раундов (до ~128 view-вызовов, на этой сети это копейки), требуется `updatedAt <= T`. Фаза без раундов пропускается.
4. Если `answer <= 0` или `answeredInRound < roundId` → аннулировать.
5. Вернуть цену, нормализованную в 1e18.

Аннулирование не даёт игроку выбора: раунд определяется моментом T, а не подсказкой.

## 6. Что отдаётся в `packages/shared`

- `src/abi/MiracleGame.json` и `src/abi/MiracleGame.ts` (`as const` для типизации viem);
- строка экспорта ABI в `src/index.ts` — глубокий импорт закрыт полем `exports`;
- `src/rounds.ts` — `findFirstRoundAfter(reader, timestamp, now)` ищет подсказку (общий для фронта и кипера), с тестами;
- адрес `game` в `DEPLOYMENTS[4663]`.

`types.ts` не меняется.

## 7. Тесты

- денежные пути из п. 9 брифа: вход учитывает взнос; рейтинг отклоняет неверный порядок и дубликаты; claim платит верную сумму; claim нельзя повторить;
- инвариант: сумма выплат сезона ≤ собранный фонд (фаззинг по числу игроков, PnL, кривым);
- реентранси на claim;
- проверка раунда: подсказка раньше T, не первая после T, граница фаз, мёртвый фид;
- совпадение чисел с `formulas.ts`;
- форк-тест на реальном фиде SPY (пропускается без RPC).

## 8. Деплой

- `script/Deploy.s.sol` — контракт, листинг 8 активов (веса и фиды как в `assets.ts`), бета-сезон.
- Бета-сезон: взнос 0.0001 ETH, запись 24 ч, торговля 7 дней, капитал 100 000, топ-10, комиссия 0, до 100 участников.
- Ключ деплоя — в `packages/contracts/.env`, в git не попадает.

## 9. Известные риски (для будущего аудита)

- **Аудит не проводился.** Потери ограничены `entryFee × maxParticipants` одного сезона.
- **Нет аварийного возврата.** Если рейтинг никто не подаст, фонд не выплачивается. Подать может любой; расчёт позиций всегда возможен благодаря аннулированию при мёртвом фиде.
- **Мультиаккаунты** позволяют накручивать счёт (и плечо), платя взносы.
- **Нестандартная смена фазы Chainlink**, при которой старый агрегатор продолжает публиковать после переключения, теоретически даёт два валидных раунда.
- **Нет ликвидаций.** Игрок в глубоком нереализованном минусе может открывать позиции в пределах ёмкости от реализованного капитала; эквити на финише не ниже 0.
- **Закрытие по SGOV** рассчитывается до суток; пока позиция не рассчитана, она занимает ёмкость.

## 10. Статус и как пользоваться

### Проверено (2026-09-16)

- `forge test`: 79 тестов + 4 форк-теста на настоящем фиде SPY (`RPC_URL=... forge test`).
- Мутационная проверка: удаление проверки дубликатов, проверки предыдущего раунда, деления ничьих или обеих защит `claim` ловится тестами.
- `packages/shared`: 45 тестов, typecheck; `apps/web` typecheck не сломан.
- Полный цикл на локальном форке мейннета: деплой скриптом, 8 активов на реальных фидах, вход, сделки, отказ по капиталу, кипер (расчёт + рейтинг), `claim`, отказ повторного `claim`. Деплой ≈ 5.5M газа ≈ 0.00055 ETH.

### Интеграционный деплой в мейннет — выполнен 2026-09-16

Тестовый: для подключения настоящего адаптера фронтенда. **Не входит в `DEPLOYMENTS`** — таблица содержит только контракты, которые видят игроки (на неё ссылается `/token`). Для разработки указывайте этот адрес локальным переопределением.

| | |
|---|---|
| **MiracleGame** | `0x60d838DD3A3920Bf208CB87155BC7EFFdE408E7C` (chainId 4663) |
| Владелец | `0xef048611d7F3077b35Fab260565886186fDa32bA` |
| Деплой | блок 64588520, tx `0xbb4bd8052b6d2517847fbdd4ce25434125340053e324a519629acac29e58d160` — события сканировать с этого блока |
| Стоимость | 10 транзакций (контракт, 8 активов, сезон), 0.000208 ETH |
| Исходный код | Sourcify: exact match (creation + runtime) — https://repo.sourcify.dev/4663/0x60d838DD3A3920Bf208CB87155BC7EFFdE408E7C |
| Blockscout | https://robinhoodchain.blockscout.com/address/0x60d838DD3A3920Bf208CB87155BC7EFFdE408E7C — API за Cloudflare, автоверификация не прошла |

**Бета-сезона не будет** (решение владельца 2026-09-16). Сезон 1 этого контракта — тестовый, для подключения настоящего адаптера фронтенда; игрокам его не показывать.

Кроме сезона 1 на этом контракте есть сезоны 2 и 3 — репетиция таймера 2026-09-17. Тоже не для игроков.

### Боевой деплой — выполнен 2026-09-17

Тот, который видят игроки. Записан в `DEPLOYMENTS[4663].game`, на него ссылается `/token`.

| | |
|---|---|
| **MiracleGame** | `0x1b772a789515E5711FEd03CE0c155fb31F1a7C28` (chainId 4663) |
| Владелец | `0xef048611d7F3077b35Fab260565886186fDa32bA` |
| Стоимость | 0.000242 ETH (деплой, 8 активов, сезон) |
| Blockscout | https://robinhoodchain.blockscout.com/address/0x1b772a789515E5711FEd03CE0c155fb31F1a7C28 |

Беты не было: сезон 1 этого контракта — настоящий, поэтому номер сезона на экране совпадает с номером сезона, в который играют.

**Сезон 1:** взнос 0.01 ETH, до 100 участников, капитал 100 000, топ-10, комиссия 0.

- запись: 2026-09-17 19:47 UTC → 2026-09-20 19:47 UTC;
- торговля: 2026-09-20 19:47 UTC → 2026-10-04 19:47 UTC.

Прочитано обратно из контракта: фаза `Entry`, все 8 активов с весами из `assets.ts`, кривая 2500/1800/1300/1000/800/700/600/500/400/400. `FIRST_SEASON.opensAt` = 1789674471, совпадает с `entryOpensAt` в контракте — лендинг по этому полю решает, говорить ли «сезон открыт».

**После конца торговли** (2026-10-04 19:47 UTC) рейтинг нужно подать кипером, иначе призы не выплачиваются и фонд стоит на контракте. Вызвать может кто угодно.

Параметры тестового сезона 1: взнос 0.0001 ETH, до 100 участников, капитал 100 000, топ-10, комиссия 0.

- запись: 2026-09-16 14:42 UTC → 2026-09-17 14:42 UTC;
- торговля: 2026-09-17 14:42 UTC → 2026-09-24 14:42 UTC.

Все 8 активов прочитаны обратно из контракта: фиды и веса совпадают с `assets.ts`, `decimals` = 8.

### Эксплуатация

```
pnpm --filter @miracle/contracts season                    # новый сезон (GAME_ADDRESS, параметры — env, см. CreateSeason.s.sol)
pnpm --filter @miracle/contracts keeper -- --season 1      # рассчитать позиции, после конца торговли — подать рейтинг
pnpm --filter @miracle/contracts keeper -- --season 1 --dry-run
pnpm --filter @miracle/contracts abi                       # пересобрать ABI в shared после изменений контракта
```

Кипер можно запускать сколько угодно раз. Позиции с `Closing` он рассчитывает, как только появился раунд выхода, — фронт может звать его логику сам (`findFirstRoundAfter` + `settlePosition`), чтобы PnL появлялся без ожидания кипера.

### Для фронтенда

- ABI: `import { miracleGameAbi } from "@miracle/shared"`.
- Символ актива — ASCII, дополненный нулями справа до bytes32: `stringToHex("SPY", { size: 32 })`.
- Суммы капитала, номинала, эквити, PnL и цены — WAD (1e18). `positionId` — индекс в `getPositions`.
- `Position.status`: 0 Open, 1 Closing (ждёт раунда выхода), 2 Settled. `entryPrice` известен только после расчёта; до этого фронт может показать оценку, найдя раунд входа через `findFirstRoundAfter`.
- `SeasonView.phase` совпадает по порядку с `SeasonPhase`; `tradingStartsAt = entryClosesAt`.
