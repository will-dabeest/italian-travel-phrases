import type {
  ConvoCategory,
  ConvoCategoryRaw,
  ConvoDerivedData,
  ConvoLibraryRaw,
  ConvoUnit,
  PromptCategory,
  PromptUnit,
  ResponseCategory,
  ResponseUnit
} from '../types';

const normalize = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[’']/g, "'")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const italianKey = (it: string): string => normalize(it);

const findGreetingsCategoryId = (categories: ConvoCategoryRaw[]): string => {
  const byName = categories.find((category) => normalize(category.name) === normalize('Greetings & Politeness'));
  if (byName) return byName.id;
  return categories[0]?.id ?? 'greetings_politeness';
};

const buildPromptCategories = (raw: ConvoLibraryRaw): PromptCategory[] =>
  raw.categories.map((category) => ({
    id: category.id,
    name: category.name,
    units: category.phrases.map<PromptUnit>((phrase, index) => ({
      id: `${category.id}-${index}`,
      it: phrase.it,
      en: phrase.en
    }))
  }));

const buildResponseCategories = (raw: ConvoLibraryRaw): ResponseCategory[] => {
  const greetingsId = findGreetingsCategoryId(raw.categories);

  const occurrences = new Map<string, { count: number; firstCategoryId: string; it: string; en: string }>();
  const orderedKeys: string[] = [];

  raw.categories.forEach((category) => {
    category.phrases.forEach((phrase) => {
      const count = Math.min(phrase.responses.length, phrase.responses_en.length);
      for (let index = 0; index < count; index += 1) {
        const it = phrase.responses[index]?.trim();
        const en = phrase.responses_en[index]?.trim();
        if (!it || !en) continue;

        const key = italianKey(it);
        if (!occurrences.has(key)) {
          orderedKeys.push(key);
          occurrences.set(key, { count: 1, firstCategoryId: category.id, it, en });
        } else {
          const existing = occurrences.get(key);
          if (existing) existing.count += 1;
        }
      }
    });
  });

  const bucket = new Map<string, ResponseUnit[]>();
  raw.categories.forEach((category) => bucket.set(category.id, []));

  orderedKeys.forEach((key, index) => {
    const entry = occurrences.get(key);
    if (!entry) return;

    const targetCategoryId = entry.count > 1 || entry.firstCategoryId === greetingsId ? greetingsId : entry.firstCategoryId;
    const list = bucket.get(targetCategoryId);
    if (!list) return;

    list.push({
      id: `response-${index}`,
      it: entry.it,
      en: entry.en
    });
  });

  return raw.categories
    .map<ResponseCategory>((category) => ({
      id: category.id,
      name: category.name,
      units: bucket.get(category.id) ?? []
    }))
    .filter((category) => category.units.length > 0);
};

const buildConvoCategories = (raw: ConvoLibraryRaw): ConvoCategory[] =>
  raw.categories
    .map<ConvoCategory>((category) => {
      const units: ConvoUnit[] = [];

      category.phrases.forEach((phrase, phraseIndex) => {
        const count = Math.min(phrase.responses.length, phrase.responses_en.length);
        for (let responseIndex = 0; responseIndex < count; responseIndex += 1) {
          const responseIt = phrase.responses[responseIndex]?.trim();
          const responseEn = phrase.responses_en[responseIndex]?.trim();
          if (!responseIt || !responseEn) continue;

          units.push({
            id: `${category.id}-${phraseIndex}-${responseIndex}`,
            promptIt: phrase.it,
            promptEn: phrase.en,
            responseIt,
            responseEn
          });
        }
      });

      return {
        id: category.id,
        name: category.name,
        units
      };
    })
    .filter((category) => category.units.length > 0);

export function buildConvoDerivedData(raw: ConvoLibraryRaw): ConvoDerivedData {
  return {
    promptCategories: buildPromptCategories(raw),
    responseCategories: buildResponseCategories(raw),
    convoCategories: buildConvoCategories(raw)
  };
}
