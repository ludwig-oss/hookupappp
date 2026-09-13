import type { SchoolQuizQuestion } from '../models/schoolCurriculum.js';

export interface FinanceLesson {
  id: string;
  day: number;
  title: string;
  minutes: number;
  guideId: string;
  summary: string;
  teach: string[];
  workout: string;
  quiz: SchoolQuizQuestion[];
}

function q(id: string, question: string, options: string[], correctIndex: number): SchoolQuizQuestion {
  return { id, question, options, correctIndex };
}

/** ~10-minute daily finance literacy track (cycles). Mandatory for men; opt-in for women. */
export const FINANCE_LESSONS: FinanceLesson[] = [
  {
    id: 'pay-yourself-first',
    day: 1,
    title: 'Pay yourself first (Babylon)',
    minutes: 10,
    guideId: 'george-clason',
    summary: 'Save at least 10% before lifestyle spending.',
    teach: [
      'Wealth starts with a habit: move money to savings/investing the moment you get paid.',
      'A classic rule from The Richest Man in Babylon: keep at least one-tenth of what you earn.',
      'Automate the transfer so willpower is not required every payday.',
      'Live on the remaining 90% — adjust lifestyle to fit, not the other way around.',
    ],
    workout: 'Set or raise an automatic transfer of at least 10% of next paycheck to savings/investing.',
    quiz: [
      q('1', '“Pay yourself first” means:', ['Spend first, save leftovers', 'Save/invest a set % as soon as you are paid', 'Only save when you feel rich'], 1),
      q('2', 'A common starter savings rate from Babylon wisdom is about:', ['1%', '10%', '50% with no plan'], 1),
      q('3', 'The easiest way to keep the habit is:', ['Remember manually each month', 'Automate the transfer on payday', 'Wait until December'], 1),
    ],
  },
  {
    id: '401k-match',
    day: 2,
    title: 'Never skip the 401(k) match',
    minutes: 10,
    guideId: 'finance-401k-match',
    summary: 'Employer match is free return — grab it.',
    teach: [
      'If your workplace offers a match (e.g. 100% of the first 3–6% you contribute), that match is part of your compensation.',
      'Contribute at least enough to get the full match before chasing other fancy investments.',
      'Learn your vesting schedule: when matched dollars become fully yours.',
      'Increase contributions when you get raises so lifestyle creep does not eat the gain.',
    ],
    workout: 'Check your plan’s match % and confirm you are contributing at least that much.',
    quiz: [
      q('1', 'An employer 401(k) match is best thought of as:', ['A loan you must repay', 'Free compensation if you contribute enough', 'A scam'], 1),
      q('2', 'Before exotic investments, you should usually:', ['Ignore the match', 'Contribute enough to get the full match', 'Cash out the 401(k) yearly'], 1),
      q('3', 'Vesting means:', ['Your password length', 'When matched money becomes fully yours', 'Your credit score'], 1),
    ],
  },
  {
    id: 'roth-compound',
    day: 3,
    title: 'Roth growth & compounding',
    minutes: 10,
    guideId: 'finance-roth-ira',
    summary: 'Tax-advantaged accounts + time = exponential growth.',
    teach: [
      'Compounding means returns earn returns. Time matters more than perfect timing.',
      'Roth accounts: you typically pay tax now; qualified growth and withdrawals can be tax-free later (rules apply).',
      'Low fees matter because costs also compound against you.',
      'Consistency beats guessing the next hot stock.',
    ],
    workout: 'Open or review a Roth IRA/401(k) Roth option and note this year’s contribution room.',
    quiz: [
      q('1', 'Compounding works best with:', ['One lucky day trade', 'Time + reinvested returns', 'High fees'], 1),
      q('2', 'A typical Roth idea is:', ['Tax now, tax-free growth later (if rules met)', 'Never pay any tax ever with no rules', 'Only for day trading'], 1),
      q('3', 'High investment fees:', ['Help you compound faster', 'Quietly reduce long-term wealth', 'Do not matter'], 1),
    ],
  },
  {
    id: 'index-bogle',
    day: 4,
    title: 'Low-cost index funds (Bogle)',
    minutes: 10,
    guideId: 'john-bogle',
    summary: 'Own the market cheaply. Stay the course.',
    teach: [
      'Broad index funds own thousands of companies for a tiny fee.',
      'Most active funds underperform after fees over long periods.',
      'Pick a simple diversified mix you can hold through crashes.',
      'Ignore hype tickers until your core is funded.',
    ],
    workout: 'Compare the expense ratio of one fund you own (or want) vs a broad index alternative.',
    quiz: [
      q('1', 'John Bogle’s big idea was:', ['Day trade options', 'Low-cost broad index investing', 'Only buy gold coins'], 1),
      q('2', 'Expense ratios matter because:', ['Fees compound against you', 'Higher fees always mean higher returns', 'Fees are illegal'], 0),
      q('3', 'A “stay the course” investor:', ['Panic sells every dip', 'Keeps a simple plan through volatility', 'Changes strategy weekly'], 1),
    ],
  },
  {
    id: 'roth-vs-trad',
    day: 5,
    title: 'Roth vs Traditional timing',
    minutes: 10,
    guideId: 'finance-roth-vs-trad',
    summary: 'Pay tax now or later — pick with your bracket in mind.',
    teach: [
      'Traditional: often tax-deferred now; taxed on withdrawal.',
      'Roth: taxed now; qualified withdrawals can be tax-free.',
      'If you expect higher taxes later, Roth can look better; if lower later, Traditional can help — reality is personal.',
      'Many people use both over a career.',
    ],
    workout: 'Write one sentence: “I expect my tax rate in retirement to be ___ than today.” Then note Roth vs Trad lean.',
    quiz: [
      q('1', 'Traditional retirement contributions often:', ['Are taxed twice up front', 'Reduce taxable income now and are taxed later', 'Are illegal'], 1),
      q('2', 'Roth contributions are usually:', ['Made with after-tax money for potential tax-free growth later', 'Always deductible', 'Only for corporations'], 0),
      q('3', 'Choosing Roth vs Traditional depends a lot on:', ['Your zodiac sign', 'Current vs expected future tax situation', 'Shoe size'], 1),
    ],
  },
  {
    id: 'emergency-liquidity',
    day: 6,
    title: 'Emergency fund liquidity',
    minutes: 10,
    guideId: 'finance-liquidity',
    summary: 'Keep cash for shocks so you do not sell investments in a panic.',
    teach: [
      'Aim for roughly 3–6 months of essential expenses in a safe, liquid account (more if income is unstable).',
      'This money is for job loss, medical, or urgent repairs — not concerts.',
      'High-yield savings can pay a little interest while staying accessible.',
      'Fund the emergency jar before aggressive investing or speculation.',
    ],
    workout: 'Calculate one month of essential bills. Multiply by 3. That is your starter target.',
    quiz: [
      q('1', 'An emergency fund should usually be:', ['All in meme coins', 'Liquid and safe for real emergencies', 'Locked for 30 years'], 1),
      q('2', 'A common starter target is about:', ['3–6 months of essentials', 'One day of coffee money', 'Your entire paycheck in crypto'], 0),
      q('3', 'Without an emergency fund, a surprise bill often forces you to:', ['Sell investments or take bad debt', 'Become famous', 'Ignore it forever safely'], 0),
    ],
  },
  {
    id: 'zero-based-budget',
    day: 7,
    title: 'Zero-based budgeting',
    minutes: 10,
    guideId: 'finance-zero-based',
    summary: 'Give every dollar a job each month.',
    teach: [
      'List income. Assign every dollar to bills, savings, investing, fun — until nothing is unassigned.',
      'This reveals leaks: subscriptions, delivery, “small” daily spends.',
      'Dating life fits in a planned “social” category so money stress does not hit the relationship.',
      'Review weekly for 10 minutes; adjust, do not shame-spiral.',
    ],
    workout: 'Write this month’s income and assign categories until the remainder is $0.',
    quiz: [
      q('1', 'Zero-based budgeting means:', ['You earn zero', 'Every dollar is assigned a job', 'Banks delete your account'], 1),
      q('2', 'A dating/social budget line helps because:', ['It prevents money fights and guilt spending', 'It bans all dates', 'It replaces communication'], 0),
      q('3', 'When a category overspends you should:', ['Ignore it', 'Adjust next week’s plan', 'Quit saving forever'], 1),
    ],
  },
  {
    id: 'rebalance',
    day: 8,
    title: 'Rebalancing the portfolio',
    minutes: 10,
    guideId: 'finance-rebalance',
    summary: 'Keep your risk mix on target as markets move.',
    teach: [
      'If stocks rip and become 90% of a 70/30 plan, you are riskier than intended.',
      'Rebalancing sells a bit of winners and buys laggards back to target.',
      'Do it on a calendar (e.g. yearly) or when drift exceeds a band (e.g. 5%).',
      'Inside tax-advantaged accounts is often cleaner than taxable churn.',
    ],
    workout: 'Write your target mix (e.g. 80% stocks / 20% bonds). Check if you are within 5%.',
    quiz: [
      q('1', 'Rebalancing mainly restores:', ['Your Twitter following', 'Your target risk mix', 'Your credit score'], 1),
      q('2', 'After a huge stock rally, a 70/30 investor often needs to:', ['Buy even more stocks only', 'Trim stocks / add bonds toward target', 'Go to 100% cash forever'], 1),
      q('3', 'A simple rebalance trigger is:', ['Every commercial break', 'Yearly or when allocation drifts past a band', 'Never'], 1),
    ],
  },
  {
    id: 'fire-basics',
    day: 9,
    title: 'FIRE & financial independence',
    minutes: 10,
    guideId: 'finance-fire',
    summary: 'High savings rate + invested capital = options.',
    teach: [
      'Financial independence means investment income / flexible work can cover your life.',
      'The lever is savings rate more than a perfect stock pick.',
      'Automate investing so independence compounds while you date, work, and live.',
      'Independence is not isolation — it is the ability to choose better relationships without money panic.',
    ],
    workout: 'Estimate your savings rate this month: saved÷income. Write one cut that raises it 5%.',
    quiz: [
      q('1', 'The biggest FIRE lever for most people is:', ['Lottery tickets', 'Savings rate + consistent investing', 'Only crypto leverage'], 1),
      q('2', 'Financial independence mainly buys you:', ['Permission to be rude', 'Options and less money panic', 'Guaranteed happiness'], 1),
      q('3', 'Automation helps because:', ['It removes monthly willpower fights', 'It bans all spending', 'Banks hate it'], 0),
    ],
  },
  {
    id: 'four-percent',
    day: 10,
    title: 'The 4% rule (rough guide)',
    minutes: 10,
    guideId: 'finance-4-percent',
    summary: 'A research rule of thumb for sustainable withdrawals — not a guarantee.',
    teach: [
      'Classic studies suggested ~4% initial withdrawal from a diversified portfolio, adjusted for inflation, with historical survival odds — not a promise.',
      'Your number depends on market sequence, fees, taxes, and flexibility.',
      'Build a bigger cushion if you want earlier independence or less risk.',
      'Practice flexible spending: cut lifestyle in bad markets.',
    ],
    workout: 'Multiply yearly spending by 25 (4% rule inverse). That is a rough nest-egg sketch.',
    quiz: [
      q('1', 'The 4% rule is best described as:', ['A legal guarantee', 'A historical rule of thumb for withdrawals', 'A day-trading strategy'], 1),
      q('2', 'Yearly spend × 25 roughly estimates:', ['Credit score', 'Nest egg for a 4% withdrawal sketch', 'Car insurance'], 1),
      q('3', 'In a bad market year, flexibility means:', ['Increasing luxury spending', 'Temporarily cutting spending', 'Ignoring the plan forever'], 1),
    ],
  },
  {
    id: 'dca',
    day: 11,
    title: 'Dollar-cost averaging',
    minutes: 10,
    guideId: 'finance-dca',
    summary: 'Invest fixed amounts on a schedule.',
    teach: [
      'Buy the same dollar amount regularly regardless of price.',
      'You buy more shares when prices are low and fewer when high — automatically.',
      'Removes the “wait for the perfect dip” trap.',
      'Pair DCA with a boring index core.',
    ],
    workout: 'Turn on or schedule a recurring investment of a fixed amount on payday.',
    quiz: [
      q('1', 'Dollar-cost averaging means:', ['Investing only once ever', 'Investing fixed amounts on a schedule', 'Only buying at all-time highs'], 1),
      q('2', 'A benefit of DCA is:', ['Eliminating all risk', 'Reducing timing anxiety', 'Guaranteeing 100% returns'], 1),
      q('3', 'DCA works best with:', ['A clear long-term vehicle like broad funds', 'Random tips from strangers', 'Max leverage'], 0),
    ],
  },
  {
    id: 'three-fund',
    day: 12,
    title: 'Three-fund simplicity',
    minutes: 10,
    guideId: 'finance-bogleheads',
    summary: 'US total market + international + bonds (as needed).',
    teach: [
      'A classic simple portfolio: total US stock, total international stock, and a bond fund for ballast.',
      'Ages and goals change the bond %.',
      'Fewer overlapping funds = less confusion and accidental concentration.',
      'Rebalance the three; ignore noise.',
    ],
    workout: 'List every investment you own. Circle overlaps. Note how a three-fund core would simplify it.',
    quiz: [
      q('1', 'A three-fund portfolio usually includes:', ['Only meme coins', 'Broad US, international, and bonds', 'Twenty overlapping sector funds'], 1),
      q('2', 'Bonds in a simple portfolio mainly provide:', ['Guaranteed riches overnight', 'Ballast / risk reduction', 'Free houses'], 1),
      q('3', 'Too many overlapping funds can:', ['Create accidental concentration', 'Always lower fees', 'Eliminate taxes'], 0),
    ],
  },
  {
    id: 'cash-on-cash',
    day: 13,
    title: 'Cash-on-cash return',
    minutes: 10,
    guideId: 'finance-cash-on-cash',
    summary: 'Annual cash flow ÷ cash you invested.',
    teach: [
      'For rentals: (yearly cash after expenses) / (down payment + closing + rehab cash).',
      'It ignores some paper appreciation — that is fine; it measures cash efficiency.',
      'Compare deals with the same honesty about vacancy, repairs, and CapEx.',
      'Pretty kitchens do not equal yield.',
    ],
    workout: 'Practice: if you invest $50k cash and net $4k/year, cash-on-cash = 8%.',
    quiz: [
      q('1', 'Cash-on-cash roughly equals:', ['Price ÷ bedrooms', 'Annual cash flow ÷ cash invested', 'Credit score ÷ 10'], 1),
      q('2', 'Ignoring repairs/vacancy in the math:', ['Is fine forever', 'Lies about the return', 'Raises the property value'], 1),
      q('3', 'Cash-on-cash is useful because it:', ['Measures cash efficiency of a deal', 'Predicts love', 'Replaces insurance'], 0),
    ],
  },
  {
    id: 'one-percent-screen',
    day: 14,
    title: 'The 1% rental screen',
    minutes: 10,
    guideId: 'finance-one-percent',
    summary: 'Rough filter: monthly rent ≈ 1% of purchase price.',
    teach: [
      'Example: $200k property → ~$2k/mo rent as a rough gross screen (many markets fail this).',
      'Failing the screen is not always a no — but you must underwrite harder.',
      'Always subtract taxes, insurance, maintenance, vacancy, CapEx.',
      'Do not buy on vibes or Instagram flips.',
    ],
    workout: 'Look up one local listing. Divide listed rent by price. Note if it clears ~1%.',
    quiz: [
      q('1', 'The 1% rule compares:', ['Mortgage rate to inflation', 'Monthly rent to purchase price', 'Credit cards to debit cards'], 1),
      q('2', 'If a deal fails the 1% screen you should:', ['Buy immediately emotionally', 'Underwrite carefully or walk', 'Ignore all numbers'], 1),
      q('3', 'Gross rent screens still require:', ['Expense honesty', 'No insurance', 'Zero maintenance forever'], 0),
    ],
  },
  {
    id: 'brrrr',
    day: 15,
    title: 'BRRRR method overview',
    minutes: 10,
    guideId: 'finance-brrrr',
    summary: 'Buy, Rehab, Rent, Refinance, Repeat — with margins.',
    teach: [
      'Buy undervalued or fixable property.',
      'Rehab to force equity and rentability.',
      'Rent to a reliable tenant.',
      'Refinance to pull capital (when numbers and rates allow), then repeat.',
      'Over-leverage and bad rehabs destroy the loop — underwrite stress cases.',
    ],
    workout: 'Write the five BRRRR steps from memory and one risk for each step.',
    quiz: [
      q('1', 'BRRRR stands for:', ['Buy, Rehab, Rent, Refinance, Repeat', 'Borrow, Run, Ruin, Repeat, Retreat', 'Budget, Rest, Retire, Roast, Repeat'], 0),
      q('2', 'Forced equity usually comes from:', ['Wishful thinking', 'Value-add rehab done right', 'Ignoring permits'], 1),
      q('3', 'Refinancing to pull cash only works when:', ['The after-repair value and rents support it', 'You feel lucky', 'TikTok says so'], 0),
    ],
  },
  {
    id: 'house-hack',
    day: 16,
    title: 'House hacking',
    minutes: 10,
    guideId: 'finance-house-hack',
    summary: 'Live in part of a property; rent offsets your cost.',
    teach: [
      'Owner-occupy a duplex/triplex (where allowed): live in one unit, rent others.',
      'Your largest expense — housing — shrinks.',
      'You learn landlording with skin in the game.',
      'Know local laws, lending rules, and your tolerance for housemate energy.',
    ],
    workout: 'Search whether duplex owner-occupy loans exist in your area; note one pro and one con for your life.',
    quiz: [
      q('1', 'House hacking mainly aims to:', ['Increase your rent forever', 'Offset housing costs with rental income', 'Avoid all neighbors'], 1),
      q('2', 'A common house-hack setup is:', ['Living in one unit of a multi-unit and renting others', 'Buying a yacht', 'Cash only meme coins'], 0),
      q('3', 'Before house hacking you must consider:', ['Local rules, lending, and lifestyle fit', 'Only paint colors', 'Astrology'], 0),
    ],
  },
  {
    id: 'amortization',
    day: 17,
    title: 'Mortgage amortization',
    minutes: 10,
    guideId: 'finance-amortization',
    summary: 'Early payments are mostly interest; later mostly principal.',
    teach: [
      'Amortization schedules show interest vs principal each month.',
      'Extra principal payments early save the most interest.',
      'Compare: invest extra vs pay debt — depends on rate, risk, and behavior.',
      'Never ignore high-interest consumer debt while “optimizing” mortgages.',
    ],
    workout: 'Find your loan’s interest rate. If you have consumer debt >10%, plan that payoff first.',
    quiz: [
      q('1', 'Early in a mortgage, payments are often:', ['Mostly principal', 'Mostly interest', 'Tax free gifts'], 1),
      q('2', 'Extra principal early:', ['Usually saves more interest over time', 'Does nothing', 'Raises your rate'], 0),
      q('3', 'High-interest credit cards should usually be:', ['Ignored', 'Attacked before fancy strategies', 'Maxed for points only'], 1),
    ],
  },
  {
    id: 'risk-buckets',
    day: 18,
    title: 'Risk brackets for money',
    minutes: 10,
    guideId: 'finance-risk-typing',
    summary: 'Bills and emergency cash ≠ speculation money.',
    teach: [
      'Bucket 1: next 0–2 years needs — safe and liquid.',
      'Bucket 2: long-term investing — diversified, boring.',
      'Bucket 3: play money — only what you can lose.',
      'Dating flex financed from Bucket 3 or a planned social budget — never from rent money.',
    ],
    workout: 'Label your accounts/buckets on paper: Safe / Invest / Play.',
    quiz: [
      q('1', 'Money for rent next month belongs in:', ['Speculative options', 'Safe liquid bucket', 'Illiquid startups only'], 1),
      q('2', 'Play/speculation money should be:', ['Money you can afford to lose', 'Your emergency fund', 'Your only paycheck'], 0),
      q('3', 'Mixing buckets usually causes:', ['Clarity', 'Panic selling and money fights', 'Automatic wealth'], 1),
    ],
  },
  {
    id: 'bubble-discipline',
    day: 19,
    title: 'Bubble alarm & FOMO control',
    minutes: 10,
    guideId: 'finance-bubble-alarm',
    summary: 'When everyone is euphoric, check leverage and plan.',
    teach: [
      'Euphoria + leverage + “this time is different” is a danger cocktail.',
      'Your circuit breaker: no new debt to buy hype; stick to auto-invest amounts.',
      'Talking about money as status in dating is a red flag — for you or them.',
      'Survive first. Compound second.',
    ],
    workout: 'Write your personal rule: “I will not borrow to invest in ___.”',
    quiz: [
      q('1', 'A healthy response to market euphoria is:', ['Max leverage FOMO', 'Stick to the plan / cut leverage', 'Quit investing forever'], 1),
      q('2', 'Borrowing to chase hype is:', ['Usually dangerous', 'Always smart', 'Required'], 0),
      q('3', 'Status flexing with money in dating often signals:', ['Emotional security', 'Possible insecurity or recklessness', 'Guaranteed marriage'], 1),
    ],
  },
  {
    id: 'runway-cuts',
    day: 20,
    title: 'Protect your runway',
    minutes: 10,
    guideId: 'finance-vc-runway',
    summary: 'When cash is tight, cut vanity before the core.',
    teach: [
      'Runway = months you can operate with current cash and burn.',
      'Cut subscriptions, lifestyle flex, and unused services first.',
      'Keep the core: housing basics, health, skill-building, automated investing if possible.',
      'A solvent partner energy beats a flashy broke energy.',
    ],
    workout: 'Cancel or pause one low-value recurring expense today. Note months of runway gained.',
    quiz: [
      q('1', 'Runway means roughly:', ['How long cash lasts at current burn', 'Your 5K time', 'Credit limit only'], 0),
      q('2', 'Under money stress, cut first:', ['Core health costs', 'Vanity / low-value recurring spend', 'All income'], 1),
      q('3', 'Protecting runway supports dating because:', ['Panic money stress damages relationships', 'It bans all dates forever', 'It replaces communication'], 0),
    ],
  },
];

export function getFinanceLessonByIndex(index: number): FinanceLesson {
  const i = ((index % FINANCE_LESSONS.length) + FINANCE_LESSONS.length) % FINANCE_LESSONS.length;
  return FINANCE_LESSONS[i];
}

export function getFinanceLessonById(id: string): FinanceLesson | null {
  return FINANCE_LESSONS.find((l) => l.id === id) || null;
}
