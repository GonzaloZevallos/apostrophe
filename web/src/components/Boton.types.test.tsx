/**
 * `Boton`'s types are the rule (`icon-and-text-rule.md`): what the closed lists forbid
 * does not compile. A plain `tsc` run is the test; each `Rejected<…>` below must be `true`
 * (the props do not fit `BotonProps`/`BotonLinkProps`) and each `Accepted<…>` `false`
 * for `Rejected`, so a union that grew loose, or one that grew too tight, fails `tsc`
 * (`npm run typecheck`) with no suppression comment. The runtime test only keeps the
 * file a test file.
 */

import type { ReactNode } from 'react'
import { expect, test } from 'vitest'
import type { BotonProps } from './Boton'
import type { BotonLinkProps } from './BotonLink'

type Rejected<P> = [P] extends [BotonProps] ? false : true
type RejectedLink<P> = [P] extends [BotonLinkProps] ? false : true
type Children = { children: ReactNode }

const linkWithIcon: Rejected<{ variant: 'link'; icon: 'tacho' } & Children> = true
const undoWithIcon: Rejected<{ variant: 'undo'; icon: 'tacho' } & Children> = true
const backWithIcon: Rejected<{ variant: 'back'; icon: 'atras' } & Children> = true
const submitWithoutType: Rejected<{ textOnly: 'submit' } & Children> = true
const submitWithButtonType: Rejected<{ textOnly: 'submit'; type: 'button' } & Children> = true
const iconOnlyWithoutLabel: Rejected<{ variant: 'icon'; action: 'delete' }> = true
const iconOnlyOutsideTheMap: Rejected<{ variant: 'icon'; action: 'agregar'; ariaLabel: 'x' }> = true
const iconOnlyWithAnIconProp: Rejected<{
  variant: 'icon'
  action: 'delete'
  icon: 'tacho'
  ariaLabel: 'x'
}> = true
const closeWithoutLabel: Rejected<{ variant: 'icon'; action: 'close' }> = true
const editWithoutLabel: Rejected<{ variant: 'icon'; action: 'edit' }> = true
const shareWithoutLabel: Rejected<{ variant: 'icon'; action: 'share' }> = true
const iconOnlyWithAnUnlistedAction: Rejected<{ variant: 'icon'; action: 'copy'; ariaLabel: 'Copy' }> = true
const primaryBare: Rejected<Children> = true
const secondaryBare: Rejected<{ variant: 'secondary' } & Children> = true
const destructiveBare: Rejected<{ variant: 'destructive' } & Children> = true
const criticalWithoutIcon: Rejected<{ variant: 'critical' } & Children> = true
const criticalTextOnly: Rejected<{ variant: 'critical'; textOnly: 'submit'; type: 'submit' } & Children> = true
const criticalWithAction: Rejected<{ variant: 'critical'; icon: 'tacho'; action: 'delete' } & Children> = true
const linkLinkWithIcon: RejectedLink<{ to: string; variant: 'link'; icon: 'tacho' } & Children> = true
const linkSubmit: RejectedLink<{ to: string; textOnly: 'submit'; type: 'submit' } & Children> = true
const linkIconOnlyWithoutLabel: RejectedLink<{ to: string; variant: 'icon'; action: 'search' }> = true
const noticeWithIcon: Rejected<{ variant: 'notice'; icon: 'atras' } & Children> = true
const noticeWithAriaLabel: Rejected<{ variant: 'notice'; ariaLabel: 'x' } & Children> = true
const noticeTextOnlySubmit: Rejected<{ variant: 'notice'; textOnly: 'submit'; type: 'submit' } & Children> =
  true
const noticeWithoutChildren: Rejected<{ variant: 'notice' }> = true
const linkNoticeWithIcon: RejectedLink<{ to: string; variant: 'notice'; icon: 'atras' } & Children> = true
const linkNoticeWithAriaLabel: RejectedLink<{ to: string; variant: 'notice'; ariaLabel: 'x' } & Children> =
  true
const linkNoticeWithTextOnly: RejectedLink<{ to: string; variant: 'notice'; textOnly: 'submit' } & Children> =
  true
const linkNoticeWithoutChildren: RejectedLink<{ to: string; variant: 'notice' }> = true

const iconAndText: Rejected<{ icon: 'agregar' } & Children> = false
const critical: Rejected<{ variant: 'critical'; icon: 'tacho' } & Children> = false
const secondary: Rejected<{ variant: 'secondary'; icon: 'personaMas' } & Children> = false
const submit: Rejected<{ textOnly: 'submit'; type: 'submit' } & Children> = false
const iconOnly: Rejected<{ variant: 'icon'; action: 'delete'; ariaLabel: 'Borrar' }> = false
const back: Rejected<{ variant: 'back' } & Children> = false
const row: Rejected<{ variant: 'row' } & Children> = false
const notice: Rejected<{ variant: 'notice' } & Children> = false
const linkNotice: RejectedLink<{ to: string; variant: 'notice' } & Children> = false
const closeIcon: Rejected<{ variant: 'icon'; action: 'close'; ariaLabel: 'Close' }> = false
const editIcon: Rejected<{ variant: 'icon'; action: 'edit'; ariaLabel: 'Edit' }> = false
const shareIcon: Rejected<{ variant: 'icon'; action: 'share'; ariaLabel: 'Share' }> = false
const linkIconText: RejectedLink<{ to: string; icon: 'agregar' } & Children> = false
const linkIconOnly: RejectedLink<{
  to: string
  variant: 'icon'
  action: 'search'
  ariaLabel: 'Buscar'
}> = false

test('the closed lists are enforced by tsc, not at run time', () => {
  const checks = [
    linkWithIcon,
    undoWithIcon,
    backWithIcon,
    submitWithoutType,
    submitWithButtonType,
    iconOnlyWithoutLabel,
    iconOnlyOutsideTheMap,
    iconOnlyWithAnIconProp,
    closeWithoutLabel,
    editWithoutLabel,
    shareWithoutLabel,
    iconOnlyWithAnUnlistedAction,
    primaryBare,
    secondaryBare,
    destructiveBare,
    criticalWithoutIcon,
    criticalTextOnly,
    criticalWithAction,
    linkLinkWithIcon,
    linkSubmit,
    linkIconOnlyWithoutLabel,
    noticeWithIcon,
    noticeWithAriaLabel,
    noticeTextOnlySubmit,
    noticeWithoutChildren,
    linkNoticeWithIcon,
    linkNoticeWithAriaLabel,
    linkNoticeWithTextOnly,
    linkNoticeWithoutChildren,
  ]
  const accepted = [
    iconAndText,
    critical,
    secondary,
    submit,
    iconOnly,
    back,
    row,
    notice,
    linkNotice,
    closeIcon,
    editIcon,
    shareIcon,
    linkIconText,
    linkIconOnly,
  ]
  expect(checks.every(Boolean)).toBe(true)
  expect(accepted.some(Boolean)).toBe(false)
})
