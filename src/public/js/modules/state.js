export const state = {
  API: '/api',
  profiles: [],
  selectedIds: new Set(),
  currentScriptProfileId: null,
  currentFingerprintDraft: null,
  ws: null,
  launchingProfileIds: new Set(),
  wsResolvers: new Map(),
  hiddenGroups: new Set(JSON.parse(localStorage.getItem('hiddenGroups') || '[]')),
  layoutMode: localStorage.getItem('layoutMode') || 'column',
  clientId: 'client_' + Math.random().toString(36).substring(2, 15)
};

export const BASE_LANGUAGES = [
  { lang: 'en', regions: ['US', 'GB', 'CA', 'AU', 'NZ', 'IN', 'ZA', 'IE'] },
  { lang: 'vi', regions: ['VN'] },
  { lang: 'zh', regions: ['CN', 'TW', 'HK'] },
  { lang: 'es', regions: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE'] },
  { lang: 'fr', regions: ['FR', 'CA', 'BE', 'CH'] },
  { lang: 'de', regions: ['DE', 'AT', 'CH'] },
  { lang: 'pt', regions: ['PT', 'BR'] },
  { lang: 'ja', regions: ['JP'] },
  { lang: 'ko', regions: ['KR'] },
  { lang: 'ru', regions: ['RU', 'BY', 'KZ', 'UA'] },
  { lang: 'ar', regions: ['SA', 'EG', 'AE', 'QA', 'DZ', 'MA'] },
  { lang: 'tr', regions: ['TR'] },
  { lang: 'it', regions: ['IT', 'CH'] },
  { lang: 'th', regions: ['TH'] },
  { lang: 'id', regions: ['ID'] },
  { lang: 'ms', regions: ['MY'] },
  { lang: 'fil', regions: ['PH'] },
  { lang: 'nl', regions: ['NL', 'BE'] },
  { lang: 'pl', regions: ['PL'] },
  { lang: 'uk', regions: ['UA'] },
  { lang: 'ro', regions: ['RO'] },
  { lang: 'hu', regions: ['HU'] },
  { lang: 'el', regions: ['GR'] },
  { lang: 'cs', regions: ['CZ'] },
  { lang: 'sv', regions: ['SE'] },
  { lang: 'he', regions: ['IL'] },
  { lang: 'da', regions: ['DK'] },
  { lang: 'fi', regions: ['FI'] },
  { lang: 'nb', regions: ['NO'] },
  { lang: 'sk', regions: ['SK'] },
  { lang: 'hr', regions: ['HR'] },
  { lang: 'bg', regions: ['BG'] },
  { lang: 'lt', regions: ['LT'] },
  { lang: 'et', regions: ['EE'] },
  { lang: 'lv', regions: ['LV'] },
  { lang: 'sl', regions: ['SI'] },
  { lang: 'ca', regions: ['ES'] },
  { lang: 'sr', regions: ['RS'] },
  { lang: 'hi', regions: ['IN'] },
  { lang: 'bn', regions: ['BD', 'IN'] },
  { lang: 'fa', regions: ['IR'] },
  { lang: 'ur', regions: ['PK'] },
  { lang: 'sw', regions: ['KE', 'TZ'] },
  { lang: 'af', regions: ['ZA'] },
  { lang: 'am', regions: ['ET'] },
  { lang: 'zu', regions: ['ZA'] },
  { lang: 'ha', regions: ['NG'] },
];

export const langOptions = [];
for (const item of BASE_LANGUAGES) {
  const { lang, regions } = item;
  for (const region of regions) {
    const locale = `${lang}-${region}`;
    if (lang !== 'en') {
      langOptions.push(`${locale}, ${lang}, en-US, en`);
      langOptions.push(`${locale}, ${lang}`);
    } else {
      langOptions.push(`${locale}, ${lang}`);
    }
  }
}
