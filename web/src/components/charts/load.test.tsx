import { act, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { flipViewport, renderWithViewport } from '../../test-viewport'
import { createLoader, usePreloadCharts } from './load'

const imported = vi.hoisted(() => ({ count: 0 }))

vi.mock('./ChartsImpl.tsx', () => {
  imported.count += 1
  return {}
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function Host() {
  usePreloadCharts()
  return null
}

test('two concurrent loads call the importer once', async () => {
  const importer = vi.fn(() => Promise.resolve('chunk'))
  const { load } = createLoader(importer)
  await expect(Promise.all([load(), load()])).resolves.toEqual(['chunk', 'chunk'])
  expect(importer).toHaveBeenCalledTimes(1)
})

test('after a rejection the next load imports again and resolves', async () => {
  const importer = vi.fn<() => Promise<string>>()
  importer.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('chunk')
  const { load } = createLoader(importer)
  await expect(load()).rejects.toThrow('offline')
  await expect(load()).resolves.toBe('chunk')
  expect(importer).toHaveBeenCalledTimes(2)
})

test('preload swallows a failed import', async () => {
  const { preload } = createLoader(() => Promise.reject(new Error('offline')))
  expect(() => preload()).not.toThrow()
  await act(async () => {})
})

test('at computer width the chunk is not imported, and on a phone it is imported once', async () => {
  renderWithViewport('computer', () => render(<Host />))
  await act(async () => {})
  expect(imported.count).toBe(0)

  flipViewport('phone')
  await vi.dynamicImportSettled()
  expect(imported.count).toBe(1)

  flipViewport('computer')
  flipViewport('phone')
  await vi.dynamicImportSettled()
  expect(imported.count).toBe(1)
})
