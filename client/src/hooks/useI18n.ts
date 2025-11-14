/**
 * useI18n Hook
 * 
 * Provides internationalization support for the application
 */

import { useState, useCallback, useEffect } from 'react';
import { Language, Currency } from '@/server/services/i18nService';

interface I18nState {
  language: Language;
  currency: Currency;
  timezone: string;
}

const DEFAULT_STATE: I18nState = {
  language: 'en',
  currency: 'USD',
  timezone: 'UTC',
};

const STORAGE_KEY = 'ssp_i18n';

export function useI18n() {
  const [state, setState] = useState<I18nState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to load i18n state:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const setLanguage = useCallback((language: Language) => {
    setState(prev => ({ ...prev, language }));
  }, []);

  const setCurrency = useCallback((currency: Currency) => {
    setState(prev => ({ ...prev, currency }));
  }, []);

  const setTimezone = useCallback((timezone: string) => {
    setState(prev => ({ ...prev, timezone }));
  }, []);

  return {
    language: state.language,
    currency: state.currency,
    timezone: state.timezone,
    setLanguage,
    setCurrency,
    setTimezone,
    isLoaded,
  };
}
