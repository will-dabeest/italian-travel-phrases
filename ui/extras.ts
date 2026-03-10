/**
 * Converts a number (1-1000) into approximate Italian text.
 */
export function numberToItalian(value: number): string {
  const units = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
  const teens = ['dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
  const tens = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

  if (value <= 9) return units[value];
  if (value <= 19) return teens[value - 10];
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    const base = tens[ten];
    if (unit === 1 || unit === 8) return `${base.slice(0, -1)}${units[unit]}`;
    return `${base}${unit ? units[unit] : ''}`;
  }
  if (value < 1000) {
    const hundred = Math.floor(value / 100);
    const remainder = value % 100;
    const hundredWord = hundred === 1 ? 'cento' : `${units[hundred]}cento`;
    return remainder ? `${hundredWord}${numberToItalian(remainder)}` : hundredWord;
  }
  return 'mille';
}

/**
 * Returns static irregular verb reference rows.
 */
export function irregularVerbs() {
  return [
    { infinitive: 'avere', io: 'ho', tu: 'hai', luiLei: 'ha', noi: 'abbiamo', voi: 'avete', loro: 'hanno' },
    { infinitive: 'essere', io: 'sono', tu: 'sei', luiLei: 'è', noi: 'siamo', voi: 'siete', loro: 'sono' },
    { infinitive: 'andare', io: 'vado', tu: 'vai', luiLei: 'va', noi: 'andiamo', voi: 'andate', loro: 'vanno' },
    { infinitive: 'venire', io: 'vengo', tu: 'vieni', luiLei: 'viene', noi: 'veniamo', voi: 'venite', loro: 'vengono' }
  ];
}
