/**
 * `CurrencyAndDecimals`, Settings → Business → Currency and decimals (`money.md`): the
 * Business's symbol and decimals (0 to 2), one form with one Save, framed by `SettingsGroup`
 * (title, "Close", the Discard dialog).
 *
 * The form holds no copy of the symbol rule: a 422 for the symbol shows the API's refusal
 * next to the field through its copy key, and the form keeps what was typed. A 409 for
 * lowering the decimals below a recorded amount shows its fixed sentence with the Attention
 * icon. The Example is the amount written by `formatMoneyIn` from the unsaved values, without
 * validating them. A save sets the module format and the `me` cache, then invalidates every
 * query, so every mounted screen writes money with the new format at once (ADR-0083).
 */

import { type FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../../api/client'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { saveMoneyFormat } from '../../api/moneyFormat'
import { REFUSAL_KEY, type RefusalCode } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import { type FixedValue, MONEY_DECIMALS } from '../../components/fixedSets'
import Icono from '../../components/Icono'
import SegmentedChoice from '../../components/SegmentedChoice'
import SinConexion from '../../components/SinConexion'
import { COMMON_TEXT } from '../../copy/common'
import { SETTINGS_TEXT } from '../../copy/settings'
import { currentMoneyFormat, formatMoneyIn, setMoneyFormat } from '../../format/money'
import { refusalText } from '../../i18n/refusalKeys'
import SettingsGroup from './SettingsGroup'

type DecimalsChoice = FixedValue<typeof MONEY_DECIMALS>

const LEAVE = {
  question: COMMON_TEXT.discardTheChanges,
  detail: COMMON_TEXT.losesWhatYouEntered,
  keepLabel: COMMON_TEXT.noKeepEditing,
  discardLabel: COMMON_TEXT.yesDiscard,
}

/** The amounts the Example writes: whole thousands, and with decimals a half, so they show. */
const EXAMPLE_WHOLE = 11000
const EXAMPLE_WITH_DECIMALS = 11000.5

const SYMBOL_CODE: RefusalCode = 'money_format.symbol_invalid'
const LOWERING_CODE: RefusalCode = 'money_format.decimals_below_recorded'
/** The refusals of the rescale a raise runs: nothing the seller typed is wrong, and nothing was saved. */
const RESCALE_CODES: readonly RefusalCode[] = [
  'money_format.amount_too_large',
  'money_format.busy',
  'money_format.rescale_check_failed',
]

function isRescaleCode(code: string): code is RefusalCode {
  return RESCALE_CODES.some((known) => known === code)
}

function choiceOf(decimals: number): DecimalsChoice {
  return decimals === 2 ? '2' : decimals === 1 ? '1' : '0'
}

export default function CurrencyAndDecimals() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(currentMoneyFormat)
  const [symbol, setSymbol] = useState(accepted.symbol)
  const [decimals, setDecimals] = useState<DecimalsChoice>(choiceOf(accepted.decimals))
  const [symbolError, setSymbolError] = useState<string | null>(null)
  const [loweringRefused, setLoweringRefused] = useState(false)
  const [rescaleRefusal, setRescaleRefusal] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function clearFeedback(): void {
    setSymbolError(null)
    setLoweringRefused(false)
    setRescaleRefusal(null)
    setFailed(false)
    setOffline(false)
    setSaved(false)
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    clearFeedback()
    setSaving(true)
    try {
      const answered = await saveMoneyFormat({ symbol, decimals: Number(decimals) })
      setMoneyFormat(answered)
      queryClient.setQueryData<Me>(keys.me(), (old) => (old === undefined ? old : { ...old, money_format: answered }))
      void queryClient.invalidateQueries()
      setAccepted(answered)
      setSymbol(answered.symbol)
      setDecimals(choiceOf(answered.decimals))
      setSaved(true)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && caught.code === SYMBOL_CODE && caught.fields['field'] === 'symbol') {
        setSymbolError(refusalText(t, { key: REFUSAL_KEY[SYMBOL_CODE] }))
      } else if (caught instanceof ApiError && caught.code === LOWERING_CODE) {
        setLoweringRefused(true)
      } else if (caught instanceof ApiError && isRescaleCode(caught.code)) {
        setRescaleRefusal(refusalText(t, { key: REFUSAL_KEY[caught.code] }))
      } else {
        setFailed(true)
      }
    } finally {
      setSaving(false)
    }
  }

  const dirty = symbol !== accepted.symbol || Number(decimals) !== accepted.decimals

  return (
    <SettingsGroup title={COMMON_TEXT.currencyAndDecimals} dirty={dirty} leave={LEAVE}>
      {saved && (
        <div className="aviso-flotante">
          <AvisoExito texto={SETTINGS_TEXT.currencySaved} />
        </div>
      )}
      <form className="formulario moneda-pantalla" onSubmit={(event) => void onSave(event)}>
        <label className="campo">
          <span className="campo__rotulo">{SETTINGS_TEXT.currencySymbol}</span>
          <input
            className="campo__input"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value)
              clearFeedback()
            }}
          />
          <span className="campo__ayuda" data-copy="help">
            {SETTINGS_TEXT.currencySymbolHint}
          </span>
          {symbolError !== null && (
            <span className="campo__error" role="alert">
              {symbolError}
            </span>
          )}
        </label>
        <div className="campo moneda-decimales">
          <span className="campo__rotulo">{SETTINGS_TEXT.currencyDecimals}</span>
          <SegmentedChoice
            options={MONEY_DECIMALS}
            value={decimals}
            ariaLabel={SETTINGS_TEXT.currencyDecimals}
            onChange={(value) => {
              setDecimals(value)
              clearFeedback()
            }}
          />
        </div>
        <div className="campo">
          <span className="campo__rotulo">{SETTINGS_TEXT.currencyExample}</span>
          <output className="campo__valor" role="status">
            {formatMoneyIn(Number(decimals) === 0 ? EXAMPLE_WHOLE : EXAMPLE_WITH_DECIMALS, {
              symbol: symbol.trim(),
              decimals: Number(decimals),
            })}
          </output>
        </div>
        {loweringRefused && (
          <div className="motivos__aviso" role="alert">
            <Icono nombre="atencion" />
            <span>{refusalText(t, { key: REFUSAL_KEY[LOWERING_CODE] })}</span>
          </div>
        )}
        {rescaleRefusal !== null && (
          <div className="motivos__aviso" role="alert">
            <Icono nombre="atencion" />
            <span>{rescaleRefusal}</span>
          </div>
        )}
        {failed && <ErrorGenerico />}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={saving}>
          {COMMON_TEXT.save}
        </Boton>
      </form>
    </SettingsGroup>
  )
}
