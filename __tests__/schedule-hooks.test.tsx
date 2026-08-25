import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

const mockGetGraph = jest.fn();
const mockShowModalErrCam = jest.fn();
const mockShowModalErrOrder = jest.fn();
const mockAnswerErrCam = jest.fn();
const mockAnswerErrOrder = jest.fn();
const mockFormatPrice = jest.fn((price: number) => `${price} ₽`);

let mockStatState: any;
let mockGlobalState: any;

jest.mock('@/shared/store/store', () => ({
  useStatStore: (selector: any) => selector(mockStatState),
  useGlobalStore: (selector: any) => selector(mockGlobalState),
}));

import { useGraphLogic } from '@/features/schedule/model/useGraphLogic';
import { useChooseMonthLogic } from '@/features/schedule/model/useChooseMonthLogic';
import {
  useErrorCamera as useErrorCameraModal,
  useErrorOrders as useErrorOrdersModal,
} from '@/features/schedule/model/useErrorModal';
import {
  useErrorCamera as useErrorCameraList,
  useErrorOrders as useErrorOrdersList,
} from '@/features/schedule/model/useError';

describe('schedule hooks', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-06-30T10:00:00Z'));
    jest.clearAllMocks();
    mockGetGraph.mockResolvedValue(undefined);
    mockStatState = {
      getGraph: mockGetGraph,
      month_list: [
        { day: '2026-05', mounth: 'Май', is_active: 0 },
        { day: '2026-06', mounth: 'Июнь', is_active: 1 },
      ],
      err_cam: [{ id: 1, imgs: ['cam-1.jpg'] }],
      err_orders: [{ err_id: 2, row_id: 3, imgs: ['order-1.jpg'] }],
      showModalErrCam: mockShowModalErrCam,
      showModalErrOrder: mockShowModalErrOrder,
      isShowModalErrCam: true,
      modalErrCam: { id: 11, imgs: ['a.jpg', 'b.jpg'] },
      isShowModalErrOrder: true,
      modalErrOrder: { err_id: 22, row_id: 33, imgs: ['c.jpg'] },
      FormatPrice: mockFormatPrice,
      answer_err_cam: mockAnswerErrCam,
      answer_err_order: mockAnswerErrOrder,
    };
    mockGlobalState = {
      globalFontSize: 18,
    };
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('useGraphLogic: на mount грузит текущий месяц и refresh держит isRefreshing', async () => {
    let api: ReturnType<typeof useGraphLogic> | null = null;

    function Probe() {
      api = useGraphLogic();
      return null as any;
    }

    await render(<Probe />);

    expect(mockGetGraph).toHaveBeenCalledWith('2026-06');
    expect(api!.isRefreshing).toBe(false);

    await act(async () => {
      await api!.handleRefresh();
    });

    expect(mockGetGraph).toHaveBeenCalledWith('2026-06');
    expect(api!.isRefreshing).toBe(false);
  });

  it('useChooseMonthLogic: выбирает активный месяц и вызывает getGraph при выборе', async () => {
    let api: ReturnType<typeof useChooseMonthLogic> | null = null;

    function Probe() {
      api = useChooseMonthLogic();
      return null as any;
    }

    await render(<Probe />);

    await waitFor(() => expect(api!.activeMounth).toBe('Июнь'));

    await act(async () => {
      api!.setIsOpenDateMenu(true);
    });
    expect(api!.isOpenDateMenu).toBe(true);

    await act(async () => {
      api!.onSelectMonth('2026-05', 'Май');
    });

    expect(mockGetGraph).toHaveBeenCalledWith('2026-05');
    expect(api!.activeMounth).toBe('Май');
    expect(api!.isOpenDateMenu).toBe(false);
    expect(api!.globalFontSize).toBe(18);
  });

  it('useErrorModal camera: готовит images, fullscreen state и submit', async () => {
    let api: ReturnType<typeof useErrorCameraModal> | null = null;

    function Probe() {
      api = useErrorCameraModal();
      return null as any;
    }

    await render(<Probe />);

    await waitFor(() =>
      expect(api!.transformedArray).toEqual([{ uri: 'a.jpg' }, { uri: 'b.jpg' }]),
    );

    await act(async () => {
      api!.openImage(1);
      api!.setTextError('Комментарий');
    });

    expect(api!.visible).toBe(true);
    expect(api!.indexImg).toBe(1);

    await act(async () => {
      api!.onSubmitError();
      api!.closeModal();
    });

    expect(mockAnswerErrCam).toHaveBeenCalledWith('Комментарий', 11);
    expect(mockShowModalErrCam).toHaveBeenCalledWith(false);
  });

  it('useErrorModal orders: готовит images и submit с err_id/row_id', async () => {
    let api: ReturnType<typeof useErrorOrdersModal> | null = null;

    function Probe() {
      api = useErrorOrdersModal();
      return null as any;
    }

    await render(<Probe />);

    await waitFor(() => expect(api!.transformedArray).toEqual([{ uri: 'c.jpg' }]));

    await act(async () => {
      api!.openImage(0);
      api!.setTextError('Апелляция');
    });

    await act(async () => {
      api!.submitError();
      api!.closeModal();
    });

    expect(api!.visible).toBe(true);
    expect(mockAnswerErrOrder).toHaveBeenCalledWith('Апелляция', 22, 33);
    expect(mockShowModalErrOrder).toHaveBeenCalledWith(false);
  });

  it('useError list hooks: возвращают списки ошибок и handlers', async () => {
    let cam: ReturnType<typeof useErrorCameraList> | null = null;
    let orders: ReturnType<typeof useErrorOrdersList> | null = null;

    function Probe() {
      cam = useErrorCameraList();
      orders = useErrorOrdersList();
      return null as any;
    }

    await render(<Probe />);

    expect(cam!.err_cam).toEqual([{ id: 1, imgs: ['cam-1.jpg'] }]);
    expect(cam!.showModalErrCam).toBe(mockShowModalErrCam);
    expect(cam!.globalFontSize).toBe(18);
    expect(orders!.err_orders).toEqual([{ err_id: 2, row_id: 3, imgs: ['order-1.jpg'] }]);
    expect(orders!.showModalErrOrder).toBe(mockShowModalErrOrder);
    expect(orders!.globalFontSize).toBe(18);
  });
});
