/** The business's initials: the first letter of its first two words. */
export function initialsOf(businessName: string): string {
  const words = businessName.split(/\s+/).filter((word) => word !== '')
  return words
    .slice(0, 2)
    .map((word) => (word[0] ?? '').toUpperCase())
    .join('')
}
