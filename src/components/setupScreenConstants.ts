export const PRESET_AGE_GROUPS = [
  'U8',
  'U10',
  'U12',
  'U14',
  'U15',
  'U17',
  'U19',
  'High School',
  'Adult',
  'Masters',
];

export const currentYear = new Date().getFullYear();

export const PRESET_SEASONS = [
  `Spring ${currentYear}`,
  `Summer ${currentYear}`,
  `Fall ${currentYear}`,
  `${currentYear} / ${currentYear + 1}`,
  `${currentYear}`,
];

export const PRESET_TOURNAMENTS = [
  'League / Regular Season',
  'Club Play',
  'Triple Crown Classic',
  'NBC World Series',
  'LLWS (Little League)',
  'USSSA Tournament',
  'WBSC',
];
