/**
 * Expense categories: add, rename and remove (`docs/product/expenses.md`,
 * "Expense category"). Removing one still in use is refused with the fixed line;
 * there is no archive or restore. Renaming or removing a category a partner
 * already removed answers `expense_category.not_found` (kind `gone`): the row
 * closes and the fixed gone notice shows, never the generic refusal text.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ApiError, NetworkError } from '../api/client'
import {
  type ExpenseCategory,
  addCategory,
  listCategories,
  removeCategory,
  renameCategory,
} from '../api/expenses'
import { invalidateResource, keys } from '../api/keys'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import Aviso, { type SuccessToast } from '../components/Aviso'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import SinConexion from '../components/SinConexion'

export const CANNOT_REMOVE = 'No se puede borrar: todavía tiene gastos. Podés renombrarla.'
export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'

const REMOVE_OVERRIDES: Partial<Record<RefusalCode, 'in-use'>> = {
  'expense_category.in_use': 'in-use',
}

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== 'unknown' && kindOf(caught.code) === 'refusal'
}

function CategoryRow({
  category,
  onDone,
  onGone,
}: {
  category: ExpenseCategory
  onDone: (toast: SuccessToast) => void
  onGone: () => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      await renameCategory(category.id, name)
      invalidateResource(queryClient, 'expenseCategories')
      setEditing(false)
      onDone('Categoría guardada')
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenseCategories')
        setEditing(false)
        onGone()
      } else if (isRefusal(caught)) {
        setError(GENERIC_REFUSAL)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  async function remove(): Promise<void> {
    setSending(true)
    try {
      await removeCategory(category.id)
      invalidateResource(queryClient, 'expenseCategories')
      setConfirming(false)
      onDone('Categoría eliminada')
    } catch (caught) {
      invalidateResource(queryClient, 'expenseCategories')
      setConfirming(false)
      if (caught instanceof ApiError && resolveOverride(REMOVE_OVERRIDES, caught.code) === 'in-use') {
        setError(CANNOT_REMOVE)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (isRefusal(caught)) {
        setError(GENERIC_REFUSAL)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (editing) {
    return (
      <form className="fila" onSubmit={save}>
        <input
          className="campo__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Nombre de ${category.name}`}
        />
        <button className="boton" type="submit" disabled={sending}>
          Guardar
        </button>
      </form>
    )
  }

  return (
    <div className="fila">
      <span className="categoria-fila__nombre">{category.name}</span>
      <button type="button" className="boton--enlace" onClick={() => setEditing(true)}>
        Renombrar
      </button>
      <button type="button" className="boton--enlace" onClick={() => setConfirming(true)}>
        Eliminar
      </button>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
      {offline && <SinConexion />}
      {confirming && (
        <div className="capa" role="presentation">
          <div className="capa__contenido panel">
            <span className="panel__titulo">¿Borrás la categoría?</span>
            <span className="panel__detalle">
              Se borra &ldquo;{category.name}&rdquo;. Esto no se puede deshacer.
            </span>
            <div className="panel__botones">
              <button type="button" className="boton boton--suave" onClick={() => setConfirming(false)}>
                No, dejala
              </button>
              <button type="button" className="boton boton--destructivo" disabled={sending} onClick={remove}>
                Sí, borrala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GastoCategorias() {
  const queryClient = useQueryClient()
  const categories = useQuery({ queryKey: keys.expenseCategories(), queryFn: listCategories })
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)
  const [sending, setSending] = useState(false)

  function flash(message: SuccessToast): void {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  function flashGone(): void {
    setGoneNotice(true)
    setTimeout(() => setGoneNotice(false), 2500)
  }

  async function onAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      await addCategory(newName)
      invalidateResource(queryClient, 'expenseCategories')
      setNewName('')
      flash('Categoría guardada')
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (isRefusal(caught)) setError(GENERIC_REFUSAL)
      else setError(ERROR_GENERICO_MENSAJE)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <Link to="/gastos" className="boton--enlace">
          Volver a Gastos
        </Link>
        <span className="encabezado__titulo">Categorías</span>

        {categories.isPending && null}
        {categories.isError && categories.error instanceof NetworkError && <SinConexion />}
        {categories.isError && !(categories.error instanceof NetworkError) && <ErrorGenerico />}

        {categories.data !== undefined && (
          <div>
            {categories.data.map((category) => (
              <CategoryRow key={category.id} category={category} onDone={flash} onGone={flashGone} />
            ))}
          </div>
        )}

        <form className="formulario" onSubmit={onAdd}>
          <label className="campo">
            <span className="campo__rotulo">Nueva categoría</span>
            <input
              className="campo__input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
            />
          </label>
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
          {offline && <SinConexion />}
          <button className="boton" type="submit" disabled={sending || newName.trim() === ''}>
            Agregar categoría
          </button>
        </form>
      </div>
      {toast !== null && <Aviso texto={toast} />}
      {goneNotice && <GoneNotice />}
    </main>
  )
}
