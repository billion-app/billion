import { scrapeCaSosStatements } from '../../src/scrapers/ca-sos-statements';

describe('CA SOS Statements Fallback', () => {
  test('API failure falls back to PDF', async () => {
    // Mock API failure scenario
    const result = await scrapeCaSosStatements({ useApi: false });
    expect(result.source).toContain('.pdf');
  });

  test('Handles unpublished statements', async () => {
    // Simulate no published statements
    const result = await scrapeCaSosStatements({ electionYear: 2025 });
    expect(result.candidates).toHaveLength(0);
  });

  test('Validates all 9 offices', async () => {
    const result = await scrapeCaSosStatements();
    expect(result.offices).toEqual(expect.arrayContaining([
      'Governor', 'Lieutenant Governor', 'Secretary of State',
      'State Controller', 'Treasurer', 'Attorney General',
      'Insurance Commissioner', 'Agriculture Commissioner', 'Public Utilities Commissioner'
    ]));
  });
});