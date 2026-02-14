import { describe, it, expect, beforeEach, vi } from 'vitest';
import { suggestCategory, learnFromApproval } from '../categorizer';
import type { PnxDb, PnxItem } from '@/types/pnx';
import { defaultDb } from '@/data/db';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Categorizer', () => {
  let db: PnxDb;

  beforeEach(() => {
    localStorageMock.clear();
    db = defaultDb();
  });

  describe('suggestCategory', () => {
    it('should suggest "cat_bills" for bill-related items', () => {
      const item = {
        title: 'Electric Bill',
        description: 'Monthly utility payment',
        fileName: 'bill.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should suggest "cat_legal" for legal documents', () => {
      const item = {
        title: 'Court Order',
        description: 'Legal document from attorney',
        fileName: 'court_order.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_legal');
    });

    it('should suggest "cat_docs" for general documents', () => {
      const item = {
        title: 'Lease Agreement',
        description: 'Rental contract document',
        fileName: 'lease.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_docs');
    });

    it('should suggest "cat_voice" for voice notes', () => {
      const item = {
        title: 'Voice memo',
        description: 'Audio recording',
        fileName: 'note.webm',
        mimeType: 'audio/webm'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_voice');
    });

    it('should suggest "cat_photos" for image files', () => {
      const item = {
        title: 'Evidence photo',
        description: 'Screenshot of conversation',
        fileName: 'screenshot.png',
        mimeType: 'image/png'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_photos');
    });

    it('should suggest "cat_cases" for evidence-related items', () => {
      const item = {
        title: 'Evidence Timeline',
        description: 'Incident documentation with evidence',
        fileName: 'timeline.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_cases');
    });

    it('should handle case-insensitive matching', () => {
      const item = {
        title: 'INVOICE FROM BANK',
        description: 'PAYMENT STATEMENT',
        fileName: 'BILL.PDF',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should return undefined when no keywords match', () => {
      const item = {
        title: 'Random File',
        description: 'Nothing specific here',
        fileName: 'random.txt',
        mimeType: 'text/plain'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
      const item = {
        title: 'Invoice',
        fileName: undefined,
        mimeType: undefined
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should handle empty strings', () => {
      const item = {
        title: '',
        description: '',
        fileName: '',
        mimeType: ''
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBeUndefined();
    });

    it('should choose category with highest score when multiple match', () => {
      // Multiple keywords match multiple categories, highest total score wins
      // "invoice" (bills, 1.2) + "bank" (bills, 1.2) = 2.4 total for cat_bills
      const item = {
        title: 'Bank Invoice',
        description: 'Monthly invoice from bank',
        fileName: 'bank_invoice.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_bills'); // Higher accumulated score
    });

    it('should accumulate score for multiple keyword matches', () => {
      const item = {
        title: 'Invoice',
        description: 'Bank payment bill',
        fileName: 'utility_bill.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should match keywords in any field', () => {
      const itemTitleOnly = {
        title: 'court',
        fileName: undefined,
        mimeType: undefined
      };
      expect(suggestCategory(db, itemTitleOnly)).toBe('cat_legal');

      const itemDescriptionOnly = {
        title: 'Document',
        description: 'court',
        fileName: undefined,
        mimeType: undefined
      };
      expect(suggestCategory(db, itemDescriptionOnly)).toBe('cat_legal');

      const itemFileNameOnly = {
        title: 'File',
        fileName: 'court_order.pdf',
        mimeType: undefined
      };
      expect(suggestCategory(db, itemFileNameOnly)).toBe('cat_legal');
    });
  });

  describe('learnFromApproval', () => {
    it('should create new learning rule when approving item', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Electric Utility Statement',
        fileName: 'electricity_bill.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      learnFromApproval(db, item);

      // Check that localStorage was updated with new rule
      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      expect(rulesRaw).toBeDefined();

      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');
      expect(learnedRule).toBeDefined();
      expect(learnedRule.categoryId).toBe('cat_bills');
      expect(learnedRule.contains).toContain('electric');
      expect(learnedRule.contains).toContain('utility');
    });

    it('should extract tokens of minimum length 4', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'The Big Document',
        fileName: 'doc.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_docs',
        status: 'approved'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      // "the" (3 chars) and "big" (3 chars) should be filtered out
      // "document" (8 chars) should be included
      expect(learnedRule.contains).toContain('document');
      expect(learnedRule.contains).not.toContain('the');
      expect(learnedRule.contains).not.toContain('big');
    });

    it('should limit tokens to 8 per approval', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10',
        fileName: 'file.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_docs',
        status: 'approved'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      expect(learnedRule.contains.length).toBeLessThanOrEqual(8);
    });

    it('should update existing learning rule without duplicates', () => {
      const item1: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Electric Bill Statement',
        fileName: 'electric.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      const item2: PnxItem = {
        id: 'itm_2',
        createdAt: Date.now(),
        title: 'Electric Utility Invoice',
        fileName: 'utility.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      learnFromApproval(db, item1);
      learnFromApproval(db, item2);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');

      // "electric" should only appear once
      const electricCount = learnedRule.contains.filter((t: string) => t === 'electric').length;
      expect(electricCount).toBe(1);
    });

    it('should limit learned rule to 18 keywords total', () => {
      // Approve 3 items with different keywords
      for (let i = 0; i < 3; i++) {
        const item: PnxItem = {
          id: `itm_${i}`,
          createdAt: Date.now(),
          title: `Word${i}A Word${i}B Word${i}C Word${i}D Word${i}E Word${i}F Word${i}G Word${i}H`,
          fileName: 'file.pdf',
          mediaType: 'file',
          approvedCategoryId: 'cat_docs',
          status: 'approved'
        };
        learnFromApproval(db, item);
      }

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      expect(learnedRule.contains.length).toBeLessThanOrEqual(18);
    });

    it('should set weight to 0.6 for learned rules', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Test Document',
        fileName: 'test.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_docs',
        status: 'approved'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      expect(learnedRule.weight).toBe(0.6);
    });

    it('should do nothing when approvedCategoryId is missing', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Test',
        mediaType: 'file',
        status: 'needs_approval'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = rulesRaw ? JSON.parse(rulesRaw) : null;

      // Should only have default rules, no learned rule
      if (rules) {
        const learnedRule = rules.find((r: any) => r.id.startsWith('learn_'));
        expect(learnedRule).toBeUndefined();
      }
    });

    it('should do nothing when no valid tokens can be extracted', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: '...',
        fileName: 'a.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_docs',
        status: 'approved'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = rulesRaw ? JSON.parse(rulesRaw) : null;

      if (rules) {
        const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');
        expect(learnedRule).toBeUndefined();
      }
    });

    it('should convert keywords to lowercase', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'ELECTRIC BILL',
        fileName: 'INVOICE.PDF',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      learnFromApproval(db, item);

      const rulesRaw = localStorage.getItem('pnx_rules_v1');
      const rules = JSON.parse(rulesRaw!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');

      expect(learnedRule.contains).toContain('electric');
      expect(learnedRule.contains).toContain('invoice');
      expect(learnedRule.contains).not.toContain('ELECTRIC');
    });

    it('should improve future suggestions after learning', () => {
      // First approval teaches the system
      const item1: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Comcast Internet Bill',
        fileName: 'comcast.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      learnFromApproval(db, item1);

      // Second item with similar keywords should now be suggested correctly
      const item2 = {
        title: 'Comcast Payment',
        fileName: 'comcast_invoice.pdf',
        mimeType: 'application/pdf'
      };

      const suggested = suggestCategory(db, item2);
      expect(suggested).toBe('cat_bills');
    });
  });

  describe('Integration: suggestCategory + learnFromApproval', () => {
    it('should improve accuracy through learning loop', () => {
      // Initial suggestion might not match perfectly
      const unknownItem = {
        title: 'XYZ Corp Statement',
        fileName: 'xyzcorp.pdf',
        mimeType: 'application/pdf'
      };

      const initialSuggestion = suggestCategory(db, unknownItem);
      // Might be undefined or wrong category initially

      // User approves it as bills
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'XYZ Corp Statement',
        fileName: 'xyzcorp.pdf',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved'
      };

      learnFromApproval(db, approvedItem);

      // Next similar item should be suggested correctly
      const similarItem = {
        title: 'XYZ Corp Invoice',
        fileName: 'xyzcorp_monthly.pdf',
        mimeType: 'application/pdf'
      };

      const learnedSuggestion = suggestCategory(db, similarItem);
      expect(learnedSuggestion).toBe('cat_bills');
    });
  });
});
