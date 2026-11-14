export const RESULT_TABS = [
  { id: 'design', label: 'Design', number: '01' },
  { id: 'parts', label: 'Parts', number: '02' },
  { id: 'manual', label: 'Manual', number: '03' },
  { id: 'files', label: '3D Files', number: '04' },
  { id: 'checks', label: 'Checks', number: '05' },
  { id: 'simulation', label: 'Simulation', number: '06' },
] as const

export type ResultTabId = (typeof RESULT_TABS)[number]['id']
