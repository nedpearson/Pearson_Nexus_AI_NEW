import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { store } from './store';
import { PnxDb, PnxItem } from '@/types/pnx';

describe('Store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('snapshot', () => {
    it('should return current database state', () => {
      const snapshot = store.snapshot;

      expect(snapshot).toBeDefined();
      expect(snapshot).toHaveProperty('categories');
      expect(snapshot).toHaveProperty('items');
      expect(snapshot).toHaveProperty('settings');
    });

    it('should reflect updates to the store', () => {
      const before = store.snapshot.settings.userDisplayName;
      store.setUserName('New Name');
      const after = store.snapshot.settings.userDisplayName;

      expect(after).toBe('New Name');
      expect(after).not.toBe(before);
    });
  });

  describe('subscribe', () => {
    it('should call listener when store changes', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.setUserName('Test User');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should call multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.setUserName('Test');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.setUserName('Before Unsubscribe');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.setUserName('After Unsubscribe');
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should allow multiple subscriptions and unsubscriptions', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = store.subscribe(listener1);
      const unsub2 = store.subscribe(listener2);

      store.setUserName('First Change');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsub1();

      store.setUserName('Second Change');
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
    });
  });

  describe('setUserName', () => {
    it('should update user display name', () => {
      store.setUserName('John Doe');

      expect(store.snapshot.settings.userDisplayName).toBe('John Doe');
    });

    it('should persist to localStorage', () => {
      store.setUserName('Jane Smith');

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.settings.userDisplayName).toBe('Jane Smith');
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.setUserName('Listener Test');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('toggleAutoSuggest', () => {
    it('should enable auto-suggest', () => {
      store.toggleAutoSuggest(true);

      expect(store.snapshot.settings.autoSuggestEnabled).toBe(true);
    });

    it('should disable auto-suggest', () => {
      store.toggleAutoSuggest(false);

      expect(store.snapshot.settings.autoSuggestEnabled).toBe(false);
    });

    it('should persist to localStorage', () => {
      store.toggleAutoSuggest(false);

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.settings.autoSuggestEnabled).toBe(false);
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.toggleAutoSuggest(false);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('addCategory', () => {
    it('should add new category to the store', () => {
      const initialCount = store.snapshot.categories.length;

      store.addCategory({
        name: 'Test Category',
        color: '#FF0000',
        icon: '🧪',
      });

      expect(store.snapshot.categories.length).toBe(initialCount + 1);
      const newCategory = store.snapshot.categories[0]; // unshift adds to front
      expect(newCategory.name).toBe('Test Category');
      expect(newCategory.color).toBe('#FF0000');
      expect(newCategory.icon).toBe('🧪');
    });

    it('should generate unique ID with cat prefix', () => {
      store.addCategory({ name: 'Cat 1', color: '#111111', icon: '1️⃣' });

      const category = store.snapshot.categories[0];
      expect(category.id).toMatch(/^cat_/);
    });

    it('should add category to beginning of list', () => {
      const firstId = store.snapshot.categories[0].id;

      store.addCategory({ name: 'New', color: '#000000', icon: '🆕' });

      const newFirstId = store.snapshot.categories[0].id;
      expect(newFirstId).not.toBe(firstId);
      expect(store.snapshot.categories[0].name).toBe('New');
    });

    it('should persist to localStorage', () => {
      store.addCategory({ name: 'Persisted', color: '#ABCDEF', icon: '💾' });

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.categories[0].name).toBe('Persisted');
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.addCategory({ name: 'Test', color: '#000000', icon: '🧪' });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('removeCategory', () => {
    it('should remove category from store', () => {
      const categoryId = store.snapshot.categories[0].id;
      const initialCount = store.snapshot.categories.length;

      store.removeCategory(categoryId);

      expect(store.snapshot.categories.length).toBe(initialCount - 1);
      expect(store.snapshot.categories.find(c => c.id === categoryId)).toBeUndefined();
    });

    it('should unassign items with approved category', () => {
      const categoryId = 'cat_bills';

      // Find or create item with this category
      const billsItem = store.snapshot.items.find(i => i.approvedCategoryId === categoryId);

      if (billsItem) {
        store.removeCategory(categoryId);

        const updatedItem = store.snapshot.items.find(i => i.id === billsItem.id);
        expect(updatedItem!.approvedCategoryId).toBeUndefined();
        expect(updatedItem!.status).toBe('needs_approval');
      }
    });

    it('should unassign items with suggested category', () => {
      // Add an item with suggested category
      const categoryId = store.snapshot.categories[0].id;
      const item = store.addItem({
        title: 'Test Item',
        mediaType: 'file',
      });

      // Manually set suggested category
      store.updateItem(item.id, { suggestedCategoryId: categoryId });

      store.removeCategory(categoryId);

      const updatedItem = store.snapshot.items.find(i => i.id === item.id);
      expect(updatedItem!.suggestedCategoryId).toBeUndefined();
      expect(updatedItem!.status).toBe('needs_approval');
    });

    it('should persist to localStorage', () => {
      const categoryId = store.snapshot.categories[0].id;

      store.removeCategory(categoryId);

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.categories.find((c: any) => c.id === categoryId)).toBeUndefined();
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      const categoryId = store.snapshot.categories[0].id;
      store.removeCategory(categoryId);

      expect(listener).toHaveBeenCalled();
    });

    it('should handle removing non-existent category gracefully', () => {
      const initialCount = store.snapshot.categories.length;

      store.removeCategory('non_existent_id');

      expect(store.snapshot.categories.length).toBe(initialCount);
    });
  });

  describe('addItem', () => {
    it('should add new item to store', () => {
      const initialCount = store.snapshot.items.length;

      const item = store.addItem({
        title: 'Test Document',
        description: 'Test description',
        mediaType: 'file',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      expect(store.snapshot.items.length).toBe(initialCount + 1);
      expect(item.title).toBe('Test Document');
      expect(item.description).toBe('Test description');
      expect(item.fileName).toBe('test.pdf');
    });

    it('should generate unique ID with itm prefix', () => {
      const item = store.addItem({
        title: 'Test',
        mediaType: 'file',
      });

      expect(item.id).toMatch(/^itm_/);
    });

    it('should set createdAt timestamp', () => {
      const before = Date.now();
      const item = store.addItem({
        title: 'Test',
        mediaType: 'photo',
      });
      const after = Date.now();

      expect(item.createdAt).toBeGreaterThanOrEqual(before);
      expect(item.createdAt).toBeLessThanOrEqual(after);
    });

    it('should set status to needs_approval', () => {
      const item = store.addItem({
        title: 'Test',
        mediaType: 'audio',
      });

      expect(item.status).toBe('needs_approval');
    });

    it('should add item to beginning of list', () => {
      const item = store.addItem({
        title: 'First Item',
        mediaType: 'video',
      });

      expect(store.snapshot.items[0].id).toBe(item.id);
    });

    it('should auto-suggest category when enabled', () => {
      store.toggleAutoSuggest(true);

      const item = store.addItem({
        title: 'Bank Statement Invoice',
        mediaType: 'file',
      });

      expect(item.suggestedCategoryId).toBeDefined();
      expect(item.suggestedCategoryId).toBe('cat_bills');
    });

    it('should not suggest category when auto-suggest disabled', () => {
      store.toggleAutoSuggest(false);

      const item = store.addItem({
        title: 'Bank Statement Invoice',
        mediaType: 'file',
      });

      expect(item.suggestedCategoryId).toBeUndefined();
    });

    it('should persist to localStorage', () => {
      const item = store.addItem({
        title: 'Persisted Item',
        mediaType: 'file',
      });

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);

      expect(parsed.items[0].id).toBe(item.id);
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.addItem({ title: 'Test', mediaType: 'file' });

      expect(listener).toHaveBeenCalled();
    });

    it('should return the created item', () => {
      const item = store.addItem({
        title: 'Return Test',
        mediaType: 'file',
      });

      expect(item).toBeDefined();
      expect(item.id).toBeTruthy();
      expect(item.title).toBe('Return Test');
    });

    it('should handle all media types', () => {
      const types: Array<'photo' | 'video' | 'audio' | 'file'> = ['photo', 'video', 'audio', 'file'];

      for (const mediaType of types) {
        const item = store.addItem({ title: `${mediaType} item`, mediaType });
        expect(item.mediaType).toBe(mediaType);
      }
    });
  });

  describe('approveItem', () => {
    it('should approve item with category', () => {
      const item = store.addItem({ title: 'Test', mediaType: 'file' });
      const categoryId = store.snapshot.categories[0].id;

      store.approveItem(item.id, categoryId);

      const approved = store.snapshot.items.find(i => i.id === item.id);
      expect(approved!.approvedCategoryId).toBe(categoryId);
      expect(approved!.status).toBe('approved');
    });

    it('should trigger learning from approval', () => {
      // Clear any existing rules
      localStorage.removeItem('pnx_rules_v1');

      const item = store.addItem({
        title: 'Electricity Bill Payment',
        mediaType: 'file',
      });

      store.approveItem(item.id, 'cat_bills');

      // Check that learning occurred
      const rulesStr = localStorage.getItem('pnx_rules_v1');
      expect(rulesStr).toBeTruthy();

      const rules = JSON.parse(rulesStr!);
      const learnedRule = rules.find((r: any) => r.id === 'learn_cat_bills');

      expect(learnedRule).toBeDefined();
      expect(learnedRule.contains).toContain('electricity');
    });

    it('should persist to localStorage', () => {
      const item = store.addItem({ title: 'Test', mediaType: 'file' });
      const categoryId = store.snapshot.categories[0].id;

      store.approveItem(item.id, categoryId);

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);
      const storedItem = parsed.items.find((i: any) => i.id === item.id);

      expect(storedItem.status).toBe('approved');
      expect(storedItem.approvedCategoryId).toBe(categoryId);
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      const item = store.addItem({ title: 'Test', mediaType: 'file' });
      listener.mockClear(); // Clear the call from addItem

      store.approveItem(item.id, store.snapshot.categories[0].id);

      expect(listener).toHaveBeenCalled();
    });

    it('should handle non-existent item gracefully', () => {
      const initialItems = store.snapshot.items.length;

      store.approveItem('non_existent', 'cat_docs');

      expect(store.snapshot.items.length).toBe(initialItems);
    });
  });

  describe('rejectSuggestion', () => {
    it('should clear suggested category', () => {
      store.toggleAutoSuggest(true);
      const item = store.addItem({
        title: 'Invoice Payment Bill',
        mediaType: 'file',
      });

      expect(item.suggestedCategoryId).toBeDefined();

      store.rejectSuggestion(item.id);

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated!.suggestedCategoryId).toBeUndefined();
    });

    it('should set status to needs_approval', () => {
      store.toggleAutoSuggest(true);
      const item = store.addItem({
        title: 'Invoice',
        mediaType: 'file',
      });

      store.rejectSuggestion(item.id);

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated!.status).toBe('needs_approval');
    });

    it('should persist to localStorage', () => {
      store.toggleAutoSuggest(true);
      const item = store.addItem({ title: 'Bill', mediaType: 'file' });

      store.rejectSuggestion(item.id);

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);
      const storedItem = parsed.items.find((i: any) => i.id === item.id);

      expect(storedItem.suggestedCategoryId).toBeUndefined();
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.toggleAutoSuggest(true);
      const item = store.addItem({ title: 'Bill', mediaType: 'file' });
      listener.mockClear();

      store.rejectSuggestion(item.id);

      expect(listener).toHaveBeenCalled();
    });

    it('should handle non-existent item gracefully', () => {
      const initialItems = store.snapshot.items.length;

      store.rejectSuggestion('non_existent');

      expect(store.snapshot.items.length).toBe(initialItems);
    });
  });

  describe('updateItem', () => {
    it('should update item properties', () => {
      const item = store.addItem({ title: 'Original', mediaType: 'file' });

      store.updateItem(item.id, {
        title: 'Updated',
        description: 'New description',
      });

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated!.title).toBe('Updated');
      expect(updated!.description).toBe('New description');
    });

    it('should allow partial updates', () => {
      const item = store.addItem({
        title: 'Test',
        description: 'Original description',
        mediaType: 'file',
      });

      store.updateItem(item.id, { title: 'New Title' });

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated!.title).toBe('New Title');
      expect(updated!.description).toBe('Original description'); // Unchanged
    });

    it('should update tags', () => {
      const item = store.addItem({ title: 'Test', mediaType: 'file' });

      store.updateItem(item.id, { tags: ['tag1', 'tag2', 'tag3'] });

      const updated = store.snapshot.items.find(i => i.id === item.id);
      expect(updated!.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should persist to localStorage', () => {
      const item = store.addItem({ title: 'Original', mediaType: 'file' });

      store.updateItem(item.id, { title: 'Updated' });

      const stored = localStorage.getItem('pnx_db_v1');
      const parsed = JSON.parse(stored!);
      const storedItem = parsed.items.find((i: any) => i.id === item.id);

      expect(storedItem.title).toBe('Updated');
    });

    it('should trigger listeners', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      const item = store.addItem({ title: 'Test', mediaType: 'file' });
      listener.mockClear();

      store.updateItem(item.id, { title: 'Updated' });

      expect(listener).toHaveBeenCalled();
    });

    it('should handle non-existent item gracefully', () => {
      const initialItems = store.snapshot.items.length;

      store.updateItem('non_existent', { title: 'Should not crash' });

      expect(store.snapshot.items.length).toBe(initialItems);
    });
  });

  describe('getCategory', () => {
    it('should return category by ID', () => {
      const categoryId = store.snapshot.categories[0].id;

      const category = store.getCategory(categoryId);

      expect(category).toBeDefined();
      expect(category!.id).toBe(categoryId);
    });

    it('should return undefined for non-existent ID', () => {
      const category = store.getCategory('non_existent');

      expect(category).toBeUndefined();
    });

    it('should return undefined for undefined ID', () => {
      const category = store.getCategory(undefined);

      expect(category).toBeUndefined();
    });

    it('should return correct category details', () => {
      const categoryId = 'cat_docs';

      const category = store.getCategory(categoryId);

      expect(category).toBeDefined();
      expect(category!.name).toBeTruthy();
      expect(category!.color).toMatch(/^#/);
      expect(category!.icon).toBeTruthy();
    });
  });

  describe('integration tests', () => {
    it('should handle complete item workflow', () => {
      // Add item with auto-suggest
      store.toggleAutoSuggest(true);
      const item = store.addItem({
        title: 'Court Document Custody Order',
        mediaType: 'file',
      });

      expect(item.suggestedCategoryId).toBe('cat_legal');
      expect(item.status).toBe('needs_approval');

      // Approve the suggestion
      store.approveItem(item.id, item.suggestedCategoryId!);

      const approved = store.snapshot.items.find(i => i.id === item.id);
      expect(approved!.status).toBe('approved');
      expect(approved!.approvedCategoryId).toBe('cat_legal');

      // Update with tags
      store.updateItem(item.id, { tags: ['important', 'legal', '2024'] });

      const tagged = store.snapshot.items.find(i => i.id === item.id);
      expect(tagged!.tags).toEqual(['important', 'legal', '2024']);
    });

    it('should handle rejection and re-approval workflow', () => {
      store.toggleAutoSuggest(true);
      const item = store.addItem({ title: 'Invoice', mediaType: 'file' });

      // Reject suggestion
      store.rejectSuggestion(item.id);
      let current = store.snapshot.items.find(i => i.id === item.id);
      expect(current!.suggestedCategoryId).toBeUndefined();

      // Manually approve with different category
      store.approveItem(item.id, 'cat_docs');
      current = store.snapshot.items.find(i => i.id === item.id);
      expect(current!.approvedCategoryId).toBe('cat_docs');
      expect(current!.status).toBe('approved');
    });

    it('should handle category lifecycle', () => {
      // Add custom category
      store.addCategory({ name: 'Custom', color: '#FF00FF', icon: '🌟' });

      const customCat = store.snapshot.categories[0];
      expect(customCat.name).toBe('Custom');

      // Add item to custom category
      const item = store.addItem({ title: 'Test', mediaType: 'file' });
      store.approveItem(item.id, customCat.id);

      // Remove category (should unassign items)
      store.removeCategory(customCat.id);

      const unassigned = store.snapshot.items.find(i => i.id === item.id);
      expect(unassigned!.approvedCategoryId).toBeUndefined();
      expect(unassigned!.status).toBe('needs_approval');
    });
  });
});
