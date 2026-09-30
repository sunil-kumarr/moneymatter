import '../bootstrap';

import { INVESTMENT_TRANSACTION_CATEGORY } from '@bt/shared/types/investments';
import { logger } from '@js/utils';

import { connection } from '../models';
import { createHolding } from '../services/investments/holdings/create-holding.service';
import { createManualPrice } from '../services/investments/securities-price/create-manual-price.service';
import { createManualSecurity } from '../services/investments/securities/create-manual-security.service';
import { createInvestmentTransaction } from '../services/investments/transactions/create.service';

/**
 * One-time seed: replays the per-scheme unit transactions from all 4 Protean
 * NPS transaction statements (PRAN 110158977813, FY23-24 through the FY26-27
 * partial year) into real ICICI Pension Fund E/C/G holdings, so the NPS
 * portfolio's value comes from actual units × NAV instead of the earlier
 * cash-adjustment approximation. Run once via:
 *   NODE_ENV=development npx ts-node -r tsconfig-paths/register src/scripts/seed-nps-scheme-holdings.ts
 */
const USER_ID = 1;
const PORTFOLIO_ID = '01a0e738-3932-70b5-8e0c-327b3d1a038d';
const CURRENCY = 'INR';

type TxRow = {
  date: string;
  category: INVESTMENT_TRANSACTION_CATEGORY.buy | INVESTMENT_TRANSACTION_CATEGORY.sell;
  quantity: string;
  price: string;
  name: string;
};

type SchemeDef = {
  symbol: string;
  name: string;
  transactions: TxRow[];
  // NAV snapshots for dates with no transaction, so historical value is accurate.
  manualPrices: { date: string; price: number }[];
};

const buy = (date: string, quantity: string, price: string, name: string): TxRow => ({
  date,
  category: INVESTMENT_TRANSACTION_CATEGORY.buy,
  quantity,
  price,
  name,
});
const sell = (date: string, quantity: string, price: string, name: string): TxRow => ({
  date,
  category: INVESTMENT_TRANSACTION_CATEGORY.sell,
  quantity,
  price,
  name,
});

const schemes: SchemeDef[] = [
  {
    symbol: 'NPS-ICICI-E',
    name: 'ICICI Pension Fund Scheme E - Tier I (NPS)',
    manualPrices: [
      { date: '2024-03-31', price: 64.1159 },
      { date: '2025-03-31', price: 68.4023 },
      { date: '2026-03-31', price: 66.7599 },
      { date: '2026-09-25', price: 71.8246 },
    ],
    transactions: [
      buy('2023-10-03', '4.6410', '53.9684', 'Contribution on account of subscriber shifting (SBI to ICICI)'),
      sell('2023-10-07', '0.2791', '54.0172', 'Billing for Q2, 2023-2024'),
      buy('2023-12-28', '67.0210', '60.3885', 'Contribution for November, 2023'),
      buy('2023-12-28', '67.0210', '60.3885', 'By Arrear - Arrears'),
      buy('2023-12-28', '88.2750', '60.3885', 'By Arrear - Arrears'),
      buy('2023-12-28', '67.0210', '60.3885', 'By Arrear - Arrears'),
      sell('2024-01-06', '0.3144', '60.6745', 'Billing for Q3, 2023-2024'),
      buy('2024-01-24', '82.8286', '60.3656', 'Voluntary Contribution'),
      buy('2024-01-24', '327.1730', '60.3656', 'Voluntary Contribution'),
      buy('2024-01-24', '67.0464', '60.3656', 'Contribution for December, 2023'),
      buy('2024-02-22', '57.6815', '63.3704', 'Contribution for January, 2024'),
      buy('2024-03-18', '70.7557', '62.7412', 'Contribution for February, 2024'),
      sell('2024-04-06', '0.3346', '64.8452', 'Billing for Q4, 2023-2024'),
      buy('2024-04-22', '62.9632', '64.2804', 'Contribution for March, 2024'),
      buy('2024-05-29', '60.6339', '66.7497', 'Contribution for April, 2024'),
      buy('2024-07-01', '56.7546', '71.3122', 'Contribution for May, 2024'),
      sell('2024-07-06', '0.2142', '71.9581', 'Billing for Q1, 2024-2025'),
      buy('2024-08-19', '55.8124', '72.5161', 'By Arrear - Arrears'),
      buy('2024-09-24', '51.5336', '76.0047', 'By Arrear - Arrears'),
      sell('2024-10-05', '0.2526', '72.9785', 'Billing for Q2, 2024-2025'),
      sell('2024-11-22', '3.7321', '70.0489', 'Switch out to Scheme G (regulatory rebalancing)'),
      sell('2024-11-22', '7.4207', '70.0489', 'Switch out to Scheme C (regulatory rebalancing)'),
      buy('2025-01-07', '354.6375', '70.4945', 'Voluntary Contribution'),
      sell('2025-01-11', '0.1753', '71.6649', 'Billing for Q3, 2024-2025'),
      sell('2025-04-05', '0.1789', '66.6174', 'Billing for Q4, 2024-2025'),
      sell('2025-07-05', '0.1382', '74.2322', 'Billing for Q1, 2025-2026'),
      sell('2025-10-04', '0.1387', '73.1658', 'Billing for Q2, 2025-2026'),
      sell('2025-11-24', '22.2704', '76.2645', 'Switch out to Scheme G (regulatory rebalancing)'),
      sell('2025-11-24', '2.9402', '76.2645', 'Switch out to Scheme C (regulatory rebalancing)'),
      sell('2026-01-03', '0.2858', '77.8663', 'Billing for Q3, 2025-2026'),
      buy('2026-01-05', '321.5781', '77.7416', 'Voluntary Contribution'),
      sell('2026-04-04', '0.3063', '68.0193', 'Billing for Q4, 2025-2026'),
      sell('2026-07-04', '0.2867', '74.9195', 'Billing for Q1, 2026-2027'),
    ],
  },
  {
    symbol: 'NPS-ICICI-C',
    name: 'ICICI Pension Fund Scheme C - Tier I (NPS)',
    manualPrices: [
      { date: '2024-03-31', price: 38.9494 },
      { date: '2025-03-31', price: 42.5542 },
      { date: '2026-03-31', price: 45.0758 },
      { date: '2026-09-25', price: 46.3445 },
    ],
    transactions: [
      buy('2023-10-03', '4.0130', '37.4480', 'Contribution on account of subscriber shifting (SBI to ICICI)'),
      sell('2023-10-07', '0.2413', '37.3269', 'Billing for Q2, 2023-2024'),
      buy('2023-12-28', '63.9264', '37.9871', 'Contribution for November, 2023'),
      buy('2023-12-28', '63.9264', '37.9871', 'By Arrear - Arrears'),
      buy('2023-12-28', '84.1991', '37.9871', 'By Arrear - Arrears'),
      buy('2023-12-28', '63.9264', '37.9871', 'By Arrear - Arrears'),
      sell('2024-01-06', '0.2994', '38.0414', 'Billing for Q3, 2023-2024'),
      buy('2024-01-24', '78.6204', '38.1580', 'Voluntary Contribution'),
      buy('2024-01-24', '310.5508', '38.1580', 'Voluntary Contribution'),
      buy('2024-01-24', '63.6401', '38.1580', 'Contribution for December, 2023'),
      buy('2024-02-22', '56.8414', '38.5842', 'Contribution for January, 2024'),
      buy('2024-03-18', '68.6185', '38.8172', 'Contribution for February, 2024'),
      sell('2024-04-06', '0.3193', '38.9509', 'Billing for Q4, 2023-2024'),
      buy('2024-04-22', '62.2973', '38.9805', 'Contribution for March, 2024'),
      buy('2024-05-29', '61.7209', '39.3445', 'Contribution for April, 2024'),
      buy('2024-07-01', '61.1875', '39.6875', 'Contribution for May, 2024'),
      sell('2024-07-06', '0.2069', '39.7170', 'Billing for Q1, 2024-2025'),
      buy('2024-08-19', '60.4248', '40.1884', 'By Arrear - Arrears'),
      buy('2024-09-24', '57.6268', '40.7810', 'By Arrear - Arrears'),
      sell('2024-10-05', '0.2473', '40.7968', 'Billing for Q2, 2024-2025'),
      buy('2024-11-26', '12.5992', '41.2572', 'Switch in from Scheme E (regulatory rebalancing)'),
      buy('2025-01-07', '359.9763', '41.6694', 'Voluntary Contribution'),
      sell('2025-01-11', '0.1756', '41.6142', 'Billing for Q3, 2024-2025'),
      sell('2025-04-05', '0.1791', '42.8068', 'Billing for Q4, 2024-2025'),
      sell('2025-07-05', '0.1385', '43.8198', 'Billing for Q1, 2025-2026'),
      sell('2025-10-04', '0.1390', '44.3018', 'Billing for Q2, 2025-2026'),
      buy('2025-11-26', '4.9859', '44.9720', 'Switch in from Scheme E (regulatory rebalancing)'),
      sell('2026-01-03', '0.2921', '45.0812', 'Billing for Q3, 2025-2026'),
      buy('2026-01-05', '333.1075', '45.0305', 'Voluntary Contribution'),
      sell('2026-04-04', '0.3140', '45.0192', 'Billing for Q4, 2025-2026'),
      sell('2026-07-04', '0.2937', '46.4044', 'Billing for Q1, 2026-2027'),
    ],
  },
  {
    symbol: 'NPS-ICICI-G',
    name: 'ICICI Pension Fund Scheme G - Tier I (NPS)',
    manualPrices: [
      { date: '2024-03-31', price: 33.7821 },
      { date: '2025-03-31', price: 37.1933 },
      { date: '2026-03-31', price: 37.2259 },
      { date: '2026-09-25', price: 38.5547 },
    ],
    transactions: [
      buy('2023-10-03', '3.1319', '31.9931', 'Contribution on account of subscriber shifting (SBI to ICICI)'),
      sell('2023-10-07', '0.1888', '31.7711', 'Billing for Q2, 2023-2024'),
      buy('2023-12-28', '49.7273', '32.5559', 'Contribution for November, 2023'),
      buy('2023-12-28', '49.7273', '32.5559', 'By Arrear - Arrears'),
      buy('2023-12-28', '65.4971', '32.5559', 'By Arrear - Arrears'),
      buy('2023-12-28', '49.7273', '32.5559', 'By Arrear - Arrears'),
      sell('2024-01-06', '0.2332', '32.4914', 'Billing for Q3, 2023-2024'),
      buy('2024-01-24', '60.9132', '32.8336', 'Voluntary Contribution'),
      buy('2024-01-24', '240.6071', '32.8336', 'Voluntary Contribution'),
      buy('2024-01-24', '49.3068', '32.8336', 'Contribution for December, 2023'),
      buy('2024-02-22', '43.6620', '33.4872', 'Contribution for January, 2024'),
      buy('2024-03-18', '52.8612', '33.5921', 'Contribution for February, 2024'),
      sell('2024-04-06', '0.2477', '33.6588', 'Billing for Q4, 2023-2024'),
      buy('2024-04-22', '48.2913', '33.5240', 'Contribution for March, 2024'),
      buy('2024-05-29', '47.4189', '34.1408', 'Contribution for April, 2024'),
      buy('2024-07-01', '46.9121', '34.5096', 'Contribution for May, 2024'),
      sell('2024-07-06', '0.1609', '34.5474', 'Billing for Q1, 2024-2025'),
      buy('2024-08-19', '46.0902', '35.1250', 'By Arrear - Arrears'),
      buy('2024-09-24', '43.9249', '35.6681', 'By Arrear - Arrears'),
      sell('2024-10-05', '0.1913', '35.5825', 'Billing for Q2, 2024-2025'),
      buy('2024-11-26', '7.3159', '35.7330', 'Switch in from Scheme E (regulatory rebalancing)'),
      buy('2025-01-07', '276.5708', '36.1571', 'Voluntary Contribution'),
      sell('2025-01-11', '0.1359', '36.0521', 'Billing for Q3, 2024-2025'),
      sell('2025-04-05', '0.1383', '37.5044', 'Billing for Q4, 2024-2025'),
      sell('2025-07-05', '0.1067', '37.6477', 'Billing for Q1, 2025-2026'),
      sell('2025-10-04', '0.1074', '37.6027', 'Billing for Q2, 2025-2026'),
      buy('2025-11-26', '45.0580', '37.6945', 'Switch in from Scheme E (regulatory rebalancing)'),
      sell('2026-01-03', '0.2333', '37.8040', 'Billing for Q3, 2025-2026'),
      buy('2026-01-05', '265.2667', '37.6979', 'Voluntary Contribution'),
      sell('2026-04-04', '0.2506', '36.9820', 'Billing for Q4, 2025-2026'),
      sell('2026-07-04', '0.2344', '38.9849', 'Billing for Q1, 2026-2027'),
    ],
  },
];

async function seed(): Promise<void> {
  for (const scheme of schemes) {
    const security = await createManualSecurity({ symbol: scheme.symbol, name: scheme.name, currencyCode: CURRENCY });
    logger.info(`[NPS Seed] security ready: ${scheme.symbol} -> ${security.id}`);

    await createHolding({ userId: USER_ID, portfolioId: PORTFOLIO_ID, securityId: security.id });

    for (const tx of scheme.transactions) {
      await createInvestmentTransaction({
        userId: USER_ID,
        portfolioId: PORTFOLIO_ID,
        securityId: security.id,
        category: tx.category,
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fees: '0',
        name: tx.name,
      });
    }
    logger.info(`[NPS Seed] ${scheme.transactions.length} transactions replayed for ${scheme.symbol}`);

    for (const p of scheme.manualPrices) {
      await createManualPrice({ userId: USER_ID, securityId: security.id, date: p.date, price: p.price });
    }
    logger.info(`[NPS Seed] ${scheme.manualPrices.length} manual NAV snapshots recorded for ${scheme.symbol}`);
  }
}

seed()
  .then(async () => {
    logger.info('[NPS Seed] complete');
    await connection.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error({ message: '[NPS Seed] failed', error });
    try {
      await connection.sequelize.close();
    } catch {
      // best-effort cleanup
    }
    process.exit(1);
  });
