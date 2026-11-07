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
 *   and the empty-set message sit outside the filter.
 * - Every button is `type="button"`, and Enter in the search field never submits the form.
 */

import {
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useViewport } from '../shell/useViewport'
import Boton from './Boton'
import Icono from './Icono'
import { matchesQuery } from './selectorSearch'
import Sheet from './Sheet'
import { SheetLevel, useSheet } from './useSheetStack'

export interface SelectorOption {
  value: string
  label: string
  /** Drawn before the name, hidden from assistive technology, never searched. */
  glyph?: string
}

export type SelectorProps = {
  options: readonly SelectorOption[]
  value: string | null
  onChange: (value: string | null) => void
  /** The field's visible label. */
  label: string
  /** The current choice when it is not in `options`: shown with the mark, never offered. */
  selected?: { value: string; label: string }
  /** The caller keeps this true until the options loaded successfully. */
  loading: boolean
  /** One line of plain text, shown when `options` is empty. */
  emptySetMessage: string
} & ({ required: true; emptyWording?: never } | { required?: false; emptyWording: string })

/** Above this many options the list has a search field. */
const SEARCH_ABOVE = 8

const CLEAR = '\u0000clear'

interface Item {
  key: string
  value: string | null
  label: string
  glyph?: string
}

export default function Selector(props: SelectorProps) {
  const { options, value, onChange, label, selected, loading, emptySetMessage } = props
  const emptyWording = props.required === true ? null : props.emptyWording
  const { t } = useTranslation()
  const computer = useViewport() === 'computer'
  const level = useContext(SheetLevel)
  const sheet = useSheet(level + 1)
  const ids = useId()
  const labelId = `${ids}-label`
  const valueId = `${ids}-value`

  const [mine, setMine] = useState(false)
  const [dropdown, setDropdown] = useState(false)
  const [flip, setFlip] = useState(false)
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const closing = useRef(false)
  const wasOpen = useRef(false)
  const searchFocused = useRef(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<HTMLDivElement>(null)
  const initialFocus = useRef<HTMLElement | null>(null)

  const showSearch = options.length > SEARCH_ABOVE
  const effectiveQuery = showSearch ? query : ''
  const visible = options.filter((option) => matchesQuery(option.label, effectiveQuery))
  const items: Item[] = [
    ...(emptyWording === null ? [] : [{ key: CLEAR, value: null, label: emptyWording }]),
    ...visible.map((option) => ({ key: option.value, value: option.value, label: option.label, glyph: option.glyph })),
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
  // is the only thing that ends this Selector's own open state.
  useLayoutEffect(() => {
    const was = wasOpen.current
    wasOpen.current = sheet.isOpen
    if (!was || sheet.isOpen) return
    closing.current = false
    setQuery('')
    if (mine) {
      setMine(false)
      focusField()
    }
  })

  // What closes an open list or dropdown without the user asking: `loading`, a resize.
  useLayoutEffect(() => {
    if (listOpen && (loading || computer)) closeList()
    if (dropdown && (loading || !computer)) {
      setDropdown(false)
      setQuery('')
      focusField()
    }
  })

  // Search goes away when the options drop to the limit: the query clears, and focus that was in
  // the field moves to the rows instead of falling to the page.
  useLayoutEffect(() => {
    if (showSearch) return
    if (query !== '') setQuery('')
    if (!searchFocused.current) return
    searchFocused.current = false
    const rows = rowsRef.current
    const target = computer ? rows : rows?.querySelector<HTMLElement>('button')
    target?.focus({ preventScroll: true })
  })

  // A dropdown that just opened takes focus, and goes up when there is no room under the field.
  useLayoutEffect(() => {
    if (!dropdown) return
    const box = dropdownRef.current
    const field = fieldRef.current
    if (box !== null && field !== null) {
      const max = parseFloat(getComputedStyle(box).maxHeight)
      setFlip(Number.isFinite(max) && window.innerHeight - field.getBoundingClientRect().bottom < max)
    }
    ;(searchRef.current ?? rowsRef.current)?.focus({ preventScroll: true })
  }, [dropdown])

  // The dropdown closes on a press outside it.
  useLayoutEffect(() => {
    if (!dropdown) return
    function onPointerDown(event: PointerEvent): void {
      const wrapper = wrapperRef.current
      if (wrapper !== null && event.target instanceof Node && !wrapper.contains(event.target)) {
        closeDropdown(false)
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
    if (loading) return
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
      : emptyWording !== null
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
      onChange={(event) => setQuery(event.target.value)}
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
        <span className="selector-lista__nombre">{item.label}</span>
        {isCurrent && (
          <>
            <span className="selector-lista__marca">
              <Icono nombre="hecho" />
            </span>
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
        <div
          key={item.key}
          id={`${ids}-row-${index}`}
          role="option"
          aria-selected={isCurrent}
          className={`selector-lista__fila${index === activeIndex ? ' selector-lista__fila--activa' : ''}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => pick(item.value)}
        >
          {rowBody(item, isCurrent)}
        </div>
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
  const optionsName = t('common:optionsOf', { name: label })

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
    <span className="selector__texto">{emptyWording}</span>
  ) : current !== undefined ? (
    <>
      {current.glyph !== undefined && (
        <span className="selector__glifo" aria-hidden="true">
          {current.glyph}
        </span>
      )}
      <span className="selector__texto">{current.label}</span>
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
      <div ref={wrapperRef} className="selector" role="group" aria-labelledby={labelId} tabIndex={-1}>
        <span id={labelId} className="campo__rotulo">
          {label}
        </span>
        <div className="selector__control">
          <button
            ref={fieldRef}
            type="button"
            className="selector__campo"
            disabled={loading}
            aria-busy={loading ? 'true' : undefined}
            aria-labelledby={loading ? labelId : `${labelId} ${valueId}`}
            aria-haspopup={computer ? 'listbox' : 'dialog'}
            aria-expanded={computer ? dropdown : shown}
            onClick={openField}
            onKeyDown={onFieldKeyDown}
          >
            <span id={valueId} className="selector__valor">
              {valueArea}
            </span>
            <span className="selector__chevron">
              <Icono nombre="abajo" />
            </span>
          </button>
          {computer && dropdown && (
            <div
              ref={dropdownRef}
              className={`selector-desplegable${flip ? ' selector-desplegable--arriba' : ''}`}
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
      </div>
      {shown && (
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
      )}
    </>
  )
}
