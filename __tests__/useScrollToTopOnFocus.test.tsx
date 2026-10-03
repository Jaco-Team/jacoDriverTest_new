import React, {useEffect} from 'react';
import {act, render} from '@testing-library/react-native';
import {useScrollToTopOnFocus} from '@/shared/lib/useScrollToTopOnFocus';

let mockOnFocus: (() => void) | null = null;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    mockOnFocus = effect;
  },
}));

describe('useScrollToTopOnFocus', () => {
  beforeEach(() => {
    mockOnFocus = null;
  });

  it('возвращает ScrollView к началу при входе на экран', async () => {
    const scrollTo = jest.fn();
    function Harness() {
      const scrollRef = useScrollToTopOnFocus<{scrollTo: typeof scrollTo}>();
      useEffect(() => {
        scrollRef.current = {scrollTo};
      }, [scrollRef]);
      return null;
    }

    await render(<Harness />);
    await act(async () => mockOnFocus?.());

    expect(scrollTo).toHaveBeenCalledWith({y: 0, animated: false});
  });

  it('возвращает FlatList к началу при входе на экран', async () => {
    const scrollToOffset = jest.fn();
    function Harness() {
      const scrollRef = useScrollToTopOnFocus<{scrollToOffset: typeof scrollToOffset}>();
      useEffect(() => {
        scrollRef.current = {scrollToOffset};
      }, [scrollRef]);
      return null;
    }

    await render(<Harness />);
    await act(async () => mockOnFocus?.());

    expect(scrollToOffset).toHaveBeenCalledWith({offset: 0, animated: false});
  });
});
