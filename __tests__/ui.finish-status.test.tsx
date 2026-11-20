import React from 'react';
import {render} from '@testing-library/react-native';
import {FinishStatus} from '@/entities/CardOrder/ui/FinishStatus';

describe('completion status block', () => {
  it('changes from saved to accepted without offering another submission', async () => {
    const screen = await render(<FinishStatus globalFontSize={26} />);
    expect(screen.getByTestId('order-finish-pending')).toHaveTextContent('Завершение сохранено. Ожидает отправки.');
    expect(screen.queryByRole('button')).toBeNull();

    await screen.rerender(<FinishStatus globalFontSize={26} acknowledged />);
    expect(screen.getByTestId('order-finish-pending')).toHaveTextContent('Завершение отправлено. Обновляем статус.');
    expect(screen.queryByRole('button')).toBeNull();
    await screen.unmount();
  });
});
