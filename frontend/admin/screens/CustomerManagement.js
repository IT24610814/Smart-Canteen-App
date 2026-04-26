import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../shared/api/axiosConfig';
import { isNicValid, isGmailEmail, isPhoneValid, isAgeAtLeast } from '../../shared/utils/formValidators';

const emptyEdit = {
  _id: '',
  userId: '',
  fullName: '',
  username: '',
  nic: '',
  email: '',
  phone: '',
  address: '',
  dateOfBirth: ''
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (dateString) => {
  if (!dateString) {
    return new Date(2000, 0, 1);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(2000, 0, 1);
  }

  return parsed;
};

const WebDateInput = ({ value, onChange, style }) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <input
      type="date"
      value={value}
      max={formatDate(new Date())}
      onChange={(event) => onChange(event.target.value)}
      style={style}
    />
  );
};

const formatDisplay = (value) => (value ? value : '-');

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (search.trim()) {
        params.search = search.trim();
      }

      const { data } = await api.get('/admin/customers', { params });
      setCustomers(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  };

  const openEdit = (item) => {
    setEditForm({
      _id: item._id,
      userId: item.userId || item.staffId || '',
      fullName: item.fullName || '',
      username: item.username || '',
      nic: item.nic || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      dateOfBirth: formatDate(item.dateOfBirth)
    });
    setEditError('');
    setEditModal(true);
  };

  const closeEdit = () => {
    setShowDobPicker(false);
    setEditModal(false);
    setEditForm(emptyEdit);
    setEditError('');
  };

  const updateField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitUpdate = async () => {
    if (!editForm._id) {
      setEditError('Invalid customer selected');
      return;
    }

    if (
      !editForm.fullName.trim() ||
      !editForm.username.trim() ||
      !editForm.nic.trim() ||
      !editForm.email.trim() ||
      !editForm.phone.trim() ||
      !editForm.address.trim() ||
      !editForm.dateOfBirth.trim()
    ) {
      setEditError('All fields are required.');
      return;
    }

    if (!isNicValid(editForm.nic)) {
      setEditError('NIC must be 12 digits or 9 digits followed by V, v, X, or x.');
      return;
    }

    if (!isGmailEmail(editForm.email)) {
      setEditError('Email must end with @gmail.com.');
      return;
    }

    if (!isPhoneValid(editForm.phone)) {
      setEditError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!isAgeAtLeast(editForm.dateOfBirth, 16)) {
      setEditError('Age must be at least 16.');
      return;
    }

    setSaving(true);
    setEditError('');

    try {
      await api.put(`/admin/customers/${editForm._id}`, {
        fullName: editForm.fullName.trim(),
        username: editForm.username.trim(),
        nic: editForm.nic.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        dateOfBirth: editForm.dateOfBirth || null
      });

      closeEdit();
      await fetchCustomers();
      Alert.alert('Success', 'Customer updated successfully');
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (id) => {
    try {
      await api.delete(`/admin/customers/${id}`);
      await fetchCustomers();
    } catch (err) {
      Alert.alert('Delete failed', err.response?.data?.message || 'Unable to delete customer');
    }
  };

  const deleteCustomer = async (id, name) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete ${name}?`) : true;
      if (confirmed) {
        await performDelete(id);
      }
      return;
    }

    Alert.alert('Delete Customer', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDelete(id) }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.name}>{item.fullName}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.userId}>{item.userId || item.staffId || '-'}</Text>
      </View>

      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>Username: {formatDisplay(item.username)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>Role: {formatDisplay(item.role)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>NIC: {formatDisplay(item.nic)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>Email: {formatDisplay(item.email)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>Phone: {formatDisplay(item.phone)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>Address: {formatDisplay(item.address)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.meta}>DOB: {formatDisplay(formatDate(item.dateOfBirth))}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCustomer(item._id, item.fullName)}>
          <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Management</Text>
      <TextInput
        style={styles.input}
        placeholder="Search by customer name, user ID, or username"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#94a3b8"
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {loading ? (
        <ActivityIndicator size="large" color="#38bdf8" style={styles.loader} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No customers found</Text>}
        />
      )}

      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Customer</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.readOnlyText}>User ID: {formatDisplay(editForm.userId)}</Text>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput style={styles.input} placeholder="Full Name" value={editForm.fullName} onChangeText={(value) => updateField('fullName', value)} placeholderTextColor="#94a3b8" />
              <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.fieldLabel}>Username</Text>
              <TextInput style={styles.input} placeholder="Username" value={editForm.username} onChangeText={(value) => updateField('username', value)} autoCapitalize="none" placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>NIC</Text>
              <TextInput style={styles.input} placeholder="NIC" value={editForm.nic} onChangeText={(value) => updateField('nic', value)} autoCapitalize="characters" placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} placeholder="Email" value={editForm.email} onChangeText={(value) => updateField('email', value)} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.input} placeholder="Phone" value={editForm.phone} onChangeText={(value) => updateField('phone', value)} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput style={styles.input} placeholder="Address" value={editForm.address} onChangeText={(value) => updateField('address', value)} placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                <WebDateInput
                  value={editForm.dateOfBirth}
                  onChange={(value) => updateField('dateOfBirth', value)}
                  style={styles.webDateInput}
                />
              ) : (
                <>
                  <TouchableOpacity style={styles.dateInput} onPress={() => setShowDobPicker(true)}>
                    <Text style={editForm.dateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                      {editForm.dateOfBirth || 'Select Date of Birth'}
                    </Text>
                  </TouchableOpacity>
                  {showDobPicker && (
                    <DateTimePicker
                      value={parseDate(editForm.dateOfBirth)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(_event, selectedDate) => {
                        setShowDobPicker(false);
                        if (selectedDate) {
                          updateField('dateOfBirth', formatDate(selectedDate));
                        }
                      }}
                    />
                  )}
                </>
              )}

              {!!editError && <Text style={styles.errorText}>{editError}</Text>}
              <TouchableOpacity style={styles.editBtn} onPress={submitUpdate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.editBtnText}>Update Customer</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={closeEdit}>
                <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 10 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  loader: { marginTop: 20 },
  listContent: { paddingBottom: 30 },
  card: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  name: { fontWeight: '700', color: '#f8fafc', fontSize: 16, flex: 1 },
  userId: { color: '#38bdf8', fontWeight: '700' },
  meta: { color: '#94a3b8', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  editBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 10 },
  editBtnText: { color: '#ffffff', fontWeight: '700' },
  deleteBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 10 },
  deleteBtnText: { color: '#ffffff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', borderRadius: 8, alignItems: 'center', paddingVertical: 10, marginTop: 8 },
  secondaryBtnText: { color: '#94a3b8', fontWeight: '600' },
  errorText: { color: '#ef4444', marginBottom: 6 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, maxHeight: '92%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#f8fafc' },
  readOnlyText: { color: '#94a3b8', marginBottom: 8, fontWeight: '600' },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 2 },
  dateInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8
  },
  datePlaceholder: { color: '#94a3b8', fontSize: 15 },
  dateValue: { color: '#f8fafc', fontSize: 15 },
  webDateInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 15,
    boxSizing: 'border-box'
  }
});

export default CustomerManagement;