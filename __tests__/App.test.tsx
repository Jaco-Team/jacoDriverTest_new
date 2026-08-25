// __tests__/App.test.tsx
import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import App from '../App';

describe('App root', () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllTimers();
  });

  it('монтируется и демонтируется без сбоев', async () => {
    const { unmount } = await render(<App />); // render сам оборачивает в act()
    expect(typeof unmount).toBe('function'); // рендер прошёл — не упало
    await unmount(); // корректно размонтируется — без ошибок
  });
});
