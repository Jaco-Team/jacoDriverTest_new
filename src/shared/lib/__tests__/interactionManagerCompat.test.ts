describe('interactionManagerCompat', () => {
  it('подменяет удалённый InteractionManager на create/clear handle', () => {
    jest.isolateModules(() => {
      const {interactionManagerCompat} = require('../interactionManagerCompat') as {
        interactionManagerCompat: {
          createInteractionHandle: () => number
          clearInteractionHandle: (handle: number) => void
        }
      }
      const {InteractionManager} = require('react-native') as {
        InteractionManager: typeof interactionManagerCompat
      }

      const handle = InteractionManager.createInteractionHandle()
      expect(handle).toBe(1)
      expect(() => InteractionManager.clearInteractionHandle(handle)).not.toThrow()
    })
  })
})
