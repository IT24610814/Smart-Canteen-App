import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Alert,
} from 'react-native';
import api from '../../shared/api/axiosConfig';

const MyOrders = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/customer/orders');
            setOrders(data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrders();
        setRefreshing(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return '#f39c12';
            case 'completed':
                return '#27ae60';
            case 'void':
                return '#e74c3c';
            case 'refunded':
                return '#3498db';
            default:
                return '#95a5a6';
        }
    };

    const renderOrderCard = ({ item }) => (
        <TouchableOpacity
            style={styles.orderCard}
            onPress={() => Alert.alert('Info', 'Order detail screen is not configured yet.')}
        >
            <View style={styles.orderHeader}>
                <Text allowFontScaling={false} style={styles.orderId}>{item.orderId}</Text>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) },
                    ]}
                >
                    <Text allowFontScaling={false} style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
            </View>
            <Text allowFontScaling={false} style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <View style={styles.summaryBlock}>
                <View style={styles.amountRow}>
                    <Text allowFontScaling={false} style={styles.label}>Subtotal:</Text>
                    <Text allowFontScaling={false} style={styles.value}>Rs. {Number(item.subtotal || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.amountRow}>
                    <Text allowFontScaling={false} style={styles.label}>Daily Savings:</Text>
                    <Text allowFontScaling={false} style={styles.discountValue}>- Rs. {Number(item.dailyDiscountTotal || 0).toFixed(2)}</Text>
                </View>
                {Number(item.seasonalPromoDiscount || 0) > 0 ? (
                    <View style={styles.amountRow}>
                        <Text allowFontScaling={false} style={styles.label}>Seasonal Savings:</Text>
                        <Text allowFontScaling={false} style={styles.discountValue}>- Rs. {Number(item.seasonalPromoDiscount || 0).toFixed(2)}</Text>
                    </View>
                ) : null}
                <View style={styles.amountRow}>
                    <Text allowFontScaling={false} style={styles.label}>Total Savings:</Text>
                    <Text allowFontScaling={false} style={styles.discountValue}>- Rs. {Number(item.totalDiscount || 0).toFixed(2)}</Text>
                </View>
            </View>
            <View style={styles.amountRow}>
                <Text allowFontScaling={false} style={styles.label}>Payable:</Text>
                <Text allowFontScaling={false} style={styles.amount}>Rs. {Number(item.payableAmount || 0).toFixed(2)}</Text>
            </View>
            <Text allowFontScaling={false} style={styles.itemCount}>{item.items.length} item(s)</Text>
        </TouchableOpacity>
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
            {error ? <Text allowFontScaling={false} style={styles.errorText}>{error}</Text> : null}
            <FlatList
                data={orders}
                renderItem={renderOrderCard}
                keyExtractor={(item) => item._id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text allowFontScaling={false} style={styles.emptyText}>No orders yet</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#ef4444',
        marginBottom: 10,
        fontSize: 14,
    },
    orderCard: {
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#f8fafc',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    date: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 8,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    summaryBlock: {
        backgroundColor: '#0f172a',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#94a3b8',
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    discountValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#38bdf8',
    },
    amount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#38bdf8',
    },
    itemCount: {
        fontSize: 12,
        color: '#94a3b8',
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
});

export default MyOrders;
