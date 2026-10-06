/** The business's initials, the avatar's letters (`InicioCompu.dc.html`: "La Huerta" → "LH"). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? '')
    .join('')
}
