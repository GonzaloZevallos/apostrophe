/**
 * Types and calls for expenses and expense categories (plan: `GET/POST
 * /expense-categories`, `PATCH /expense-categories/{id}`, `DELETE
 * /expense-categories/{id}`, `GET/POST /expenses`, `PUT/DELETE /expenses/{id}`).
 * Every call goes through `api/client.ts`; no screen calls `fetch` itself.
 */

import { del, get, patch, post, put } from './client'

export interface ExpenseCategory {
  id: number
  name: string
}

export interface Expense {
  id: number
  spent_on: string
  category_id: number
  amount: number
  detail: string
}

export interface CategorySubtotal {
  id: number
  name: string
  subtotal: number
  expenses: Expense[]
}

export interface MonthlyView {
  month: string
  total: number
  categories: CategorySubtotal[]
}

export interface ExpenseInput {
  spent_on: string
  category_id: number
  amount: number
  detail: string
}

export function listCategories(): Promise<ExpenseCategory[]> {
  return get<ExpenseCategory[]>('/expense-categories')
}

export function addCategory(name: string): Promise<ExpenseCategory> {
  return post<ExpenseCategory>('/expense-categories', { name })
}

export function renameCategory(id: number, name: string): Promise<ExpenseCategory> {
  return patch<ExpenseCategory>(`/expense-categories/${id}`, { name })
}

export function removeCategory(id: number): Promise<void> {
  return del<void>(`/expense-categories/${id}`)
}

export function monthlyView(month: string): Promise<MonthlyView> {
  return get<MonthlyView>(`/expenses?month=${month}`)
}

export function recordExpense(body: ExpenseInput): Promise<Expense> {
  return post<Expense>('/expenses', body)
}

export function editExpense(id: number, body: ExpenseInput): Promise<Expense> {
  return put<Expense>(`/expenses/${id}`, body)
}

export function deleteExpense(id: number): Promise<void> {
  return del<void>(`/expenses/${id}`)
}
