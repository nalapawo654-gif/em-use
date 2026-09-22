// Visual forms only: real balances, exhaustion and notification thresholds stay independent.
export function petQuotaSamples(formCount: number): number[] {
  if (!Number.isInteger(formCount) || formCount < 1) throw new RangeError('formCount must be a positive integer')
  return Array.from({ length: formCount }, (_, index) => 100 * (formCount - index) / formCount)
}

// At an exact boundary, enter the next form. Zero remains in the last form.
export function petQuotaIndex(percent: number | null, formCount: number): number | null {
  const samples = petQuotaSamples(formCount)
  if (percent === null || !Number.isFinite(percent)) return null
  for (let index = 0; index < samples.length - 1; index++) {
    // Amount → percentage conversion can differ by a few floating-point units.
    const boundary = samples[index + 1]!
    if (percent - boundary > Number.EPSILON * 100 * 4) return index
  }
  return formCount - 1
}
