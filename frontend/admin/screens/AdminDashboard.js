import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../shared/api/axiosConfig';
import { formatDate, parseDate, isNicValid, isGmailEmail, isPhoneValid, isAgeBetween } from '../../shared/utils/formValidators';

const defaultForm = {
  fullName: '',
  nic: '',
  phone: '',
  email: '',
  address: '',
  dateOfBirth: '',
  role: 'foodmaster'
};

const roleOptions = ['foodmaster', 'inventory', 'promotion', 'order', 'finance', 'feedback', 'admin'];

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const roleItems = useMemo(() => {
    if (!stats?.staffByRole) {
      return [];
    }
    return Object.entries(stats.staffByRole);
  }, [stats]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowDobPicker(false);
    setForm(defaultForm);
    setCreatedCredentials(null);
    setError('');
  };

  const submitNewStaff = async () => {
    if (
      !form.fullName.trim() ||
      !form.nic.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.address.trim() ||
      !form.dateOfBirth.trim()
    ) {
      setError('All fields are required.');
      return;
    }

    if (!isNicValid(form.nic)) {
      setError('NIC must be 12 digits or 9 digits followed by V, v, X, or x.');
      return;
    }

    if (!isGmailEmail(form.email)) {
      setError('Email must end with @gmail.com.');
      return;
    }

    if (!isPhoneValid(form.phone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!isAgeBetween(form.dateOfBirth, 16, 55)) {
      setError('Staff age must be between 16 and 55.');
      return;
    }

    setSaving(true);
    setError('');
    setCreatedCredentials(null);

    try {
      const { data } = await api.post('/admin/staff', form);
      setCreatedCredentials(data.generatedCredentials);
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Dashboard Overview</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.cardGrid}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Total Staff</Text>
                <Text style={styles.cardValue}>{stats?.totalStaff ?? 0}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Total Customers</Text>
                <Text style={styles.cardValue}>{stats?.totalCustomers ?? 0}</Text>
              </View>
            </View>

            <View style={styles.roleListCard}>
              <Text style={styles.sectionTitle}>Staff Count Per Role</Text>
              {roleItems.map(([role, count]) => (
                <View key={role} style={styles.roleRow}>
                  <Text style={styles.roleName}>{role}</Text>
                  <Text style={styles.roleCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <TouchableOpacity style={styles.fabButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>Add New Staff Member</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Staff Member</Text>
            <Text style={styles.infoText}>User ID is generated automatically. Username defaults to the staff member's full name. Password defaults to the NIC number.</Text>

            <ScrollView>
              <TextInput style={styles.input} placeholder="Full Name" value={form.fullName} onChangeText={(v) => updateField('fullName', v)} placeholderTextColor="#94a3b8" />
              <TextInput style={styles.input} placeholder="NIC" value={form.nic} onChangeText={(v) => updateField('nic', v)} placeholderTextColor="#94a3b8" />
              <TextInput style={styles.input} placeholder="Phone (10 digits)" value={form.phone} onChangeText={(v) => updateField('phone', v)} keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
              <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={(v) => updateField('email', v)} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#94a3b8" />
              <TextInput style={styles.input} placeholder="Address" value={form.address} onChangeText={(v) => updateField('address', v)} placeholderTextColor="#94a3b8" />
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={form.dateOfBirth}
                  max={formatDate(new Date())}
                  onChange={(event) => updateField('dateOfBirth', event.target.value)}
                  style={styles.webDateInput}
                />
              ) : (
                <>
                  <TouchableOpacity style={styles.dateInput} onPress={() => setShowDobPicker(true)}>
                    <Text style={form.dateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                      {form.dateOfBirth || 'Select Date of Birth'}
                    </Text>
                  </TouchableOpacity>
                  {showDobPicker && (
                    <DateTimePicker
                      value={parseDate(form.dateOfBirth)}
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

              <Text style={styles.smallHeading}>Select Role</Text>
              <View style={styles.roleChipWrap}>
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, form.role === role && styles.roleChipActive]}
                    onPress={() => updateField('role', role)}
                  >
                    <Text style={[styles.roleChipText, form.role === role && styles.roleChipTextActive]}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              {createdCredentials && (
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>Staff Created</Text>
                  <Text style={styles.successText}>User ID: {createdCredentials.userId}</Text>
                  <Text style={styles.successText}>Username: {createdCredentials.username}</Text>
                  <Text style={styles.successText}>Password: {createdCredentials.password}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={submitNewStaff} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add Staff Member</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeModal}>
                <Text style={styles.secondaryButtonText}>Close</Text>
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
  content: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#f8fafc', marginBottom: 14 },
  cardGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, elevation: 2 },
  cardLabel: { color: '#94a3b8', fontSize: 14 },
  cardValue: { color: '#f8fafc', fontSize: 26, fontWeight: 'bold', marginTop: 6 },
  roleListCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  roleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#334155' },
  roleName: { color: '#e2e8f0', textTransform: 'capitalize' },
  roleCount: { color: '#38bdf8', fontWeight: '700' },
  fabButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, maxHeight: '92%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#f8fafc' },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 2 },
  dateInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10
  },
  datePlaceholder: { color: '#94a3b8', fontSize: 15 },
  dateValue: { color: '#f8fafc', fontSize: 15 },
  webDateInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    boxSizing: 'border-box'
  },
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
  smallHeading: { fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  roleChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  roleChip: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  roleChipActive: { borderColor: '#38bdf8', backgroundColor: '#1e3a8a' },
  roleChipText: { color: '#94a3b8', textTransform: 'capitalize' },
  roleChipTextActive: { color: '#38bdf8', fontWeight: '700' },
  primaryButton: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', paddingVertical: 11, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#94a3b8', fontWeight: '600' },
  errorText: { color: '#ef4444', marginTop: 4, marginBottom: 6 },
  infoText: { color: '#94a3b8', marginBottom: 10, lineHeight: 20 },
  successBox: { backgroundColor: '#1e3a8a', borderWidth: 1, borderColor: '#38bdf8', borderRadius: 8, padding: 10, marginVertical: 6 },
  successTitle: { fontWeight: '700', color: '#38bdf8', marginBottom: 4 },
  successText: { color: '#f8fafc' }
});

export default AdminDashboard;
