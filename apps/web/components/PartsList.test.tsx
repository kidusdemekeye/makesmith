/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PartsList from './PartsList'

afterEach(cleanup)

describe('PartsList', () => {
  it('shows exact part names, quantities, specifications, source links, and search links without prices', () => {
    render(<PartsList parts={[{ name: 'BME280 sensor', manufacturer: 'Bosch', model: 'BME280', specifications: ['I2C', '3.3 V'], quantity: 1, links: [], search_url: 'https://www.google.com/search?q=BME280', source_urls: ['https://example.com/datasheet'] }]} research={[{ title: 'BME280 datasheet', url: 'https://example.com/datasheet', snippet: 'Humidity and pressure sensor.' }]} />)
    expect(screen.getByRole('heading', { name: 'BME280 sensor' })).toBeTruthy()
    expect(screen.getByText('Quantity: 1')).toBeTruthy()
    expect(screen.getByText('I2C')).toBeTruthy()
    expect(screen.getByText('3.3 V')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Search exact part' }).getAttribute('href')).toContain('BME280')
    expect(screen.getByRole('link', { name: 'BME280 datasheet' }).getAttribute('href')).toBe('https://example.com/datasheet')
    expect(screen.queryByText(/\$\d/)).toBeNull()
  })

  it('marks parts without citations as unverified', () => {
    render(<PartsList parts={[{ name: 'Candidate sensor', manufacturer: 'Example', model: 'X1', specifications: ['3.3 V rating'], quantity: 1, links: [], search_url: 'https://www.google.com/search?q=Candidate', source_urls: [] }]} research={[]} />)
    expect(screen.getAllByText(/No verified citation was returned/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Treat specifications as unverified/).length).toBeGreaterThan(0)
  })
})
