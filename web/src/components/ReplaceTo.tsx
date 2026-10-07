/**
 * `<Navigate replace>` for a screen that selects a page on its own (a computer's list
 * opening on its first variety): the toast on screen, if any, survives that one replacement
 * instead of being dismissed by the location change.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useFlash } from '../flash/useFlash'

export default function ReplaceTo({ to }: { to: string }) {
  const navigate = useNavigate()
  const flash = useFlash()
  useEffect(() => {
    flash.keepAcrossReplace()
    void navigate(to, { replace: true })
  }, [flash, navigate, to])
  return null
}
