import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { suggestCategory, learnFromApproval } from './categorizer';
import { PnxDb, PnxItem } from '@/types/pnx';

describe('categorizer', () => {
  let mockDb: PnxDb;

  beforeEach(() => {
    localStorage.clear();
    mockDb = {
      categories: [
        { id: 'cat_docs', name: 'Documents', color: '#6AA8FF', icon: '📄' },
        { id: 'cat_bills', name: 'Bills', color: '#F4A44D', icon: '💳' },
        { id: 'cat_legal', name: 'Legal', color: '#FF5DA2', icon: '⚖️' },
      ],
      items: [],
      settings: {
        userDisplayName: 'Test User',
        autoSuggestEnabled: true,
      },
    };
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('suggestCategory', () => {
    it('should suggest category based on title keywords', () => {
      const item = {
        title: 'Bank Statement January',
        description: '',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should suggest category based on description keywords', () => {
      const item = {
        title: 'My File',
        description: 'This is a court order from the judge',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_legal');
    });

    it('should suggest category based on fileName keywords', () => {
      const item = {
        title: '',
        description: '',
        fileName: 'contract_signed.pdf',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_docs');
    });

    it('should suggest category based on mimeType keywords', () => {
      const item = {
        title: 'My Document',
        description: '',
        fileName: '',
        mimeType: 'application/pdf',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_docs');
    });

    it('should be case-insensitive', () => {
      const item = {
        title: 'INVOICE FOR PAYMENT',
        description: '',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should return undefined when no keywords match', () => {
      const item = {
        title: 'Random text',
        description: 'Nothing special',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBeUndefined();
    });

    it('should use weighted scoring to choose best category', () => {
      // 'bill' has weight 1.2, 'document' has weight 1.0
      const item = {
        title: 'bill document',
        description: '',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_bills'); // Higher weight wins
    });

    it('should accumulate scores for multiple keyword matches', () => {
      const item = {
        title: 'invoice payment bill utility',
        description: '',
        fileName: '',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should handle undefined/null fields gracefully', () => {
      const item = {
        title: 'invoice',
        description: undefined,
        fileName: undefined,
        mimeType: undefined,
      };
      const suggested = suggestCategory(mockDb, item);
      expect(suggested).toBe('cat_bills');
    });

    it('should combine all text fields for matching', () => {
      const item = {
        title: 'court',
        description: 'custody',
        fileName: 'legal_docs.pdf',
        mimeType: '',
      };
      const suggested = suggestCategory(mockDb, item);
      // All three keywords should boost legal category
      expect(suggested).toBe('cat_legal');
    });
  });

  describe('learnFromApproval', () => {
    it('should create new learned rule when approving item', () => {
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Electricity Bill March',
        description: '',
        mediaType: 'file',
        fileName: 'electricity_march.pdf',
        approvedCategoryId: 'cat_bills',
        status: 'approved',
      };

      learnFromApproval(mockDb, approvedItem);

      const rulesStr = localStorage.getItem('pnx_rules_v1');
      expect(rulesStr).toBeTruthy();
      const rules = JSON.parse(rulesStr!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');

      expect(learnedRule).toBeTruthy();
      expect(learnedRule.categoryId).toBe('cat_bills');
      expect(learnedRule.weight).toBe(0.6);
      expect(learnedRule.contains).toContain('electricity');
      expect(learnedRule.contains).toContain('march');
    });

    it('should extract tokens from both title and fileName', () => {
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Court Document',
        mediaType: 'file',
        fileName: 'custody_order.pdf',
        approvedCategoryId: 'cat_legal',
        status: 'approved',
      };

      learnFromApproval(mockDb, approvedItem);

      const rules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_legal');

      expect(learnedRule.contains).toContain('court');
      expect(learnedRule.contains).toContain('document');
      expect(learnedRule.contains).toContain('custody');
      expect(learnedRule.contains).toContain('order');
    });

    it('should filter out short tokens (< 4 chars)', () => {
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'my doc is ok',
        mediaType: 'file',
        fileName: 'file.pdf',
        approvedCategoryId: 'cat_docs',
        status: 'approved',
      };

      learnFromApproval(mockDb, approvedItem);

      const rules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      // Should not contain 'my', 'doc', 'is', 'ok' (all < 4 chars)
      expect(learnedRule.contains).not.toContain('my');
      expect(learnedRule.contains).not.toContain('is');
      expect(learnedRule.contains).not.toContain('ok');
      // Only 'file' has 4+ chars
      expect(learnedRule.contains).toContain('file');
    });

    it('should limit to first 8 tokens', () => {
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10',
        mediaType: 'file',
        approvedCategoryId: 'cat_docs',
        status: 'approved',
      };

      learnFromApproval(mockDb, approvedItem);

      const rules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      expect(learnedRule.contains.length).toBeLessThanOrEqual(8);
    });

    it('should merge tokens into existing learned rule', () => {
      // First approval
      const item1: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Electricity Bill',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved',
      };
      learnFromApproval(mockDb, item1);

      // Second approval for same category
      const item2: PnxItem = {
        id: 'itm_2',
        createdAt: Date.now(),
        title: 'Water Invoice',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved',
      };
      learnFromApproval(mockDb, item2);

      const rules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');

      expect(learnedRule.contains).toContain('electricity');
      expect(learnedRule.contains).toContain('bill');
      expect(learnedRule.contains).toContain('water');
      expect(learnedRule.contains).toContain('invoice');
    });

    it('should limit merged rule to 18 tokens max', () => {
      // Create initial rule with many tokens
      const rules = [
        {
          id: 'learn_cat_bills',
          contains: Array(15).fill(0).map((_, i) => `token${i}`),
          categoryId: 'cat_bills',
          weight: 0.6,
        },
      ];
      localStorage.setItem('pnx_rules_v1', JSON.stringify(rules));

      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'newtoken1 newtoken2 newtoken3 newtoken4 newtoken5',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved',
      };

      learnFromApproval(mockDb, approvedItem);

      const updatedRules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = updatedRules.find((r: any) => r.id === 'learn_cat_bills');

      expect(learnedRule.contains.length).toBeLessThanOrEqual(18);
    });

    it('should not learn if no approved category', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Some Document',
        mediaType: 'file',
        approvedCategoryId: undefined,
        status: 'needs_approval',
      };

      learnFromApproval(mockDb, item);

      const rulesStr = localStorage.getItem('pnx_rules_v1');
      if (rulesStr) {
        const rules = JSON.parse(rulesStr);
        const learnedRule = rules.find((r: any) => r.id.startsWith('learn_'));
        expect(learnedRule).toBeUndefined();
      }
      // If no rules exist at all, that's also correct (no learning happened)
    });

    it('should handle empty title and fileName', () => {
      const item: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: '',
        mediaType: 'file',
        fileName: '',
        approvedCategoryId: 'cat_docs',
        status: 'approved',
      };

      learnFromApproval(mockDb, item);

      const rules = JSON.parse(localStorage.getItem('pnx_rules_v1')!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_docs');

      // Should not create a rule with no tokens
      expect(learnedRule).toBeUndefined();
    });

    it('should improve suggestions after learning', () => {
      // Initially, 'electricity' might not suggest cat_bills strongly
      const testItem = {
        title: 'electricity',
        description: '',
        fileName: '',
        mimeType: '',
      };

      // Learn from approval
      const approvedItem: PnxItem = {
        id: 'itm_1',
        createdAt: Date.now(),
        title: 'Electricity Bill March',
        mediaType: 'file',
        approvedCategoryId: 'cat_bills',
        status: 'approved',
      };
      learnFromApproval(mockDb, approvedItem);

      // Now test if suggestion improves
      const suggested = suggestCategory(mockDb, testItem);
      expect(suggested).toBe('cat_bills');
    });
  });
});
