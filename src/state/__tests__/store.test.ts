import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '../store';
import type { PnxItem, PnxMediaType } from '@/types/pnx';

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

describe('Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Force reload fresh state
    store.snapshot;
  });

  describe('Settings Management', () => {
    it('should update user display name', () => {
      store.setUserName('John Doe');
      expect(store.snapshot.settings.userDisplayName).toBe('John Doe');
    });

    it('should toggle auto suggest setting', () => {
      const initial = store.snapshot.settings.autoSuggestEnabled;
      store.toggleAutoSuggest(!initial);
      expect(store.snapshot.settings.autoSuggestEnabled).toBe(!initial);

      store.toggleAutoSuggest(initial);
      expect(store.snapshot.settings.autoSuggestEnabled).toBe(initial);
    });

    it('should persist settings to localStorage', () => {
      store.setUserName('Jane Smith');

      const saved = localStorage.getItem('pnx_db_v1');
      expect(saved).toBeDefined();
      const db = JSON.parse(saved!);
      expect(db.settings.userDisplayName).toBe('Jane Smith');
    });
  });

  describe('Category Management', () => {
    it('should add a new category', () => {
      const initialCount = store.snapshot.categories.length;

      store.addCategory({
        name: 'Medical',
        color: '#FF6B6B',
        icon: '🏥'
      });

      const newCount = store.snapshot.categories.length;
      expect(newCount).toBe(initialCount + 1);

      const medical = store.snapshot.categories[0]; // Unshift adds to front
      expect(medical.name).toBe('Medical');
      expect(medical.color).toBe('#FF6B6B');
      expect(medical.icon).toBe('🏥');
      expect(medical.id).toMatch(/^cat_/);
    });

    it('should remove a category', () => {
      const categoryToRemove = store.snapshot.categories[0];
      const initialCount = store.snapshot.categories.length;

      store.removeCategory(categoryToRemove.id);

      expect(store.snapshot.categories.length).toBe(initialCount - 1);
      expect(store.snapshot.categories.find(c => c.id === categoryToRemove.id)).toBeUndefined();
    });

    it('should unassign items when removing category', () => {
      // Add an item with approved category
      const item = store.addItem({
        title: 'Test Item',
        mediaType: 'file' as PnxMediaType,
      });

      const categoryId = store.snapshot.categories[0].id;
      store.approveItem(item.id, categoryId);

      // Verify item is approved
      let updatedItem = store.snapshot.items.find(i => i.id === item.id);
      expect(updatedItem?.approvedCategoryId).toBe(categoryId);
      expect(updatedItem?.status).toBe('approved');

      // Remove the category
      store.removeCategory(categoryId);

      // Item should be unassigned and need approval
      updatedItem = store.snapshot.items.find(i => i.id === item.id);
      expect(updatedItem?.approvedCategoryId).toBeUndefined();
      expect(updatedItem?.status).toBe('needs_approval');
    });

    it('should unassign suggested category when removing category', () => {
      const item: PnxItem = {
        id: 'itm_test',
        createdAt: Date.now(),
        title: 'Test',
        mediaType: 'file',
        suggestedCategoryId: store.snapshot.categories[0].id,
        status: 'needs_approval'
      };

      // Manually add item to test suggestion removal
      store.snapshot.items.unshift(item);

      const categoryId = item.suggestedCategoryId!;
      store.removeCategory(categoryId);

      const updatedItem = store.snapshot.items.find(i => i.id === item.id);
      expect(updatedItem?.suggestedCategoryId).toBeUndefined();
    });

    it('should get category by id', () => {
      const existingCategory = store.snapshot.categories[0];
      const retrieved = store.getCategory(existingCategory.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(existingCategory.id);
      expect(retrieved?.name).toBe(existingCategory.name);
    });

    it('should return undefined for non-existent category', () => {
      const retrieved = store.getCategory('non_existent_id');
      expect(retrieved).toBeUndefined();
    });

    it('should return undefined when getting category with undefined id', () => {
      const retrieved = store.getCategory(undefined);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Item Management', () => {
    it('should add a new item', () => {
      const initialCount = store.snapshot.items.length;

      const item = store.addItem({
        title: 'Test Document',
        description: 'A test file',
        mediaType: 'file' as PnxMediaType,
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        localUrl: 'blob:xxx'
      });

      expect(store.snapshot.items.length).toBe(initialCount + 1);
      expect(item.id).toMatch(/^itm_/);
      expect(item.title).toBe('Test Document');
      expect(item.description).toBe('A test file');
      expect(item.mediaType).toBe('file');
      expect(item.fileName).toBe('test.pdf');
      expect(item.status).toBe('needs_approval');
    });

    it('should add item with auto-suggest enabled', () => {
      store.toggleAutoSuggest(true);

      const item = store.addItem({
        title: 'Bank Invoice',
        mediaType: 'file' as PnxMediaType,
        fileName: 'invoice.pdf'
      });

      // Should have a suggestion (based on "invoice" and "bank" keywords)
      expect(item.suggestedCategoryId).toBeDefined();
    });

    it('should not suggest category when auto-suggest is disabled', () => {
      store.toggleAutoSuggest(false);

      const item = store.addItem({
        title: 'Bank Invoice',
        mediaType: 'file' as PnxMediaType,
        fileName: 'invoice.pdf'
      });

      expect(item.suggestedCategoryId).toBeUndefined();
    });

    it('should approve an item', () => {
      const item = store.addItem({
        title: 'Test',
        mediaType: 'file' as PnxMediaType
      });

      const categoryId = store.snapshot.categories[0].id;
      store.approveItem(item.id, categoryId);

      const approved = store.snapshot.items.find(i => i.id === item.id);
      expect(approved?.approvedCategoryId).toBe(categoryId);
      expect(approved?.status).toBe('approved');
    });

    it('should do nothing when approving non-existent item', () => {
      const categoryId = store.snapshot.categories[0].id;
      const initialItems = [...store.snapshot.items];

      store.approveItem('non_existent_id', categoryId);

      expect(store.snapshot.items).toEqual(initialItems);
    });

    it('should reject a suggestion', () => {
      store.toggleAutoSuggest(true);

      const item = store.addItem({
        title: 'Bank Statement',
        mediaType: 'file' as PnxMediaType
      });

      expect(item.suggestedCategoryId).toBeDefined();

      store.rejectSuggestion(item.id);

      const rejected = store.snapshot.items.find(i => i.id === item.id);
      expect(rejected?.suggestedCategoryId).toBeUndefined();
      expect(rejected?.status).toBe('needs_approval');
    });

    it('should do nothing when rejecting suggestion for non-existent item', () => {
      const initialItems = [...store.snapshot.items];

      store.rejectSuggestion('non_existent_id');

      expect(store.snapshot.items).toEqual(initialItems);
    });

    it('should update an item', () => {
      const item = store.addItem({
        title: 'Original Title',
        mediaType: 'file' as PnxMediaType
      });

      store.updateItem(item.id, {
        title: 'Updated Title',
        description: 'New description',
        tags: ['tag1', 'tag2']
      });

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.description).toBe('New description');
      expect(updated?.tags).toEqual(['tag1', 'tag2']);
    });

    it('should preserve unchanged fields when updating', () => {
      const item = store.addItem({
        title: 'Test',
        description: 'Original description',
        mediaType: 'file' as PnxMediaType,
        fileName: 'test.pdf'
      });

      store.updateItem(item.id, {
        title: 'Updated Title'
      });

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.description).toBe('Original description');
      expect(updated?.fileName).toBe('test.pdf');
    });

    it('should do nothing when updating non-existent item', () => {
      const initialItems = [...store.snapshot.items];

      store.updateItem('non_existent_id', {
        title: 'Updated'
      });

      expect(store.snapshot.items).toEqual(initialItems);
    });

    it('should add items to the front of the list (unshift)', () => {
      const item1 = store.addItem({
        title: 'First',
        mediaType: 'file' as PnxMediaType
      });

      const item2 = store.addItem({
        title: 'Second',
        mediaType: 'file' as PnxMediaType
      });

      // Most recent item should be first
      expect(store.snapshot.items[0].id).toBe(item2.id);
      expect(store.snapshot.items[1].id).toBe(item1.id);
    });
  });

  describe('Subscription and Events', () => {
    it('should notify subscribers on changes', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.setUserName('Test User');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should not notify after unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();

      store.setUserName('Test User');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = store.subscribe(listener1);
      const unsub2 = store.subscribe(listener2);

      store.setUserName('Test');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      unsub1();
      unsub2();
    });

    it('should only notify remaining subscribers after one unsubscribes', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = store.subscribe(listener1);
      const unsub2 = store.subscribe(listener2);

      unsub1();

      listener1.mockClear();
      listener2.mockClear();

      store.setUserName('Test');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      unsub2();
    });
  });

  describe('Persistence', () => {
    it('should persist changes to localStorage', () => {
      store.addCategory({
        name: 'Test Category',
        color: '#123456',
        icon: '🧪'
      });

      const saved = localStorage.getItem('pnx_db_v1');
      expect(saved).toBeDefined();

      const db = JSON.parse(saved!);
      expect(db.categories[0].name).toBe('Test Category');
    });

    it('should persist all store operations', () => {
      const operations = [
        () => store.setUserName('Persistence Test'),
        () => store.toggleAutoSuggest(false),
        () => store.addCategory({ name: 'Cat', color: '#000', icon: '📁' }),
        () => store.addItem({ title: 'Item', mediaType: 'file' as PnxMediaType })
      ];

      operations.forEach(op => {
        op();
        const saved = localStorage.getItem('pnx_db_v1');
        expect(saved).toBeDefined();
      });
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should support complete item lifecycle', () => {
      // Enable auto-suggest
      store.toggleAutoSuggest(true);

      // Add item
      const item = store.addItem({
        title: 'Bank Statement PDF',
        description: 'Monthly bank statement',
        mediaType: 'file' as PnxMediaType,
        fileName: 'statement.pdf',
        mimeType: 'application/pdf'
      });

      // Should have suggestion
      expect(item.suggestedCategoryId).toBeDefined();

      // Approve with suggested category
      store.approveItem(item.id, item.suggestedCategoryId!);

      // Verify approved
      let currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.status).toBe('approved');
      expect(currentItem?.approvedCategoryId).toBe(item.suggestedCategoryId);

      // Update metadata
      store.updateItem(item.id, {
        tags: ['finance', 'important']
      });

      currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.tags).toEqual(['finance', 'important']);
    });

    it('should support suggestion rejection and manual approval', () => {
      store.toggleAutoSuggest(true);

      const item = store.addItem({
        title: 'Invoice',
        mediaType: 'file' as PnxMediaType
      });

      const suggestedId = item.suggestedCategoryId;
      expect(suggestedId).toBeDefined();

      // Reject suggestion
      store.rejectSuggestion(item.id);

      let currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.suggestedCategoryId).toBeUndefined();

      // Manually approve with different category
      const differentCategory = store.snapshot.categories.find(c => c.id !== suggestedId)!;
      store.approveItem(item.id, differentCategory.id);

      currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.approvedCategoryId).toBe(differentCategory.id);
      expect(currentItem?.status).toBe('approved');
    });

    it('should handle category removal with reassignment', () => {
      // Create custom category
      store.addCategory({
        name: 'Temporary',
        color: '#FF0000',
        icon: '⏳'
      });

      const tempCategory = store.snapshot.categories[0];

      // Add and approve item with this category
      const item = store.addItem({
        title: 'Temp Item',
        mediaType: 'file' as PnxMediaType
      });

      store.approveItem(item.id, tempCategory.id);

      // Verify approved
      let currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.approvedCategoryId).toBe(tempCategory.id);

      // Remove category
      store.removeCategory(tempCategory.id);

      // Item should need approval again
      currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.approvedCategoryId).toBeUndefined();
      expect(currentItem?.status).toBe('needs_approval');

      // Re-approve with different category
      const newCategory = store.snapshot.categories[0];
      store.approveItem(item.id, newCategory.id);

      currentItem = store.snapshot.items.find(i => i.id === item.id);
      expect(currentItem?.approvedCategoryId).toBe(newCategory.id);
      expect(currentItem?.status).toBe('approved');
    });
  });
});
