import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import LanguageProvider from './LanguageProvider';
import useLanguage from '../hooks/useLanguage';

const TestPreferences = () => {
  const { language, lowData, toggleLanguage, toggleLowData, t } = useLanguage();
  return (
    <div>
      <p>{t('emergency.title')}</p>
      <button type="button" onClick={toggleLanguage}>{language}</button>
      <button type="button" aria-pressed={lowData} onClick={toggleLowData}>Low data</button>
    </div>
  );
};

describe('language and low-data preferences', () => {
  beforeEach(() => localStorage.clear());

  it('switches between English and Telugu and applies reduced-motion mode', () => {
    render(<LanguageProvider><TestPreferences /></LanguageProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(screen.getByText('అత్యవసర పరిచయాలు')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('te');

    fireEvent.click(screen.getByRole('button', { name: 'Low data' }));
    expect(screen.getByRole('button', { name: 'Low data' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.lowData).toBe('true');
    expect(localStorage.getItem('carehub.language')).toBe('te');
    expect(localStorage.getItem('carehub.low-data')).toBe('on');
  });
});
