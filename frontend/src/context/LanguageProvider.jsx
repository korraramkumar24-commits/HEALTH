import { useEffect, useMemo, useState } from 'react';
import LanguageContext from './LanguageContext';
import messages from '../i18n/messages';

const readPreference = (key, fallback, allowed) => {
  try {
    const stored = localStorage.getItem(key);
    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => readPreference('carehub.language', 'en', ['en', 'te']));
  const [lowData, setLowData] = useState(() => readPreference('carehub.low-data', 'off', ['on', 'off']) === 'on');

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.lowData = lowData ? 'true' : 'false';
    try {
      localStorage.setItem('carehub.language', language);
      localStorage.setItem('carehub.low-data', lowData ? 'on' : 'off');
    } catch {
      document.dispatchEvent(new CustomEvent('carehub:preferences-unavailable'));
    }
  }, [language, lowData]);

  const value = useMemo(() => ({
    language,
    lowData,
    setLanguage,
    toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'te' : 'en')),
    toggleLowData: () => setLowData((current) => !current),
    t: (key) => messages[language][key] ?? messages.en[key] ?? key,
  }), [language, lowData]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export default LanguageProvider;
