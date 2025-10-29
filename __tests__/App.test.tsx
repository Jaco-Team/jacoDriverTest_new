// __tests__/App.test.tsx
import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import App from '../App';

describe('App root', () => {
  afterEach(() => {
    cleanup();
    try { jest.runOnlyPendingTimers(); } catch {}
    jest.clearAllTimers();
  });

  it('монтируется и демонтируется без сбоев', () => {
    const { unmount } = render(<App />); // render сам оборачивает в act()
    expect(typeof unmount).toBe('function'); // рендер прошёл — не упало
    unmount(); // корректно размонтируется — без ошибок
  });
});
