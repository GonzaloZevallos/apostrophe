/**
 * `SettingsHome`, the phone Settings home (`Configuracion.dc.html`): the title, the Business card,
 * then `SettingsHomeList` (the three shortcuts and the five groups). The screen owns the two
 * reads the list's rows depend on, `/business` (shared with the Users group through
 * `businessQueryOptions`) and `/pricing-settings`, and hands the list their values as plain
 * context; each is `undefined` until it has answered, so a conditional row never shows early.
 *
 * The card is read-only: no role, link, button or chevron. Its count slot has a fixed height and
 * stays empty while the read is pending and after it fails, so a wrong count never shows and
 * nothing moves when it fills. Every text is a copy key; every row, icon and address is the
 * registry's, read by the list.
 */

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router'
import { businessQueryOptions } from '../../api/business'
import type { Me } from '../../api/me'
import { pricingSettingsQueryOptions } from '../../api/pricingSettings'
import ContentArea from '../../components/ContentArea'
import { useLoading } from '../../components/useLoading'
import SettingsHomeList from './SettingsHomeList'

export default function SettingsHome() {
  return (
    <ContentArea as="main" className="pantalla">
      <HomeBody />
    </ContentArea>
  )
}

/** Below `ContentArea`, so `useLoading` counts on the area that owns `aria-busy`. */
function HomeBody() {
  const { t } = useTranslation()
  const me = useOutletContext<Me>()
  const business = useQuery(businessQueryOptions())
  const pricing = useQuery(pricingSettingsQueryOptions())
  useLoading(business.isPending || pricing.isPending)

  const initial = Array.from(me.business_name.trim())[0]
  const count = business.data?.users.length

  return (
    <div className="cuerpo ajustes-inicio__marco">
      <h1 className="ajustes-inicio__encabezado">{t('settings:home.title')}</h1>
      <div className="ajustes-inicio-tarjeta__tarjeta">
        <span className="ajustes-inicio-tarjeta__inicial">{initial}</span>
        <span className="ajustes-inicio-tarjeta__textos">
          <span className="ajustes-inicio-tarjeta__nombre">{me.business_name}</span>
          <span className="ajustes-inicio-tarjeta__cantidad">
            {count === undefined ? '' : t('settings:card.users', { count })}
          </span>
        </span>
      </div>
      <SettingsHomeList
        ctx={{
          selectableLanguages: business.data?.selectable_languages,
          isCustomerTypesOn: pricing.data?.is_vip_customers,
        }}
      />
    </div>
  )
}
