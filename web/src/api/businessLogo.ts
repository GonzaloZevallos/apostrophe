/**
 * The Business logo's three calls, on the client (`ApiError.code` carries a refusal such as
 * `business_logo.too_big`). Each function owns its own 404 rule. Nothing here logs: the
 * file's bytes, name, size and type are never written anywhere.
 */

import { ApiError, del, getBlob, putBody } from './client'

const LOGO_PATH = '/api/business/logo'

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/** The logo's image, or `null` when the Business has none. Any other failure rejects. */
export async function getBusinessLogo(): Promise<Blob | null> {
  try {
    return await getBlob(LOGO_PATH)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Sends the file as it is; every failure rejects, a 404 included. */
export function putBusinessLogo(file: Blob): Promise<void> {
  return putBody(LOGO_PATH, file, 'application/octet-stream')
}

/** A 404 means there is no logo, which is what removing wanted. */
export async function deleteBusinessLogo(): Promise<void> {
  try {
    await del<void>(LOGO_PATH)
  } catch (error) {
    if (!isNotFound(error)) throw error
  }
}
