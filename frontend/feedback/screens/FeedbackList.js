import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import api from '../../shared/api/axiosConfig';
import { feedbackService } from '../../shared/api/services';

const buildUploadUri = (uploadPath) => {
  if (!uploadPath) {
    return null;
  }

  const serverBaseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
  return `${serverBaseUrl}${uploadPath}`;
};

const FeedbackList = () => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [activePhotoUri, setActivePhotoUri] = useState(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const { data } = await api.get('/feedback', { params });
      setFeedback(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchFeedback();
  }, [filter, fetchFeedback]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedback();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#f39c12';
      case 'resolved':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  };

  const openReplyModal = (item) => {
    setActiveFeedback(item);
    setReplyText(item.reply || '');
    setReplyError('');
    setReplyModalVisible(true);
  };

  const closeReplyModal = () => {
    setReplyModalVisible(false);
    setActiveFeedback(null);
    setReplyText('');
    setReplyError('');
  };

  const openPhotoModal = (imageUrl) => {
    const uri = buildUploadUri(imageUrl);
    setActivePhotoUri(uri);
    setPhotoModalVisible(true);
  };

  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setActivePhotoUri(null);
  };

  const submitReply = async () => {
    if (!activeFeedback?._id) {
      return;
    }

    if (!replyText.trim()) {
      setReplyError('Reply message is required');
      return;
    }

    setReplyError('');
    setActionLoading(true);
    try {
      await feedbackService.replyToFeedback(activeFeedback._id, replyText.trim(), 'resolved');
      closeReplyModal();
      await fetchFeedback();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setActionLoading(false);
    }
  };

  const askDeleteFeedback = (item) => {
    const performDelete = async () => {
      setActionLoading(true);
      try {
        await feedbackService.deleteFeedback(item._id);
        await fetchFeedback();
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete feedback');
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this feedback? This cannot be undone.') : true;
      if (confirmed) {
        performDelete();
      }
      return;
    }

    Alert.alert('Delete Feedback', 'Delete this feedback? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete },
    ]);
  };

  const renderDetailRow = (label, value) => (
    <View style={styles.detailRow}>
      <Text allowFontScaling={false} style={styles.detailLabel}>{label}:</Text>
      <Text allowFontScaling={false} style={styles.detailValue}>{value || '-'}</Text>
    </View>
  );

  const renderFeedbackCard = ({ item }) => (
    <View style={styles.feedbackCard}>
      <View style={styles.cardHeader}>
        <Text allowFontScaling={false} style={styles.type}>{(item.type || 'complaint').toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text allowFontScaling={false} style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      {renderDetailRow('Feedback ID', item.feedbackId)}
      {renderDetailRow('User ID', item.userId?.userId || item.userId?.staffId || item.userId?.username)}
      {renderDetailRow('Customer Name', item.userId?.fullName)}
      {renderDetailRow('Message', item.comment)}
      {item.rating && <Text allowFontScaling={false} style={styles.rating}>Rating: ★ {item.rating}/5</Text>}

      {item.imageUrl ? <Text allowFontScaling={false} style={styles.photoNote}>Photo attached</Text> : <Text style={styles.photoNote}>No photo</Text>}

      {item.reply ? (
        <View style={styles.replyBox}>
          <Text allowFontScaling={false} style={styles.replyTitle}>Reply</Text>
          <Text allowFontScaling={false} style={styles.replyText}>{item.reply}</Text>
        </View>
      ) : (
        <Text allowFontScaling={false} style={styles.noReply}>No reply yet</Text>
      )}

      <Text allowFontScaling={false} style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>

      <View style={styles.actionRow}>
        {item.imageUrl ? (
          <TouchableOpacity style={[styles.actionButton, styles.photoViewButton]} onPress={() => openPhotoModal(item.imageUrl)}>
            <Text allowFontScaling={false} style={styles.actionButtonText}>View Photo</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.actionButton} onPress={() => openReplyModal(item)}>
          <Text allowFontScaling={false} style={styles.actionButtonText}>{item.reply ? 'Edit Reply' : 'Reply'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => askDeleteFeedback(item)}>
          <Text allowFontScaling={false} style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Feedback & Complaints</Text>

      <View style={styles.filterContainer}>
        {['all', 'pending', 'resolved'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text allowFontScaling={false} style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text allowFontScaling={false} style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={feedback}
        renderItem={renderFeedbackCard}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text allowFontScaling={false} style={styles.emptyText}>No feedback found</Text>
          </View>
        }
      />

      <Modal transparent visible={replyModalVisible} animationType="fade" onRequestClose={closeReplyModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Reply to Feedback</Text>
              <TextInput
                style={styles.replyInput}
                placeholder="Type your reply"
                placeholderTextColor="#94a3b8"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
            {!!replyError && <Text allowFontScaling={false} style={styles.errorText}>{replyError}</Text>}
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={closeReplyModal}>
                <Text allowFontScaling={false} style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmit, actionLoading && styles.disabledButton]}
                onPress={submitReply}
                disabled={actionLoading}
              >
                <Text allowFontScaling={false} style={styles.modalButtonText}>{actionLoading ? 'Saving...' : 'Save Reply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={photoModalVisible} animationType="fade" onRequestClose={closePhotoModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.photoModalCard}>
            <Text allowFontScaling={false} style={styles.modalTitle}>Customer Photo</Text>
            {activePhotoUri ? <Image source={{ uri: activePhotoUri }} style={styles.photoPreview} resizeMode="contain" /> : null}
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={closePhotoModal}>
                <Text allowFontScaling={false} style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingTop: 15,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#38bdf8',
    marginBottom: 15,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#38bdf8',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 10,
    fontSize: 14,
  },
  feedbackCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: 100,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  type: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  rating: {
    fontSize: 12,
    color: '#f39c12',
    marginBottom: 6,
  },
  comment: {
    fontSize: 13,
    color: '#e2e8f0',
    marginBottom: 6,
  },
  photoNote: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 12,
  },
  replyBox: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  replyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 3,
  },
  replyText: {
    fontSize: 12,
    color: '#f8fafc',
  },
  noReply: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  photoViewButton: {
    backgroundColor: '#334155',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  date: {
    fontSize: 11,
    color: '#95a5a6',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
  },
  photoModalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    maxHeight: '80%',
  },
  photoPreview: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 10,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 10,
    fontSize: 14,
    color: '#f8fafc',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  modalCancel: {
    backgroundColor: '#334155',
  },
  modalSubmit: {
    backgroundColor: '#2563eb',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default FeedbackList;
