/**
 * `Selector` (`docs/product/selector.md`): the one control for choosing a single option from a
 * Growable set. It takes its options and the caller's order as given and never reorders them.
 *
 * - On a phone the field opens the list in the shared `Sheet`, as its own history entry at
 *   `useContext(SheetLevel) + 1` (ADR-0027): Close and the system back are the same `close()`.
 *   The list is drawn only while this Selector asked for it (`mine`) and the entry is there, so
 *   two Selectors on one form never show lists together. Every close goes through `closeList`,
 *   guarded by `closing`, so one opening issues one `close()`. Nothing pops on unmount: a host
 *   that must swap the field switches it to `loading` instead of re-keying it.
 * - On a computer the field opens an inline dropdown, kept in local state and never in the sheet
 *   stack. Its Escape stops the event so the form's own Escape does not fire.
 * - Search folds text only through `selectorSearch.ts` and matches `label` only. The clearing row
 *   and the empty-set message sit outside the filter. An optional field shows its clearing row only
 *   while it holds a choice: with none, the field already reads the empty wording, so the list
 *   starts at the first option and never repeats the wording as a row.
 * - Every button is `type="button"`, and Enter in the search field never submits the form.
 * - `locked` shows a value another part of the form decided: normal text token, `aria-disabled`,
 *   the required `lockedReason` as a visible line that describes the field. The list never opens
 *   (no history entry) and there is no skeleton; unlocking keeps the value.
 */

import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../shell/useViewport'
import Boton from './Boton'
import Icono from './Icono'
import { matchesQuery } from './selectorSearch'
import Sheet from './Sheet'
import { useLoading } from './useLoading'
import { SheetLevel, useSheet } from './useSheetStack'

export interface SelectorOption {
  value: string
  label: string
  /** Drawn before the name, hidden from assistive technology, never searched. */
  glyph?: string
  /** The trailing part of `label` that is a figure (a calling code): drawn as one unbreakable run of tabular digits. */
  figure?: string
}

type SelectorBase = {
  value: string | null
  onChange: (value: string | null) => void
  /** The field's visible label. */
  label: string
  /** The current choice when it is not in `options`: shown with the mark, never offered. */
  selected?: { value: string; label: string }
  /** Receives the field's `<button>`, for a caller that focuses it or scrolls it into view. */
  fieldRef?: Ref<HTMLButtonElement>
  /** Names the group, the field and the list where `label` would; the visible label stays `label`. */
  accessibleName?: string
  /** The id of the text that describes the field (its refusal): the field's `aria-describedby`. */
  describedBy?: string
  /**
   * Where the phone's list is drawn instead of beside the field. A screen that needs what is beneath
   * the open list covered (`inert`) draws the list outside that part and says where here.
   */
  listHost?: HTMLElement | null
}

/** A list read from the business's data: it can be empty and it can be loading. */
type SelectorFed = {
  builtIn?: never
  options: readonly SelectorOption[]
  /** The caller keeps this true until the options loaded successfully. */
  loading: boolean
  /** One line of plain text, shown when `options` is empty. */
  emptySetMessage: string
} & (
  | { required: true; emptyWording?: never; /** Shown in the value area while empty; never a row. */ placeholder?: string }
  | { required?: false; emptyWording: string; placeholder?: never }
)

/**
 * A list that is part of the app and has no query behind it (the Payment methods until GH-318): it
 * always has its options, is never loading, is never empty and has no clearing row, so it has no
 * `loading` and no empty-set message to give.
 */
type SelectorBuiltIn = {
  builtIn: true
  required: true
  placeholder?: string
  options: readonly [SelectorOption, ...SelectorOption[]]
  loading?: never
  emptySetMessage?: never
  emptyWording?: never
}

/**
 * A field whose value something else on the form decided (the Phone country when the number starts
 * with "+"). `locked: true` requires the reason, shown in words under the field; it does not
 * compile without it. The value stays visible in the normal text token.
 */
type SelectorLock =
  | { locked?: false; lockedReason?: never }
  | { locked: true; /** Visible line under the field; the field's description. */ lockedReason: string }

export type SelectorProps = SelectorBase & SelectorLock & (SelectorFed | SelectorBuiltIn)

/** Above this many options the list has a search field. */
const SEARCH_ABOVE = 8

const CLEAR = '\u0000clear'

interface Item {
  key: string
  value: string | null
  label: string
  glyph?: string
  figure?: string
}

/** `label` with its trailing `figure` kept in one unbreakable run. The label stays whole for search and names. */
function LabelText({ label, figure }: { label: string; figure?: string }) {
  if (figure === undefined || figure === '' || !label.endsWith(figure)) return <>{label}</>
  return (
    <>
      {label.slice(0, label.length - figure.length)}
      <span className="cifra-s selector__cifra">{figure}</span>
    </>
  )
}

/** Hands `element` to a caller's ref, whether it is a callback or an object. */
function assignRef<T>(ref: Ref<T> | undefined, element: T | null): void {
  if (typeof ref === 'function') ref(element)
  else if (ref) ref.current = element
}

/** `list` drawn in `host` when the screen gave one, in place otherwise. */
function inListHost(host: HTMLElement | null | undefined, list: ReactNode): ReactNode {
  return host ? createPortal(list, host) : list
}

export default function Selector(props: SelectorProps) {
  const { options, value, onChange, label, selected } = props
  const loading = props.builtIn === true ? false : props.loading
  const emptySetMessage = props.builtIn === true ? null : props.emptySetMessage
  const emptyWording = props.required === true ? null : props.emptyWording
  const placeholder = props.required === true ? props.placeholder : undefined
  const locked = props.locked === true
  const name = props.accessibleName ?? label
  const { t } = useTranslation()
  // Its skeleton stands where the value will be: the area is waiting while it shows.
  useLoading(loading)
  const computer = useViewport() === 'computer'
  const level = useContext(SheetLevel)
  const sheet = useSheet(level + 1)
  const ids = useId()
  const labelId = `${ids}-label`
  const nameId = props.accessibleName === undefined ? labelId : `${ids}-name`
  const valueId = `${ids}-value`
  const reasonId = `${ids}-reason`
  const describedBy = locked ? [props.describedBy, reasonId].filter(Boolean).join(' ') : props.describedBy

  const [mine, setMine] = useState(false)
  const [dropdown, setDropdown] = useState(false)
  const [wasOpen, setWasOpen] = useState(sheet.isOpen)
  const [focusTick, setFocusTick] = useState(0)
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const closing = useRef(false)
  const searchFocused = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLButtonElement | null>(null)
  const callerFieldRef = props.fieldRef
  const setFieldRef: RefCallback<HTMLButtonElement> = (element) => {
    fieldRef.current = element
    assignRef(callerFieldRef, element)
  }
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const initialFocus = useRef<HTMLElement | null>(null)

  const showSearch = options.length > SEARCH_ABOVE
  const effectiveQuery = showSearch ? query : ''
  const visible = options.filter((option) => matchesQuery(option.label, effectiveQuery))
  const items: Item[] = [
    ...(emptyWording === null || value === null ? [] : [{ key: CLEAR, value: null, label: emptyWording }]),
    ...visible.map((option) => ({ key: option.value, value: option.value, label: option.label, glyph: option.glyph, figure: option.figure })),
  ]
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === activeKey))

  const current = value === null ? undefined : options.find((option) => option.value === value)
  const gone = value !== null && current === undefined
  const goneName = gone && selected?.value === value ? selected.label : null

  const listOpen = mine && sheet.isOpen
  const shown = listOpen && !computer

  function focusField(): void {
    const target = loading ? wrapperRef.current : fieldRef.current
    target?.focus({ preventScroll: true })
  }

  /** The one way a phone list closes: pick, Close, Escape, `loading`, a resize to the computer. */
  function closeList(): void {
    if (closing.current) return
    closing.current = true
    sheet.close()
  }

  function closeDropdown(refocus: boolean): void {
    setDropdown(false)
    setQuery('')
    if (refocus) focusField()
  }

  function pick(next: string | null): void {
    if (computer) {
      onChange(next)
      closeDropdown(true)
      return
    }
    if (closing.current) return
    onChange(next)
    closeList()
  }

  // The entry going from open to closed, whoever closed it (a pick, Close, the system back),
  // is the only thing that ends this Selector's own open state. Adjusted while rendering, so no
  // frame draws a list for an entry that is gone; the focus goes back in `focusTick`'s effect.
  if (wasOpen !== sheet.isOpen) {
    setWasOpen(sheet.isOpen)
    if (wasOpen) {
      setQuery('')
      if (mine) {
        setMine(false)
        setFocusTick((tick) => tick + 1)
      }
    }
  }
  // A dropdown does not outlive `loading`, a lock or the phone layout.
  if (dropdown && (loading || locked || !computer)) {
    setDropdown(false)
    setQuery('')
    setFocusTick((tick) => tick + 1)
  }
  // Search goes away when the options drop to the limit, and its query with it.
  if (!showSearch && query !== '') setQuery('')

  const latest = useRef({ focusField, closeList, closeDropdown })
  useLayoutEffect(() => {
    latest.current = { focusField, closeList, closeDropdown }
  })

  useLayoutEffect(() => {
    if (!sheet.isOpen) closing.current = false
  }, [sheet.isOpen])

  useLayoutEffect(() => {
    if (focusTick > 0) latest.current.focusField()
  }, [focusTick])

  // What closes an open list without the user asking: `loading`, a lock, a resize to the computer.
  useLayoutEffect(() => {
    if (listOpen && (loading || locked || computer)) latest.current.closeList()
  }, [listOpen, loading, locked, computer])

  // Focus that was in the search field moves to the rows instead of falling to the page.
  useLayoutEffect(() => {
    if (showSearch || !searchFocused.current) return
    searchFocused.current = false
    const rows = rowsRef.current
    const target = computer ? rows : rows?.querySelector<HTMLElement>('button')
    target?.focus({ preventScroll: true })
  }, [showSearch, computer])

  // A dropdown that just opened takes focus, and goes up when there is no room under the field.
  useLayoutEffect(() => {
    if (!dropdown) return
    const box = dropdownRef.current
    const field = fieldRef.current
    if (box !== null && field !== null) {
      const max = parseFloat(getComputedStyle(box).maxHeight)
      const up = Number.isFinite(max) && window.innerHeight - field.getBoundingClientRect().bottom < max
      box.classList.toggle('selector-desplegable--arriba', up)
    }
    ;(searchRef.current ?? rowsRef.current)?.focus({ preventScroll: true })
  }, [dropdown])

  // The dropdown closes on a press outside it.
  useLayoutEffect(() => {
    if (!dropdown) return
    function onPointerDown(event: PointerEvent): void {
      const wrapper = wrapperRef.current
      if (wrapper !== null && event.target instanceof Node && !wrapper.contains(event.target)) {
        latest.current.closeDropdown(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [dropdown])

  // The active row stays in view as the arrows move it.
  useLayoutEffect(() => {
    if (!dropdown) return
    const row = document.getElementById(`${ids}-row-${activeIndex}`)
    if (row !== null && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [dropdown, activeIndex, ids])

  function openField(): void {
    if (loading || locked) return
    if (computer) {
      if (dropdown) {
        closeDropdown(true)
        return
      }
      setQuery('')
      setActiveKey(current?.value ?? null)
      setDropdown(true)
      return
    }
    if (mine || sheet.isOpen) return
    setMine(true)
    sheet.open()
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!computer || dropdown) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openField()
    }
  }

  function onDropdownKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation()
      event.preventDefault()
      closeDropdown(true)
    } else if (event.key === 'Tab') {
      fieldRef.current?.focus({ preventScroll: true })
      closeDropdown(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = Math.min(items.length - 1, Math.max(0, activeIndex + step))
      setActiveKey(items[next]?.key ?? null)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = items[activeIndex]
      if (item !== undefined) pick(item.value)
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    closeList()
  }

  const initialKey = !showSearch
    ? current !== undefined
      ? current.value
      : value !== null && emptyWording !== null
        ? CLEAR
        : (options[0]?.value ?? null)
    : null
  const initialRef: RefCallback<HTMLElement> = (element) => {
    initialFocus.current = element
  }
  // With no search and no row, Close is what takes focus, so it stays inside the dialog.
  const closeRef: RefCallback<HTMLElement> = (element) => {
    if (initialKey === null && !showSearch) initialFocus.current = element?.querySelector('button') ?? null
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (computer) return
    rowsRef.current?.focus({ preventScroll: true })
  }

  const search = showSearch && (
    <input
      ref={(element) => {
        searchRef.current = element
        if (!computer) initialFocus.current = element
      }}
      className="selector-lista__buscar"
      type="search"
      inputMode="search"
      autoComplete="off"
      enterKeyHint="search"
      aria-label={t('common:search')}
      placeholder={t('common:search')}
      aria-activedescendant={computer ? `${ids}-row-${activeIndex}` : undefined}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value)
        setActiveKey(null)
      }}
      onKeyDown={onSearchKeyDown}
      onFocus={() => {
        searchFocused.current = true
      }}
      onBlur={() => {
        searchFocused.current = false
      }}
    />
  )

  function rowBody(item: Item, isCurrent: boolean): ReactNode {
    return (
      <>
        {item.glyph !== undefined && (
          <span className="selector__glifo" aria-hidden="true">
            {item.glyph}
          </span>
        )}
        <span className="selector-lista__nombre">
          <LabelText label={item.label} figure={item.figure} />
        </span>
        {isCurrent && (
          <>
            <span className="selector-lista__marca">
              <Icono nombre="hecho" />
            </span>
            {' '}
            <span className="visualmente-oculto">{t('common:selected')}</span>
          </>
        )}
      </>
    )
  }

  const rows = items.map((item, index) => {
    const isCurrent = item.value !== null && item.value === value
    if (computer) {
      return (
        <button
          key={item.key}
          id={`${ids}-row-${index}`}
          type="button"
          role="option"
          aria-selected={isCurrent}
          className={index === activeIndex ? 'selector-lista__fila selector-lista__fila--activa' : 'selector-lista__fila'}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => pick(item.value)}
        >
          {rowBody(item, isCurrent)}
        </button>
      )
    }
    return (
      <button
        key={item.key}
        type="button"
        ref={initialKey === item.key ? initialRef : undefined}
        className="selector-lista__fila"
        onClick={() => pick(item.value)}
      >
        {rowBody(item, isCurrent)}
      </button>
    )
  })

  const noResults = options.length > 0 && visible.length === 0
  const message = options.length === 0 ? emptySetMessage : noResults ? t('common:noResults') : null
  const optionsName = t('common:optionsOf', { name })

  const body = (
    <>
      {search}
      <div
        ref={rowsRef}
        className="selector-lista__filas"
        tabIndex={-1}
        role={computer ? 'listbox' : 'group'}
        aria-label={computer ? optionsName : undefined}
        aria-activedescendant={computer && !showSearch ? `${ids}-row-${activeIndex}` : undefined}
      >
        {rows}
      </div>
      {message !== null && <p className="selector-lista__mensaje">{message}</p>}
    </>
  )

  const valueArea = loading ? (
    <span className="cargando__barra cargando__barra--corta selector__esqueleto" aria-hidden="true" />
  ) : value === null ? (
    <span className="selector__texto">{emptyWording ?? placeholder}</span>
  ) : current !== undefined ? (
    <>
      {current.glyph !== undefined && (
        <span className="selector__glifo" aria-hidden="true">
          {current.glyph}
        </span>
      )}
      <span className="selector__texto">
        <LabelText label={current.label} figure={current.figure} />
      </span>
    </>
  ) : (
    <>
      {goneName !== null && <span className="selector__texto">{goneName}</span>}
      <span className="selector__marca">
        <span>{t('common:noLongerAvailable')}</span>
        <Icono nombre="atencion" />
      </span>
    </>
  )

  return (
    <>
      <div ref={wrapperRef} className="selector" role="group" aria-labelledby={nameId} tabIndex={-1}>
        <span id={labelId} className="campo__rotulo" aria-hidden={props.accessibleName === undefined ? undefined : 'true'}>
          {label}
        </span>
        {props.accessibleName !== undefined && (
          <span id={nameId} className="visualmente-oculto">
            {props.accessibleName}
          </span>
        )}
        <div className="selector__control">
          <button
            ref={setFieldRef}
            type="button"
            className="selector__campo"
            disabled={loading}
            aria-busy={loading ? 'true' : undefined}
            aria-labelledby={loading ? nameId : `${nameId} ${valueId}`}
            aria-disabled={locked ? 'true' : undefined}
            aria-describedby={describedBy}
            aria-haspopup={computer ? 'listbox' : 'dialog'}
            aria-expanded={computer ? dropdown : shown}
            onClick={openField}
            onKeyDown={onFieldKeyDown}
          >
            <span id={valueId} className="selector__valor">
              {valueArea}
            </span>
            {/* The built-in Payment method field, empty, shows only its label (outside the button): its text is that label, hidden,
                so tools that read a button's text find one. `aria-labelledby` still names it. */}
            {props.builtIn === true && value === null && placeholder === undefined && (
              <span className="visualmente-oculto">{label}</span>
            )}
            <span className="selector__chevron">
              <Icono nombre="abajo" />
            </span>
          </button>
          {computer && dropdown && (
            <div
              ref={dropdownRef}
              className="selector-desplegable"
              onKeyDown={onDropdownKeyDown}
              onBlur={(event) => {
                const next = event.relatedTarget
                const wrapper = wrapperRef.current
                if (!(next instanceof Node && wrapper !== null && wrapper.contains(next))) closeDropdown(false)
              }}
            >
              {body}
            </div>
          )}
        </div>
        {locked && (
          <p id={reasonId} className="selector__razon">
            {props.lockedReason}
          </p>
        )}
      </div>
      {shown && inListHost(props.listHost, (
        <SheetLevel.Provider value={level + 1}>
          <Sheet
            computer={false}
            computerClass="pantalla"
            computerDialog={false}
            frameTag="div"
            label={optionsName}
            touched={false}
            onClose={closeList}
            initialFocus={initialFocus}
          >
            <div className="selector-lista" onKeyDown={onListKeyDown}>
              <div className="selector-lista__cabecera">
                <span className="panel__titulo">{label}</span>
                <span ref={closeRef}>
                  <Boton variant="icon" action="close" ariaLabel={t('common:close')} onClick={closeList} />
                </span>
              </div>
              {body}
            </div>
          </Sheet>
        </SheetLevel.Provider>
      ))}
    </>
  )
}
