import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {Pressable, Text, TouchableOpacity} from 'react-native';

describe.each([
  ['Pressable', Pressable],
  ['TouchableOpacity', TouchableOpacity],
] as const)('тестовая кнопка %s', (_name, Button) => {
  it('доступна по роли и не вызывает действие, пока disabled=true', async () => {
    const onPress = jest.fn();
    const view = await render(
      <Button accessibilityRole="button" disabled onPress={onPress}>
        <Text>Действие</Text>
      </Button>,
    );

    expect(screen.getByRole('button', {name: 'Действие'})).toBeDisabled();
    await fireEvent.press(screen.getByText('Действие'));
    expect(onPress).not.toHaveBeenCalled();

    await view.rerender(
      <Button accessibilityRole="button" disabled={false} onPress={onPress}>
        <Text>Действие</Text>
      </Button>,
    );
    expect(screen.getByRole('button', {name: 'Действие'})).toBeEnabled();
    await fireEvent.press(screen.getByText('Действие'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('сохраняет явно заданный accessible=false', async () => {
    await render(
      <Button accessible={false} accessibilityRole="button">
        <Text>Не отдельная кнопка</Text>
      </Button>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

it('вычисляет Pressable style callback для ненажатого состояния', async () => {
  const style = jest.fn(({pressed}: {pressed: boolean}) => [
    {width: 44, height: 44},
    {opacity: pressed ? 0.5 : 1},
  ]);
  await render(<Pressable testID="styled-pressable" style={style} />);

  expect(style).toHaveBeenCalledWith({pressed: false});
  expect(screen.getByTestId('styled-pressable')).toHaveStyle({
    width: 44,
    height: 44,
    opacity: 1,
  });
});
