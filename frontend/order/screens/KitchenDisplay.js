import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { orderService } from '../../shared/api/services';

const KitchenDisplay = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState('');

    const loadOrders = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const { data } = await orderService.getKitchenDisplay(statusFilter === 'all' ? undefined : statusFilter);
            setOrders(data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load kitchen display');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadOrders(true);
    }, [loadOrders]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadOrders(false);
        }, 10000);

        return () => clearInterval(interval);
    }, [loadOrders]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadOrders(false);
        setRefreshing(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return '#f59e0b';
            case 'completed':
                return '#16a34a';
            case 'void':
                return '#ef4444';
            case 'refunded':
                return '#6366f1';
            default:
                return '#64748b';
        }
    };

    const renderOrder = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.rowBetween}>
                <Text allowFontScaling={false} style={styles.orderId}>{item.orderId}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text allowFontScaling={false} style={styles.badgeText}>{item.status}</Text>
                </View>
            </View>
            <Text allowFontScaling={false} style={styles.receivedAt}>Received: {new Date(item.createdAt).toLocaleString()}</Text>
            <Text allowFontScaling={false} style={styles.amount}>Total: Rs. {Number(item.payableAmount || 0).toFixed(2)}</Text>
            {(item.items || []).map((food, index) => (
                <Text allowFontScaling={false} key={`${item._id}-${index}`} style={styles.foodLine}>• {food.itemName} x {food.quantity}</Text>
            ))}
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#38bdf8" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text allowFontScaling={false} style={styles.title}>Kitchen Display</Text>
            {!!error ? <Text allowFontScaling={false} style={styles.error}>{error}</Text> : null}

            <View style={styles.filters}>
                {['all', 'pending', 'completed', 'void', 'refunded'].map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[styles.filterBtn, statusFilter === status && styles.filterBtnActive]}
                        onPress={() => setStatusFilter(status)}
                    >
                        <Text allowFontScaling={false} style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>{status}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={orders}
                renderItem={renderOrder}
                keyExtractor={(item) => item._id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={<Text allowFontScaling={false} style={styles.empty}>No kitchen orders found</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingTop: 12,
        paddingHorizontal: 10,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#38bdf8',
        marginBottom: 8,
    },
    error: { color: '#ef4444', marginBottom: 8 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    filterBtn: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
    filterBtnActive: { backgroundColor: '#2563eb', borderColor: '#38bdf8' },
    filterText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
    filterTextActive: { color: '#ffffff' },
    card: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 10, elevation: 1 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderId: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
    badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
    badgeText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
    receivedAt: { color: '#94a3b8', marginTop: 6, fontSize: 12 },
    amount: { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#38bdf8' },
    foodLine: { marginTop: 3, color: '#e2e8f0', fontSize: 13 },
    empty: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },
});

export default KitchenDisplay;
