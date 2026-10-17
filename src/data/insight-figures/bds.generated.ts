/**
 * GENERATED from the Census Bureau Business Dynamics Statistics 2023 release, fetched 2026-10-16 (U.S. Census Bureau, files named in
 * sources.ts). Values are copied as printed; rates keep the three decimals the files publish. Do not edit by hand: re-fetch and regenerate.
 */

/** Firm-age classes as the BDS files name them (age 0 is a startup; "left censored" firms were born before 1977, age unknown). */
export const BDS_AGE_CLASSES = ['0', '1', '2', '3', '4', '5', '6-10', '11-15', '16-20', '21-25', '26+', 'left-censored'] as const;
export type BdsAgeClass = (typeof BDS_AGE_CLASSES)[number];

/** Ages 1 to 26+, the classes that have an exit rate (startups have none). */
export const BDS_EXIT_AGES = ['1', '2', '3', '4', '5', '6-10', '11-15', '16-20', '21-25', '26+'] as const;
export type BdsExitAge = (typeof BDS_EXIT_AGES)[number];

/** 2023, all sectors: firms and employment by firm age (firms, emp columns). */
export const BDS_2023_BY_AGE: Readonly<Record<BdsAgeClass, { readonly firms: number; readonly emp: number }>> = {
  '0': { firms: 508777, emp: 2440753 },
  '1': { firms: 400710, emp: 2521272 },
  '2': { firms: 318143, emp: 2320821 },
  '3': { firms: 290799, emp: 2552203 },
  '4': { firms: 267374, emp: 2455957 },
  '5': { firms: 239052, emp: 2442398 },
  '6-10': { firms: 914911, emp: 10752243 },
  '11-15': { firms: 607426, emp: 9312301 },
  '16-20': { firms: 520898, emp: 8815380 },
  '21-25': { firms: 365895, emp: 8233629 },
  '26+': { firms: 859462, emp: 33282618 },
  'left-censored': { firms: 300280, emp: 52332869 },
};

/** 2023, all sectors: establishment exit rate by firm age (estabs_exit_rate), percent. */
export const BDS_2023_EXIT_RATE: Readonly<Record<BdsExitAge, number>> = {
  '1': 25.678,
  '2': 18.092,
  '3': 14.038,
  '4': 12.539,
  '5': 11.549,
  '6-10': 9.9,
  '11-15': 8.488,
  '16-20': 7.85,
  '21-25': 7.522,
  '26+': 7.065,
};

/** 2023 economy-wide totals (bds2023.csv), used to check that the firm-age rows add up. */
export const BDS_2023_TOTAL = { firms: 5593727, emp: 137462444 } as const;

/** Startups (firm age 0) by year, 1978 to 2023: the firms column. */
export const BDS_STARTUP_YEARS: readonly number[] = [1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
export const BDS_STARTUP_FIRMS: readonly number[] = [488103, 473471, 439667, 430100, 418627, 456610, 529584, 512439, 517516, 513574, 507091, 502558, 493080, 450750, 438701, 461135, 475989, 495030, 493289, 494483, 477206, 451218, 446204, 436993, 455162, 467532, 505056, 518727, 541317, 509517, 471285, 395235, 379145, 395680, 408546, 405350, 411948, 421155, 442414, 439859, 442078, 453027, 455725, 485256, 521312, 508777];

/** 2023, all sectors: firms and employment by firm size (employees), as the firm-size file prints them. */
export const BDS_2023_BY_SIZE: readonly { readonly size: string; readonly firms: number; readonly emp: number }[] = [
  { size: '1 to 4', firms: 3348018, emp: 7210965 },
  { size: '5 to 9', firms: 970392, emp: 6879260 },
  { size: '10 to 19', firms: 624548, emp: 8857485 },
  { size: '20 to 99', firms: 544370, emp: 22089278 },
  { size: '100 to 499', firms: 93344, emp: 18503978 },
  { size: '500 to 999', firms: 11485, emp: 7302627 },
  { size: '1000 to 2499', firms: 7061, emp: 9883450 },
  { size: '2500 to 4999', firms: 2670, emp: 7673421 },
  { size: '5000 to 9999', firms: 1498, emp: 7955557 },
  { size: '10000+', firms: 1210, emp: 41106423 },
];

/** 2023: establishment exit rate by firm age (estabs_exit_rate), percent, for the NAICS sectors the sector articles use. */
export const BDS_2023_SECTOR_EXIT_RATE: Readonly<Record<string, Readonly<Record<BdsExitAge, number>>>> = {
  '22': { '1': 25.384, '2': 15.464, '3': 13.646, '4': 10.178, '5': 8.786, '6-10': 8.665, '11-15': 4.672, '16-20': 4.402, '21-25': 9.099, '26+': 3.001 },
  '51': { '1': 29.845, '2': 21.374, '3': 18.713, '4': 17.186, '5': 15.456, '6-10': 13.308, '11-15': 11.863, '16-20': 10.081, '21-25': 10.378, '26+': 9.805 },
  '52': { '1': 25.011, '2': 17.285, '3': 13.042, '4': 11.753, '5': 10.346, '6-10': 9.507, '11-15': 9.992, '16-20': 8.922, '21-25': 9.712, '26+': 8.738 },
  '54': { '1': 25.993, '2': 19.198, '3': 15.27, '4': 13.512, '5': 12.029, '6-10': 10.684, '11-15': 9.734, '16-20': 8.723, '21-25': 7.952, '26+': 8.284 },
  '56': { '1': 30.687, '2': 20.153, '3': 14.816, '4': 13.496, '5': 11.874, '6-10': 10.738, '11-15': 10.411, '16-20': 8.643, '21-25': 11.257, '26+': 9.321 },
  '61': { '1': 22.02, '2': 15.28, '3': 11.588, '4': 11.056, '5': 10.015, '6-10': 8.308, '11-15': 8.104, '16-20': 6.131, '21-25': 5.43, '26+': 5.088 },
  '62': { '1': 17.39, '2': 12.861, '3': 10.941, '4': 9.065, '5': 8.811, '6-10': 7.71, '11-15': 6.665, '16-20': 6.274, '21-25': 6.146, '26+': 7.969 },
};
