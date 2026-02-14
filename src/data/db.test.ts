import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadDb, saveDb, defaultDb, uid, now } from './db';

describe('db', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('now', () => {
    it('should return current timestamp', () => {
      const before = Date.now();
      const result = now();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('uid', () => {
    it('should generate unique IDs with default prefix', () => {
      const id1 = uid();
      const id2 = uid();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^pnx_/);
    });

    it('should generate unique IDs with custom prefix', () => {
      const id1 = uid('cat');
      const id2 = uid('cat');

      expect(id1).toMatch(/^cat_/);
      expect(id2).toMatch(/^cat_/);
      expect(id1).not.toBe(id2);
    });

    it('should include random and timestamp components', () => {
      const id = uid('test');
      const parts = id.split('_');

      expect(parts.length).toBe(3); // prefix_random_timestamp
      expect(parts[0]).toBe('test');
      expect(parts[1].length).toBeGreaterThan(0); // random part
      expect(parts[2].length).toBeGreaterThan(0); // timestamp part
    });

    it('should generate different IDs in quick succession', () => {
      const ids = Array.from({ length: 100 }, () => uid('test'));
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });
  });

  describe('defaultDb', () => {
    it('should return a valid database structure', () => {
      const db = defaultDb();

      expect(db).toHaveProperty('categories');
      expect(db).toHaveProperty('items');
      expect(db).toHaveProperty('settings');
    });

    it('should include default categories', () => {
      const db = defaultDb();

      expect(db.categories).toBeDefined();
      expect(db.categories.length).toBeGreaterThan(0);

      const categoryIds = db.categories.map(c => c.id);
      expect(categoryIds).toContain('cat_docs');
      expect(categoryIds).toContain('cat_bills');
      expect(categoryIds).toContain('cat_legal');
      expect(categoryIds).toContain('cat_photos');
      expect(categoryIds).toContain('cat_voice');
      expect(categoryIds).toContain('cat_cases');
    });

    it('should have valid category structure', () => {
      const db = defaultDb();
      const category = db.categories[0];

      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('color');
      expect(category).toHaveProperty('icon');

      expect(typeof category.id).toBe('string');
      expect(typeof category.name).toBe('string');
      expect(typeof category.color).toBe('string');
      expect(typeof category.icon).toBe('string');
      expect(category.color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should include demo items', () => {
      const db = defaultDb();

      expect(db.items).toBeDefined();
      expect(db.items.length).toBeGreaterThan(0);

      const demoItem = db.items[0];
      expect(demoItem).toHaveProperty('id');
      expect(demoItem).toHaveProperty('createdAt');
      expect(demoItem).toHaveProperty('title');
      expect(demoItem).toHaveProperty('mediaType');
      expect(demoItem).toHaveProperty('status');
    });

    it('should have valid item structure', () => {
      const db = defaultDb();
      const item = db.items.find(i => i.status === 'approved');

      expect(item).toBeDefined();
      expect(item!.id).toBeTruthy();
      expect(typeof item!.createdAt).toBe('number');
      expect(typeof item!.title).toBe('string');
      expect(['photo', 'video', 'audio', 'file']).toContain(item!.mediaType);
      expect(['needs_approval', 'approved']).toContain(item!.status);
    });

    it('should include default settings', () => {
      const db = defaultDb();

      expect(db.settings).toBeDefined();
      expect(db.settings).toHaveProperty('userDisplayName');
      expect(db.settings).toHaveProperty('autoSuggestEnabled');

      expect(typeof db.settings.userDisplayName).toBe('string');
      expect(typeof db.settings.autoSuggestEnabled).toBe('boolean');
    });

    it('should return a new object each time', () => {
      const db1 = defaultDb();
      const db2 = defaultDb();

      expect(db1).not.toBe(db2);
      db1.categories.push({ id: 'test', name: 'Test', color: '#000000', icon: '🧪' });
      expect(db2.categories.length).not.toBe(db1.categories.length);
    });
  });

  describe('loadDb', () => {
    it('should return default db when localStorage is empty', () => {
      const db = loadDb();

      expect(db.categories.length).toBeGreaterThan(0);
      expect(db.items.length).toBeGreaterThan(0);
      expect(db.settings.userDisplayName).toBeTruthy();
    });

    it('should save default db to localStorage when empty', () => {
      loadDb();

      const stored = localStorage.getItem('pnx_db_v1');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.categories).toBeDefined();
      expect(parsed.items).toBeDefined();
      expect(parsed.settings).toBeDefined();
    });

    it('should load existing db from localStorage', () => {
      const customDb = {
        categories: [{ id: 'cat_custom', name: 'Custom', color: '#FF0000', icon: '🔥' }],
        items: [],
        settings: { userDisplayName: 'Test User', autoSuggestEnabled: false },
      };

      localStorage.setItem('pnx_db_v1', JSON.stringify(customDb));

      const loaded = loadDb();

      expect(loaded.categories.length).toBe(1);
      expect(loaded.categories[0].id).toBe('cat_custom');
      expect(loaded.settings.userDisplayName).toBe('Test User');
      expect(loaded.settings.autoSuggestEnabled).toBe(false);
    });

    it('should return default db when localStorage data is corrupted', () => {
      localStorage.setItem('pnx_db_v1', 'invalid json {{{');

      const db = loadDb();

      expect(db.categories.length).toBeGreaterThan(0);
      expect(db.items.length).toBeGreaterThan(0);
    });

    it('should save default db when recovering from corruption', () => {
      localStorage.setItem('pnx_db_v1', 'corrupted');

      loadDb();

      const stored = localStorage.getItem('pnx_db_v1');
      expect(() => JSON.parse(stored!)).not.toThrow();

      const parsed = JSON.parse(stored!);
      expect(parsed.categories).toBeDefined();
    });

    it('should handle localStorage access errors gracefully', () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage access denied');
      });

      const db = loadDb();

      expect(db).toBeDefined();
      expect(db.categories.length).toBeGreaterThan(0);

      // Restore
      localStorage.getItem = originalGetItem;
    });

    it('should preserve all db structure from localStorage', () => {
      const customDb = {
        categories: [
          { id: 'cat_1', name: 'Cat 1', color: '#111111', icon: '1️⃣' },
          { id: 'cat_2', name: 'Cat 2', color: '#222222', icon: '2️⃣' },
        ],
        items: [
          {
            id: 'itm_1',
            createdAt: 1234567890,
            title: 'Test Item',
            mediaType: 'file' as const,
            status: 'approved' as const,
            approvedCategoryId: 'cat_1',
            tags: ['tag1', 'tag2'],
          },
        ],
        settings: {
          userDisplayName: 'Custom User',
          autoSuggestEnabled: true,
        },
      };

      localStorage.setItem('pnx_db_v1', JSON.stringify(customDb));

      const loaded = loadDb();

      expect(loaded).toEqual(customDb);
    });
  });

  describe('saveDb', () => {
    it('should save db to localStorage', () => {
      const db = {
        categories: [{ id: 'cat_test', name: 'Test', color: '#00FF00', icon: '✅' }],
        items: [],
        settings: { userDisplayName: 'Save Test', autoSuggestEnabled: true },
      };

      saveDb(db);

      const stored = localStorage.getItem('pnx_db_v1');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.categories[0].id).toBe('cat_test');
      expect(parsed.settings.userDisplayName).toBe('Save Test');
    });

    it('should overwrite existing data', () => {
      const db1 = {
        categories: [{ id: 'cat_1', name: 'First', color: '#111111', icon: '1️⃣' }],
        items: [],
        settings: { userDisplayName: 'User 1', autoSuggestEnabled: true },
      };

      saveDb(db1);

      const db2 = {
        categories: [{ id: 'cat_2', name: 'Second', color: '#222222', icon: '2️⃣' }],
        items: [],
        settings: { userDisplayName: 'User 2', autoSuggestEnabled: false },
      };

      saveDb(db2);

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.categories[0].id).toBe('cat_2');
      expect(parsed.settings.userDisplayName).toBe('User 2');
    });

    it('should preserve complex nested structures', () => {
      const db = {
        categories: Array.from({ length: 5 }, (_, i) => ({
          id: `cat_${i}`,
          name: `Category ${i}`,
          color: `#${i}${i}${i}${i}${i}${i}`,
          icon: '📁',
        })),
        items: [
          {
            id: 'itm_complex',
            createdAt: Date.now(),
            title: 'Complex Item',
            description: 'With description',
            mediaType: 'file' as const,
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 12345,
            localUrl: 'blob:http://test',
            suggestedCategoryId: 'cat_1',
            approvedCategoryId: 'cat_2',
            status: 'approved' as const,
            tags: ['tag1', 'tag2', 'tag3'],
          },
        ],
        settings: {
          userDisplayName: 'Complex User',
          autoSuggestEnabled: true,
        },
      };

      saveDb(db);

      const loaded = loadDb();

      expect(loaded).toEqual(db);
    });

    it('should handle empty arrays and objects', () => {
      const db = {
        categories: [],
        items: [],
        settings: { userDisplayName: '', autoSuggestEnabled: false },
      };

      saveDb(db);

      const loaded = loadDb();

      expect(loaded.categories).toEqual([]);
      expect(loaded.items).toEqual([]);
      expect(loaded.settings.userDisplayName).toBe('');
    });
  });

  describe('integration: load and save cycle', () => {
    it('should maintain data integrity through save/load cycle', () => {
      const original = defaultDb();
      original.settings.userDisplayName = 'Integration Test User';
      original.categories.push({
        id: 'cat_new',
        name: 'New Category',
        color: '#ABCDEF',
        icon: '🆕',
      });

      saveDb(original);
      const loaded = loadDb();

      expect(loaded).toEqual(original);
    });

    it('should handle multiple save/load cycles', () => {
      let db = defaultDb();

      for (let i = 0; i < 10; i++) {
        db.settings.userDisplayName = `User ${i}`;
        saveDb(db);
        db = loadDb();
        expect(db.settings.userDisplayName).toBe(`User ${i}`);
      }
    });
  });
});
