/** Shape of aggregates.ts, which tools/aggregate.py writes from the SBIR.gov award data and the NIH success-rate table. */

export interface YearTotal {
  readonly year: number;
  readonly awards: number;
  readonly usdMillions: number;
}

export interface AgencyPooled {
  readonly agency: string;
  readonly awards: number;
  readonly usdMillions: number;
  readonly phase1Awards: number;
  readonly phase2Awards: number;
  readonly sttrAwards: number;
  readonly phase1MedianUsd: number | null;
  readonly phase2MedianUsd: number | null;
}

export interface AgencyYear {
  readonly year: number;
  readonly usdMillions: Readonly<Record<string, number>>;
}

export interface FirstTimeYear {
  readonly year: number;
  readonly phase1Awards: number;
  readonly toFirstTime: number;
  readonly percent: number;
}

export interface StateRow {
  readonly state: string;
  readonly awards: number;
  readonly usdMillions: number;
}

export interface GapBucket {
  readonly label: string;
  readonly companies: number;
}

export interface RepeatRow {
  readonly label: string;
  readonly companies: number;
  readonly dollarSharePercent: number;
}

export interface MonthRow {
  readonly month: string;
  readonly awards: number;
}

export interface NihYear {
  readonly fy: number;
  readonly phase1Reviewed: number;
  readonly phase1Awarded: number;
  readonly phase1Percent: number;
  readonly phase2Reviewed: number | null;
  readonly phase2Awarded: number | null;
  readonly phase2Percent: number | null;
}

export interface Aggregates {
  readonly retrieved: string;
  readonly records: number;
  readonly byYear: readonly YearTotal[];
  readonly agencies: { readonly from: number; readonly to: number; readonly rows: readonly AgencyPooled[] };
  readonly agencyTrend: readonly AgencyYear[];
  readonly firstTime: readonly FirstTimeYear[];
  readonly states: { readonly from: number; readonly to: number; readonly total: number; readonly distinct: number; readonly listed: number; readonly rows: readonly StateRow[] };
  readonly phaseGap: {
    readonly cohortFrom: number;
    readonly cohortTo: number;
    readonly companiesWithPhaseI: number;
    readonly companiesWithLaterPhaseII: number;
    readonly medianMonths: number;
    readonly buckets: readonly GapBucket[];
  };
  readonly repeat: { readonly companies: number; readonly rows: readonly RepeatRow[] };
  readonly monthly: readonly MonthRow[];
  readonly nih: readonly NihYear[];
  readonly cumulative: { readonly awards: number; readonly usdBillions: number; readonly fromYear: number; readonly toYear: number };
}
