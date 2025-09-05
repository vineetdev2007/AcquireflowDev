export type LoanProduct = {
  name: string;
  downPaymentPct: number; // 0-1
  rate: number; // annual percent as 0-1
  termMonths?: number; // undefined for interest-only
  interestOnly?: boolean;
};

export type FinanceAssumptions = {
  taxRateAnnual: number; // 0-1
  insuranceRateAnnual: number; // 0-1
  managementRate: number; // 0-1
  maintenanceRate: number; // 0-1
  defaultVacancyRate: number; // 0-1
  defaultLtv: number; // 0-1
  defaultInterestRate: number; // 0-1
};

// Temporary in-memory defaults (can be moved to DB later)
const defaultProducts: LoanProduct[] = [
  { name: 'Conventional 30-year', downPaymentPct: 0.20, rate: 0.065, termMonths: 360 },
  { name: 'Conventional 15-year', downPaymentPct: 0.20, rate: 0.060, termMonths: 180 },
  { name: 'FHA Loan', downPaymentPct: 0.035, rate: 0.068, termMonths: 360 },
  { name: 'Hard Money Loan', downPaymentPct: 0.25, rate: 0.10, termMonths: 12, interestOnly: true },
];

const defaultAssumptions: FinanceAssumptions = {
  taxRateAnnual: 0.01,
  insuranceRateAnnual: 0.004,
  managementRate: 0.08,
  maintenanceRate: 0.05,
  defaultVacancyRate: 0.05,
  defaultLtv: 0.80,
  defaultInterestRate: 0.065,
};

export const financeService = {
  async getProducts(): Promise<LoanProduct[]> {
    return defaultProducts;
  },

  async getAssumptions(_userId?: string): Promise<FinanceAssumptions> {
    // In the future, merge user overrides; for now return defaults
    return defaultAssumptions;
  },
};

export default financeService;


