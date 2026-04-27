import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Modal,
  FlatList
} from 'react-native';
import api from '../../shared/api/axiosConfig';

const StockDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [addForm, setAddForm] = useState({ itemName: '', currentQty: '', minQty: '', maxQty: '', unitPrice: '' });
  const [editForm, setEditForm] = useState({ itemName: '', currentQty: '', minQty: '', maxQty: '', unitPrice: '' });
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, stockRes] = await Promise.all([
        api.get('/inventory/dashboard'),
        api.get('/inventory/stock', { params: search ? { search } : (filterStatus ? { status: filterStatus } : {}) })
      ]);
      
      setDashboard(dashRes.data);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    const fetchMenuItems = async () => {
      setMenuItemsLoading(true);
      try {
        const res = await api.get('/inventory/menu-items');
        setMenuItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setMenuItems([]);
      } finally {
        setMenuItemsLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const updateAddField = (key, value) => {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitAddItem = async () => {
    const currentQty = Number(addForm.currentQty);
    const minQty = Number(addForm.minQty);
    const maxQty = Number(addForm.maxQty);
    const unitPrice = Number(addForm.unitPrice);

    setAddError('');

    if (!addForm.itemName.trim()) {
      setAddError('Please select a menu item');
      return;
    }
    if (!addForm.currentQty || isNaN(currentQty) || currentQty <= 0) {
      setAddError('Current quantity must be greater than zero');
      return;
    }
    if (!addForm.minQty || isNaN(minQty) || minQty <= 5) {
      setAddError('Minimum quantity must be greater than 5');
      return;
    }
    if (!addForm.maxQty || isNaN(maxQty) || maxQty <= 0) {
      setAddError('Maximum quantity must be greater than zero');
      return;
    }
    if (minQty >= maxQty) {
      setAddError('Minimum quantity must be less than maximum quantity');
      return;
    }
    if (!addForm.unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
      setAddError('Unit price must be greater than zero in Rs.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/inventory/stock', {
        menuItemId: addForm.itemName,
        currentQty: addForm.currentQty,
        minQty: addForm.minQty,
        maxQty: addForm.maxQty,
        unitPrice: addForm.unitPrice
      });
      setAddOpen(false);
      setAddForm({ itemName: '', currentQty: '', minQty: '', maxQty: '', unitPrice: '' });
      setMenuDropdownOpen(false);
      await fetchData();
      Alert.alert('Success', 'Stock item added successfully');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      itemName: item.itemName,
      currentQty: String(item.currentQty),
      minQty: String(item.minQty),
      maxQty: String(item.maxQty),
      unitPrice: String(item.unitPrice)
    });
    setEditError('');
    setEditOpen(true);
  };

  const submitEditItem = async () => {
    const currentQty = Number(editForm.currentQty);
    const minQty = Number(editForm.minQty);
    const maxQty = Number(editForm.maxQty);
    const unitPrice = Number(editForm.unitPrice);

    setEditError('');

    if (!editForm.currentQty || isNaN(currentQty) || currentQty <= 0) {
      setEditError('Current quantity must be greater than zero');
      return;
    }
    if (!editForm.minQty || isNaN(minQty) || minQty <= 5) {
      setEditError('Minimum quantity must be greater than 5');
      return;
    }
    if (!editForm.maxQty || isNaN(maxQty) || maxQty <= 0) {
      setEditError('Maximum quantity must be greater than zero');
      return;
    }
    if (minQty >= maxQty) {
      setEditError('Minimum quantity must be less than maximum quantity');
      return;
    }
    if (!editForm.unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
      setEditError('Unit price must be greater than zero in Rs.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/inventory/stock/${editingItem._id}`, editForm);
      setEditOpen(false);
      setEditingItem(null);
      await fetchData();
      Alert.alert('Success', 'Stock item updated successfully');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (item) => {
    const performDelete = async () => {
      try {
        await api.delete(`/inventory/stock/${item._id}`);
        await fetchData();
        Alert.alert('Success', 'Item deleted successfully');
      } catch (err) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to delete item');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof globalThis.confirm === 'function'
        ? globalThis.confirm(`Delete "${item.itemName}"?`)
        : true;
      if (confirmed) {
        performDelete();
      }
      return;
    }

    Alert.alert('Delete Item', `Delete "${item.itemName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: performDelete
      }
    ]);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'low_stock':
        return { backgroundColor: '#ef4444', textColor: '#fff' };
      case 'over_stock':
        return { backgroundColor: '#f59e0b', textColor: '#fff' };
      default:
        return { backgroundColor: '#2563eb', textColor: '#fff' };
    }
  };

  const renderStockItem = ({ item }) => (
    <View style={styles.stockCard}>
      <View style={styles.stockHeader}>
        <View style={{ flex: 1 }}>
          <Text allowFontScaling={false} style={styles.stockName}>{item.itemName}</Text>
          <Text allowFontScaling={false} style={styles.stockCode}>{item.stockId || '-'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(item.status).backgroundColor }]}>
          <Text allowFontScaling={false} style={[styles.statusText, { color: getStatusStyle(item.status).textColor }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.stockMeta}>
        <Text allowFontScaling={false} style={styles.metaText}>Current: {item.currentQty}</Text>
        <Text allowFontScaling={false} style={styles.metaText}>Min: {item.minQty} | Max: {item.maxQty}</Text>
        <Text allowFontScaling={false} style={styles.metaText}>Unit Price: PKR {item.unitPrice.toFixed(2)}</Text>
      </View>
      <View style={styles.stockActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Text allowFontScaling={false} style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteItem(item)}>
          <Text allowFontScaling={false} style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !dashboard) {
    return <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 30 }} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text allowFontScaling={false} style={styles.title}>Stock Inventory</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => { setAddError(''); setAddOpen(true); }}>
            <Text allowFontScaling={false} style={styles.addButtonText}>+ Add Item</Text>
          </TouchableOpacity>
        </View>

        {dashboard && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text allowFontScaling={false} style={styles.statValue}>{dashboard.totalItems}</Text>
              <Text allowFontScaling={false} style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statCard}>
              <Text allowFontScaling={false} style={[styles.statValue, { color: '#ef4444' }]}>{dashboard.lowStockItems}</Text>
              <Text allowFontScaling={false} style={styles.statLabel}>Low Stock</Text>
            </View>
            <View style={styles.statCard}>
              <Text allowFontScaling={false} style={[styles.statValue, { color: '#f59e0b' }]}>{dashboard.overStockItems}</Text>
              <Text allowFontScaling={false} style={styles.statLabel}>Over Stock</Text>
            </View>
            <View style={styles.statCard}>
              <Text allowFontScaling={false} style={[styles.statValue, { fontSize: 16 }]}>PKR {(dashboard.totalInventoryValue || 0).toFixed(2)}</Text>
              <Text allowFontScaling={false} style={styles.statLabel}>Total Value</Text>
            </View>
          </View>
        )}

        {dashboard?.lowStockList && dashboard.lowStockList.length > 0 && (
          <View style={styles.alertSection}>
            <Text allowFontScaling={false} style={styles.alertTitle}>⚠️ Low Stock Alerts</Text>
            {dashboard.lowStockList.map((item) => (
              <View key={item._id} style={styles.alertItem}>
                <Text allowFontScaling={false} style={styles.alertItemName}>{item.itemName}</Text>
                <Text allowFontScaling={false} style={styles.alertItemQty}>Current: {item.currentQty} | Min: {item.minQty}</Text>
              </View>
            ))}
          </View>
        )}

        <TextInput
          style={styles.searchInput}
          placeholder="Search stock items..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.filterChips}>
          {['', 'low_stock', 'good', 'over_stock'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.chip, filterStatus === status && styles.chipActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text allowFontScaling={false} style={[styles.chipText, filterStatus === status && styles.chipTextActive]}>
                {status ? status.replace('_', ' ').toUpperCase() : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text allowFontScaling={false} style={styles.errorText}>{error}</Text>}

        {stock.length === 0 ? (
          <View style={styles.emptyState}>
            <Text allowFontScaling={false} style={styles.emptyText}>No stock items found</Text>
          </View>
        ) : (
          <FlatList
            data={stock}
            renderItem={renderStockItem}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Add Stock Item</Text>
            <ScrollView>
              <Text allowFontScaling={false} style={styles.inputLabel}>Menu Item</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setMenuDropdownOpen((prev) => !prev)}
              >
                <Text allowFontScaling={false} style={[styles.dropdownTriggerText, !addForm.itemName && styles.dropdownPlaceholderText]}>
                  {addForm.itemName
                    ? menuItems.find((menu) => menu._id === addForm.itemName)?.name || 'Selected menu item'
                    : 'Select menu item'}
                </Text>
                <Text allowFontScaling={false} style={styles.dropdownIcon}>{menuDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {menuDropdownOpen && (
                <View style={styles.dropdownList}>
                  {menuItemsLoading ? (
                    <ActivityIndicator size="small" color="#38bdf8" style={{ paddingVertical: 10 }} />
                  ) : (
                    <ScrollView style={styles.dropdownListScroll} nestedScrollEnabled>
                      {menuItems.map((menu) => (
                        <TouchableOpacity
                          key={menu._id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            updateAddField('itemName', menu._id);
                            setMenuDropdownOpen(false);
                          }}
                        >
                          <Text allowFontScaling={false} style={styles.dropdownItemText}>{menu.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
              <Text allowFontScaling={false} style={styles.inputLabel}>Current Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter current quantity"
                placeholderTextColor="#94a3b8"
                value={addForm.currentQty}
                onChangeText={(v) => updateAddField('currentQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Minimum Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter minimum quantity"
                placeholderTextColor="#94a3b8"
                value={addForm.minQty}
                onChangeText={(v) => updateAddField('minQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Maximum Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter maximum quantity"
                placeholderTextColor="#94a3b8"
                value={addForm.maxQty}
                onChangeText={(v) => updateAddField('maxQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Unit Price</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter unit price in Rs."
                placeholderTextColor="#94a3b8"
                value={addForm.unitPrice}
                onChangeText={(v) => updateAddField('unitPrice', v)}
                keyboardType="decimal-pad"
              />

              {!!addError && <Text allowFontScaling={false} style={styles.errorText}>{addError}</Text>}
              <TouchableOpacity style={styles.primaryButton} onPress={submitAddItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Add Item</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setAddError(''); setAddOpen(false); }}>
                <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Edit Stock Item</Text>
            <ScrollView>
              <Text allowFontScaling={false} style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                placeholder="Item Name"
                placeholderTextColor="#94a3b8"
                value={editForm.itemName}
                editable={false}
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Current Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter current quantity"
                placeholderTextColor="#94a3b8"
                value={editForm.currentQty}
                onChangeText={(v) => updateEditField('currentQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Minimum Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter minimum quantity"
                placeholderTextColor="#94a3b8"
                value={editForm.minQty}
                onChangeText={(v) => updateEditField('minQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Maximum Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter maximum quantity"
                placeholderTextColor="#94a3b8"
                value={editForm.maxQty}
                onChangeText={(v) => updateEditField('maxQty', v)}
                keyboardType="number-pad"
              />
              <Text allowFontScaling={false} style={styles.inputLabel}>Unit Price</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter unit price in Rs."
                placeholderTextColor="#94a3b8"
                value={editForm.unitPrice}
                onChangeText={(v) => updateEditField('unitPrice', v)}
                keyboardType="decimal-pad"
              />

              {!!editError && <Text allowFontScaling={false} style={styles.errorText}>{editError}</Text>}
              <TouchableOpacity style={styles.primaryButton} onPress={submitEditItem} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Update Item</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => { setEditError(''); setEditOpen(false); }}>
                <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    elevation: 1,
    alignItems: 'center'
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#38bdf8' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  alertSection: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b'
  },
  alertTitle: { fontWeight: '700', color: '#f59e0b', marginBottom: 8 },
  alertItem: { paddingVertical: 6 },
  alertItemName: { fontWeight: '600', color: '#fcd34d', fontSize: 13 },
  alertItemQty: { fontSize: 12, color: '#fcd34d' },
  searchInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14
  },
  filterChips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },
  stockCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8'
  },
  stockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stockName: { fontSize: 15, fontWeight: '700', color: '#f8fafc', flex: 1 },
  stockCode: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  stockMeta: { marginBottom: 10 },
  metaText: { fontSize: 12, color: '#94a3b8', marginVertical: 2 },
  stockActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  editBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  deleteBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  deleteBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#94a3b8' },
  errorText: { color: '#ef4444', marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 14, color: '#f8fafc' },
  inputLabel: {
    fontSize: 13,
    color: '#e2e8f0',
    marginBottom: 4,
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14
  },
  readOnlyInput: {
    backgroundColor: '#1e293b',
    color: '#94a3b8'
  },
  dropdownTrigger: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownTriggerText: { fontSize: 14, color: '#f8fafc' },
  dropdownPlaceholderText: { color: '#94a3b8' },
  dropdownIcon: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#0f172a'
  },
  dropdownListScroll: { maxHeight: 180 },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
  dropdownItemText: { fontSize: 14, color: '#f8fafc' },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', borderRadius: 8, alignItems: 'center', paddingVertical: 11 },
  secondaryButtonText: { color: '#94a3b8', fontWeight: '600' }
});

export default StockDashboard;
