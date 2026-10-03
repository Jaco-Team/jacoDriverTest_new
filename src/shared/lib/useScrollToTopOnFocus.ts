import {useCallback, useRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';

type Scrollable = {
  scrollTo?: (options: {y: number; animated: boolean}) => void;
  scrollToOffset?: (options: {offset: number; animated: boolean}) => void;
};

/** Drawer screens stay mounted, so start at the top whenever one is reopened. */
export function useScrollToTopOnFocus<T extends Scrollable>() {
  const scrollRef = useRef<T>(null);

  useFocusEffect(
    useCallback(() => {
      const scrollable = scrollRef.current;
      if (scrollable?.scrollToOffset) {
        scrollable.scrollToOffset({offset: 0, animated: false});
      } else {
        scrollable?.scrollTo?.({y: 0, animated: false});
      }
    }, []),
  );

  return scrollRef;
}
