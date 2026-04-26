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
  Image,
  RefreshControl,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../shared/api/axiosConfig';
import { formatDate, parseDate, isGmailEmail, isPhoneValid, isAgeAtLeast, isPasswordStrong } from '../../shared/utils/formValidators';

const MySecurityProfile = ({ onSignOut }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordMessageType, setPasswordMessageType] = useState('error');

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '', address: '', dateOfBirth: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showEditDobPicker, setShowEditDobPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/profile');
      setProfile(data);
      setEditForm({
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const updateEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePasswordField = (key, value) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!editForm.fullName.trim() || !editForm.email.trim() || !editForm.phone.trim() || !editForm.address.trim() || !editForm.dateOfBirth.trim()) {
      setEditError('All fields are required.');
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

    setEditError('');
    setSaving(true);
    try {
      await api.put('/admin/profile', editForm);
      setEditOpen(false);
      await fetchProfile();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('Fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordMessageType('error');
      setPasswordMessage('New password must be different from current password.');
      return;
    }

    if (!isPasswordStrong(passwordForm.newPassword)) {
      setPasswordMessageType('error');
      setPasswordMessage('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }

    setPasswordMessage('');
    setSaving(true);
    try {
      await api.put('/admin/change-password', passwordForm);
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessageType('success');
      setPasswordMessage('Password changed successfully.');
    } catch (err) {
      setPasswordMessageType('error');
      setPasswordMessage(err.response?.data?.message || 'Unable to change password');
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('photo', {
      uri: asset.uri,
      name: `profile-${Date.now()}.jpg`,
      type: 'image/jpeg'
    });

    try {
      await api.post('/admin/profile/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchProfile();
      Alert.alert('Success', 'Profile photo uploaded');
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || 'Unable to upload photo');
    }
  };

  const deletePhoto = async () => {
    Alert.alert('Delete Photo', 'Delete current profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/admin/profile/photo');
            await fetchProfile();
          } catch (err) {
            Alert.alert('Delete failed', err.response?.data?.message || 'Unable to delete photo');
          }
        }
      }
    ]);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Sign out locally even if server logout fails.
    }
    await onSignOut();
  };

  if (loading && !profile) {
    return <ActivityIndicator size="large" color="#1abc9c" style={{ marginTop: 30 }} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text allowFontScaling={false} style={styles.title}>My Security Profile</Text>
        {!!error && <Text allowFontScaling={false} style={styles.errorText}>{error}</Text>}

        <View style={styles.card}>
          <Image
            source={profile?.profilePhoto ? { uri: `${api.defaults.baseURL.replace('/api', '')}${profile.profilePhoto}` } : { uri: 'https://via.placeholder.com/120x120.png?text=Profile' }}
            style={styles.avatar}
          />

          <Text allowFontScaling={false} style={styles.name}>{profile?.fullName || '-'}</Text>
          <Text allowFontScaling={false} style={styles.meta}>Username: {profile?.username || '-'}</Text>
          <Text allowFontScaling={false} style={styles.meta}>Email: {profile?.email || '-'}</Text>
          <Text allowFontScaling={false} style={styles.meta}>Phone: {profile?.phone || '-'}</Text>
          <Text allowFontScaling={false} style={styles.meta}>Address: {profile?.address || '-'}</Text>

          <View style={styles.rowButtons}>
            <TouchableOpacity style={styles.smallButton} onPress={pickPhoto}>
              <Text allowFontScaling={false} style={styles.smallButtonText}>Upload Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallButton, styles.warnButton]} onPress={deletePhoto}>
              <Text allowFontScaling={false} style={styles.smallButtonText}>Delete Photo</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setEditError('');
              setEditOpen(true);
            }}
          >
            <Text allowFontScaling={false} style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setPasswordMessage('');
              setPasswordMessageType('error');
              setPasswordOpen(true);
            }}
          >
            <Text allowFontScaling={false} style={styles.secondaryButtonText}>Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text allowFontScaling={false} style={styles.logoutButtonText}>Logout System</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Edit Profile</Text>
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Full Name" value={editForm.fullName} onChangeText={(v) => updateEditField('fullName', v)} />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Email" value={editForm.email} onChangeText={(v) => updateEditField('email', v)} autoCapitalize="none" />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Phone" value={editForm.phone} onChangeText={(v) => updateEditField('phone', v)} />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Address" value={editForm.address} onChangeText={(v) => updateEditField('address', v)} />
            <Text allowFontScaling={false} style={styles.fieldLabel}>Date of Birth</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={editForm.dateOfBirth}
                max={formatDate(new Date())}
                onChange={(event) => updateEditField('dateOfBirth', event.target.value)}
                style={styles.webDateInput}
              />
            ) : (
              <>
                <TouchableOpacity style={styles.dateInput} onPress={() => setShowEditDobPicker(true)}>
                  <Text allowFontScaling={false} style={editForm.dateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                    {editForm.dateOfBirth || 'Select Date of Birth'}
                  </Text>
                </TouchableOpacity>
                {showEditDobPicker && (
                  <DateTimePicker
                    value={parseDate(editForm.dateOfBirth)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(_event, selectedDate) => {
                      setShowEditDobPicker(false);
                      if (selectedDate) {
                        updateEditField('dateOfBirth', formatDate(selectedDate));
                      }
                    }}
                  />
                )}
              </>
            )}

            {!!editError && <Text allowFontScaling={false} style={styles.errorText}>{editError}</Text>}

            <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Save Profile Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setEditError('');
                setEditOpen(false);
              }}
            >
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Change Password</Text>
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Current Password" value={passwordForm.currentPassword} onChangeText={(v) => updatePasswordField('currentPassword', v)} secureTextEntry />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="New Password" value={passwordForm.newPassword} onChangeText={(v) => updatePasswordField('newPassword', v)} secureTextEntry />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Confirm New Password" value={passwordForm.confirmPassword} onChangeText={(v) => updatePasswordField('confirmPassword', v)} secureTextEntry />

            {!!passwordMessage && (
              <Text allowFontScaling={false} style={passwordMessageType === 'success' ? styles.successText : styles.errorText}>
                {passwordMessage}
              </Text>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={changePassword} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Update Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPasswordMessage('');
                setPasswordMessageType('error');
                setPasswordOpen(false);
              }}
            >
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f8' },
  content: { padding: 16, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, elevation: 1 },
  avatar: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 10, backgroundColor: '#e5e7eb' },
  name: { textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  meta: { color: '#475569', marginTop: 2 },
  rowButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallButton: { flex: 1, backgroundColor: '#0ea5a2', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  warnButton: { backgroundColor: '#f59e0b' },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  primaryButton: { backgroundColor: '#0ea5a2', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#94a3b8', borderRadius: 8, alignItems: 'center', paddingVertical: 11, marginTop: 8 },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  logoutButton: { backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  logoutButtonText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#1f2937' },
  fieldLabel: { color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 2 },
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8
  },
  datePlaceholder: { color: '#9ca3af', fontSize: 15 },
  dateValue: { color: '#111827', fontSize: 15 },
  webDateInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    fontSize: 15,
    boxSizing: 'border-box'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  errorText: { color: '#dc2626', marginBottom: 8 },
  successText: { color: '#16a34a', marginBottom: 8 }
});

export default MySecurityProfile;
