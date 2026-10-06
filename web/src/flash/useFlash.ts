import { useContext } from 'react'
import { FlashContext, type Flash } from './flashContext'

export function useFlash(): Flash {
  const flash = useContext(FlashContext)
  if (flash === null) throw new Error('useFlash needs a FlashProvider above it')
  return flash
}
