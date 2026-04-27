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
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../../shared/api/axiosConfig';

const FoodMasterProfile = ({ onSignOut }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '', address: '', dateOfBirth: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/foodmaster/profile');
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
    setSaving(true);
    try {
      await api.put('/foodmaster/profile', editForm);
      setEditOpen(false);
      await fetchProfile();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Update failed', err.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    try {
      await api.put('/foodmaster/change-password', passwordForm);
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) {
      Alert.alert('Password change failed', err.response?.data?.message || 'Unable to change password');
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
      await api.post('/foodmaster/profile/photo', formData, {
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
            await api.delete('/foodmaster/profile/photo');
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
    return <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 30 }} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text allowFontScaling={false} style={styles.title}>My Profile</Text>
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

          <TouchableOpacity style={styles.primaryButton} onPress={() => setEditOpen(true)}>
            <Text allowFontScaling={false} style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPasswordOpen(true)}>
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
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Full Name" placeholderTextColor="#94a3b8" value={editForm.fullName} onChangeText={(v) => updateEditField('fullName', v)} />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Email" placeholderTextColor="#94a3b8" value={editForm.email} onChangeText={(v) => updateEditField('email', v)} autoCapitalize="none" />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Phone" placeholderTextColor="#94a3b8" value={editForm.phone} onChangeText={(v) => updateEditField('phone', v)} />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Address" placeholderTextColor="#94a3b8" value={editForm.address} onChangeText={(v) => updateEditField('address', v)} />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="DOB (YYYY-MM-DD)" placeholderTextColor="#94a3b8" value={editForm.dateOfBirth} onChangeText={(v) => updateEditField('dateOfBirth', v)} />

            <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Save Profile Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditOpen(false)}>
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={passwordOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Change Password</Text>
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Current Password" placeholderTextColor="#94a3b8" value={passwordForm.currentPassword} onChangeText={(v) => updatePasswordField('currentPassword', v)} secureTextEntry />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="New Password" placeholderTextColor="#94a3b8" value={passwordForm.newPassword} onChangeText={(v) => updatePasswordField('newPassword', v)} secureTextEntry />
            <TextInput allowFontScaling={false} style={styles.input} placeholder="Confirm New Password" placeholderTextColor="#94a3b8" value={passwordForm.confirmPassword} onChangeText={(v) => updatePasswordField('confirmPassword', v)} secureTextEntry />

            <TouchableOpacity style={styles.primaryButton} onPress={changePassword} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text allowFontScaling={false} style={styles.primaryButtonText}>Update Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPasswordOpen(false)}>
              <Text allowFontScaling={false} style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc', marginBottom: 10 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, elevation: 1 },
  avatar: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginBottom: 10, backgroundColor: '#334155' },
  name: { textAlign: 'center', fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 6 },
  meta: { color: '#94a3b8', marginTop: 2 },
  rowButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  warnButton: { backgroundColor: '#f59e0b' },
  smallButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', borderRadius: 8, alignItems: 'center', paddingVertical: 11, marginTop: 8 },
  secondaryButtonText: { color: '#94a3b8', fontWeight: '600' },
  logoutButton: { backgroundColor: '#ef4444', borderRadius: 8, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  logoutButtonText: { color: '#ffffff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 14 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10, color: '#f8fafc' },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  errorText: { color: '#ef4444', marginBottom: 8 }
});

export default FoodMasterProfile;
