import type { TokenResult } from '../types';

const normalize = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/['’]/g, "'")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zàèéìòù'\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const VERIFIED_PRONUNCIATIONS: Record<string, string> = {
  buongiorno: 'bwohn-JOR-no',
  buonasera: 'bwoh-nah-SEH-rah',
  salve: 'SAHL-veh',
  ciao: 'CHOW',
  arrivederci: 'ah-ree-veh-DER-chee',
  'a dopo': 'ah DOH-poh',
  'per favore': 'pehr fah-VOH-reh',
  'grazie mille': 'GRAHT-tsyeh MEEL-leh',
  prego: 'PREH-goh',
  'mi scusi': 'mee SKOO-zee',
  'non fa niente': 'nohn fah NYEN-teh',
  "parla inglese": 'PAR-lah een-GLAY-zeh',
  'parlo poco italiano': 'PAR-loh POH-koh ee-tah-LYAH-noh',
  'puo ripetere per favore': 'pwoh ree-PEH-teh-reh pehr fah-VOH-reh',
  "dov'e la stazione": 'doh-VEH lah stah-TSYOH-neh',
  'quanto costa un biglietto': 'KWAHN-toh KOH-stah oon bee-LYET-toh',
  'a che ora parte': 'ah keh OH-rah PAR-teh',
  'a che ora arriva': 'ah keh OH-rah ar-REE-vah',
  'e questo il binario giusto': 'eh KWEH-stoh eel bee-NAH-ryoh JOOS-toh',
  'vorrei un biglietto per roma': 'vor-RAY oon bee-LYET-toh pehr ROH-mah',
  'e incluso il posto': 'eh een-KLOO-zoh eel POH-stoh',
  'dove devo scendere': 'DOH-veh DEH-voh SHEN-deh-reh',
  'questo treno e diretto': 'KWEH-stoh TREH-noh eh dee-RET-toh',
  'un tavolo per due': 'oon TAH-voh-loh pehr DOO-eh',
  'possiamo sederci fuori': 'pohs-SYAH-moh seh-DER-chee FWOH-ree',
  'il menu per favore': 'eel meh-NOO pehr fah-VOH-reh',
  'che cosa consiglia': 'keh KOH-zah kohn-SEE-lyah',
  'vorrei questo': 'vor-RAY KWEH-stoh',
  'senza glutine': 'SEN-tsah GLOO-tee-neh',
  'senza lattosio': 'SEN-tsah laht-TOH-zyoh',
  'sono allergico a': 'SOH-noh ahl-LER-jee-koh ah',
  'un litro di acqua naturale frizzante': 'oon LEE-troh dee AHK-kwah nah-too-RAH-leh freet-TSAHN-teh',
  'possiamo avere il conto': 'pohs-SYAH-moh ah-VEH-reh eel KOHN-toh',
  'separato per favore': 'seh-pah-RAH-toh pehr fah-VOH-reh',
  'ho una prenotazione': 'oh OO-nah preh-noh-tah-TSYOH-neh',
  'a che ora e il check-out': 'ah keh OH-rah eh eel check-out',
  "c'e la colazione inclusa": 'cheh lah koh-lah-TSYOH-neh een-KLOO-zah',
  'posso lasciare i bagagli': 'POHS-soh lah-SHAH-reh ee bah-GAHL-yee',
  'il wi-fi non funziona': 'eel wee-fai nohn foon-TSYOH-nah',
  "c'e un ascensore": 'cheh oon ah-shen-SOH-reh',
  'vorrei un taxi per favore': 'vor-RAY oon TAHK-see pehr fah-VOH-reh',
  aiuto: 'ah-YOO-toh',
  "chiamate un'ambulanza": 'kyah-MAH-teh oon ahm-boo-LAHN-tsah',
  "dov'e la farmacia piu vicina": 'doh-VEH lah far-mah-CHEE-ah pyoo vee-CHEE-nah',
  'ho bisogno di un medico': 'oh bee-ZOHN-yoh dee oon MEH-dee-koh',
  'mi sono perso': 'mee SOH-noh PEHR-soh',
  'ho perso il mio portafoglio': 'oh PEHR-soh eel MEE-oh por-tah-FOH-lyoh',
  'mi fa male qui': 'mee fah MAH-leh kwee',
  'quanto costa': 'KWAHN-toh KOH-stah',
  'e troppo caro': 'eh TROP-poh KAH-roh',
  'avete una taglia piu grande piccola': 'ah-VEH-teh OO-nah TAH-lyah pyoo GRAHN-deh PEEK-koh-lah',
  'posso provarlo': 'POHS-soh proh-VAHR-loh',
  'posso pagare con carta': 'POHS-soh pah-GAH-reh kohn KAR-tah',
  'avete qualcosa di simile': 'ah-VEH-teh kwal-KOH-zah dee SEE-mee-leh',
  "dov'e il bagno": 'doh-VEH eel BAHN-yoh',
  'e lontano': 'eh lohn-TAH-noh',
  'e vicino': 'eh vee-CHEE-noh',
  'a sinistra': 'ah see-NEE-strah',
  'a destra': 'ah DEH-strah',
  'sempre dritto': 'SEM-preh DREET-toh',
  'quanto tempo ci vuole': 'KWAHN-toh TEM-poh chee VWOH-leh',
  'va bene': 'vah BEH-neh',
  perfetto: 'pehr-FET-toh',
  'nessun problema': 'nes-SOON proh-BLEH-mah',
  'di dove sei': 'dee DOH-veh say',
  'come va': 'KOH-meh vah',
  'tutto bene': 'TOOT-toh BEH-neh',
  'un espresso': 'oon es-PRES-soh',
  'un macchiato': 'oon mahk-KYAH-toh',
  'un cappuccino': 'oon kahp-poo-CHEE-noh',
  'da portare via': 'dah por-TAH-reh VEE-ah',
  'e in orario': 'eh een oh-RAH-ryoh',
  "c'e un supplemento": 'cheh oon soop-pleh-MEN-toh',
  'il binario e cambiato': 'eel bee-NAH-ryoh eh kahm-BYAH-toh',
  'siamo in ritardo': 'SYAH-moh een ree-TAR-doh',
  'arriviamo tra dieci minuti': 'ar-ree-VYAH-moh trah DYEH-chee mee-NOO-tee',
  'e piccante': 'eh pee-KAHN-teh',
  'e possibile dividere': 'eh pohs-SEE-bee-leh dee-VEE-deh-reh',
  'e possibile un check-out tardivo': 'eh pohs-SEE-bee-leh oon check-out tar-DEE-voh',
  "c'e aria condizionata": 'cheh AH-ryah kohn-dee-tsyoh-NAH-tah',
  funziona: 'foon-TSYOH-nah',
  'mi puo aiutare': 'mee pwoh ah-yoo-TAH-reh',
  'sto solo guardando': 'stoh SOH-loh gwar-DAHN-doh'
};

const toPronunciationLookupKey = (input: string) =>
  normalize(input)
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const VERIFIED_PRONUNCIATIONS_LOOKUP = Object.fromEntries(
  Object.entries(VERIFIED_PRONUNCIATIONS).map(([key, value]) => [toPronunciationLookupKey(key), value])
);

/**
 * Computes Levenshtein distance.
 */
export function levenshteinDistance(aRaw: string, bRaw: string): number {
  const a = normalize(aRaw);
  const b = normalize(bRaw);
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Computes phrase similarity from Levenshtein distance.
 */
export function getSimilarity(expected: string, actual: string): number {
  const normExpected = normalize(expected);
  const normActual = normalize(actual);
  const maxLen = Math.max(normExpected.length, normActual.length, 1);
  return 1 - levenshteinDistance(normExpected, normActual) / maxLen;
}

const isCloseToken = (expected: string, heard: string): boolean => {
  if (!expected || !heard) return false;
  if (expected === heard) return true;

  const stripElision = (s: string) => s.replace(/\b[ldnmct]'?/g, '').replace(/'/g, '');
  const simplifyVowels = (s: string) => s.replace(/[eéè]/g, 'e').replace(/[oòó]/g, 'o');

  const a = simplifyVowels(stripElision(expected));
  const b = simplifyVowels(stripElision(heard));
  if (a === b) return true;

  const noDoubleA = a.replace(/([bcdfghlmnpqrstvz])\1/g, '$1');
  const noDoubleB = b.replace(/([bcdfghlmnpqrstvz])\1/g, '$1');
  if (noDoubleA === noDoubleB) return true;

  return levenshteinDistance(a, b) <= 1;
};

/**
 * Builds token-level diff between expected and recognized phrase.
 */
export function tokenDiff(expectedRaw: string, actualRaw: string): TokenResult[] {
  const expected = normalize(expectedRaw).split(' ').filter(Boolean);
  const actual = normalize(actualRaw).split(' ').filter(Boolean);
  const maxLen = Math.max(expected.length, actual.length);
  const results: TokenResult[] = [];

  for (let i = 0; i < maxLen; i += 1) {
    const exp = expected[i];
    const got = actual[i];
    if (exp && got && exp === got) {
      results.push({ token: exp, status: 'exact' });
    } else if (exp && got && isCloseToken(exp, got)) {
      results.push({ token: `${exp} (${got})`, status: 'close' });
    } else if (exp && got) {
      results.push({ token: `${exp} (${got})`, status: 'miss' });
    } else if (exp) {
      results.push({ token: exp, status: 'miss' });
    } else if (got) {
      results.push({ token: got, status: 'extra' });
    }
  }

  return results;
}

/**
 * Classifies score into quality bucket with adaptive strictness.
 */
export function classifyAccuracy(similarity: number, historicalAccuracy: number): { label: string; quality: number } {
  const strictness = historicalAccuracy > 0.88 ? 0.02 : historicalAccuracy < 0.65 ? -0.02 : 0;
  const perfectThreshold = 0.9 + strictness;
  const closeThreshold = 0.7 + strictness;

  if (similarity >= perfectThreshold) return { label: 'Perfect', quality: 5 };
  if (similarity >= closeThreshold) return { label: 'Close', quality: 4 };
  if (similarity >= 0.45) return { label: 'Incorrect but good attempt', quality: 3 };
  if (similarity >= 0.25) return { label: 'Incorrect attempt', quality: 2 };
  return { label: 'Didn’t attempt clearly', quality: 1 };
}

/**
 * Creates local pronunciation hint text.
 */
export function getPronunciationHint(expected: string, heard: string): string {
  const normExpected = normalize(expected);
  const normHeard = normalize(heard);

  if (!normHeard) return 'Try speaking a little louder and closer to the microphone.';
  if (normExpected.replace(/([bcdfghlmnpqrstvz])\1/g, '$1') === normHeard.replace(/([bcdfghlmnpqrstvz])\1/g, '$1')) {
    return 'Watch Italian double consonants: hold the sound a bit longer (e.g., anno vs ano).';
  }
  if (normExpected.replace(/[eéè]/g, 'e') === normHeard.replace(/[eéè]/g, 'e') || normExpected.replace(/[oòó]/g, 'o') === normHeard.replace(/[oòó]/g, 'o')) {
    return 'Vowel quality is close—focus on open/closed vowels, especially e/è and o/ò.';
  }
  if (normExpected.includes("'") || normExpected.includes(' l') || normExpected.includes(' un')) {
    return 'Practice elisions: blend words smoothly (e.g., l’acqua, un’amica).';
  }
  return 'Slow down and stress each word ending clearly.';
}

/**
 * Generates rough local IPA-like guidance for Italian text.
 */
export function toIpaHint(input: string): string {
  const normalized = normalize(input);
  if (VERIFIED_PRONUNCIATIONS[normalized]) {
    return VERIFIED_PRONUNCIATIONS[normalized];
  }

  const lookupKey = toPronunciationLookupKey(input);
  if (VERIFIED_PRONUNCIATIONS_LOOKUP[lookupKey]) {
    return VERIFIED_PRONUNCIATIONS_LOOKUP[lookupKey];
  }

  return 'Italian audio sample is the reference pronunciation.';
}
