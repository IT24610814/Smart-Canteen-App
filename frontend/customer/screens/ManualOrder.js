import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { customerService, orderService } from '../../shared/api/services';

const CUSTOMER_CART_KEY = 'customerCart';

const ManualOrder = ({ navigation, route }) => {
    const [menu, setMenu] = useState([]);
    const [seasonalPromo, setSeasonalPromo] = useState(null);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [cart, setCart] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [summaryOpen, setSummaryOpen] = useState(false);

    const persistCart = async (nextCart) => {
        try {
            const compact = Object.entries(nextCart).reduce((acc, [key, qty]) => {
                const parsedQty = Number(qty || 0);
                if (parsedQty > 0) {
                    acc[key] = parsedQty;
                }
                return acc;
            }, {});
            await AsyncStorage.setItem(CUSTOMER_CART_KEY, JSON.stringify(compact));
        } catch (_err) {
            // Non-blocking persistence.
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [menuRes, promoRes, pendingRes] = await Promise.all([
                customerService.browseMenu(),
                customerService.getActivePromotions(),
                orderService.getMyPendingOrder(),
            ]);

            const menuData = menuRes.data || [];
            const pendingData = pendingRes.data || null;
            let seededCart = {};

            const storedCartRaw = await AsyncStorage.getItem(CUSTOMER_CART_KEY);
            if (storedCartRaw) {
                seededCart = JSON.parse(storedCartRaw) || {};
            }

            if (pendingData?.items?.length) {
                pendingData.items.forEach((item) => {
                    seededCart[String(item.menuItemId)] = item.quantity;
                });
            }

            setMenu(menuData);
            setSeasonalPromo(promoRes.data?.activeSeasonalPromo || null);
            setPendingOrder(pendingData);
            setCart(seededCart);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load order data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    useEffect(() => {
        if (route?.params?.openSummary) {
            setSummaryOpen(true);
        }
    }, [route?.params?.openSummary, route?.params?.triggerAt]);

    useEffect(() => {
        if (route?.params?.cartSnapshot) {
            const snapshot = route.params.cartSnapshot;
            setCart(snapshot);
            persistCart(snapshot);
        }
    }, [route?.params?.cartSnapshot, route?.params?.triggerAt]);

    const selectedItems = useMemo(
        () => menu.filter((item) => Number(cart[item._id] || 0) > 0),
        [menu, cart]
    );

    const summary = useMemo(() => {
        let subtotal = 0;
        let dailySavings = 0;

        selectedItems.forEach((item) => {
            const qty = Number(cart[item._id] || 0);
            const unitPrice = Number(item.price || 0);
            const dailyDiscountPercentage = Number(item.dailyDiscount?.discountPercentage || 0);
            const lineSubtotal = unitPrice * qty;
            const lineDailySavings = (unitPrice * dailyDiscountPercentage * qty) / 100;
            subtotal += lineSubtotal;
            dailySavings += lineDailySavings;
        });

        const subtotalAfterDaily = subtotal - dailySavings;
        const seasonalPercentage = Number(seasonalPromo?.discountPercentage || 0);
        const seasonalSavings = (subtotalAfterDaily * seasonalPercentage) / 100;
        const totalSavings = dailySavings + seasonalSavings;
        const payable = subtotal - totalSavings;

        return {
            subtotal,
            dailySavings,
            seasonalSavings,
            totalSavings,
            payable,
        };
    }, [selectedItems, cart, seasonalPromo]);

    const savePendingOrder = async () => {
        if (!selectedItems.length) {
            setError('Add at least one item to create an order');
            return;
        }

        setSaving(true);
        try {
            const items = selectedItems.map((item) => ({
                menuItemId: item._id,
                quantity: Number(cart[item._id] || 0),
            }));

            let response;
            if (pendingOrder?._id) {
                response = await orderService.updatePendingOrder(pendingOrder._id, items);
            } else {
                response = await orderService.createOrder(items);
            }

            setPendingOrder(response.data.order);
            await AsyncStorage.setItem(CUSTOMER_CART_KEY, JSON.stringify(cart));
            setError('');
            return response.data.order;
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save pending order');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const cancelPendingOrder = async () => {
        if (!pendingOrder?._id) {
            return;
        }

        setSaving(true);
        try {
            await orderService.voidOrder(pendingOrder._id);
            setPendingOrder(null);
            setCart({});
            await AsyncStorage.removeItem(CUSTOMER_CART_KEY);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel order');
        } finally {
            setSaving(false);
        }
    };

    const proceedToPayment = async () => {
        const order = await savePendingOrder();
        if (order?._id) {
            setSummaryOpen(false);
            navigation.navigate('Billing');
        }
    };

    const adjustSummaryQty = (item, delta) => {
        const key = String(item._id);
        const current = Number(cart[key] || 0);
        const available = Math.max(0, Number(item.quantity || 0));
        const next = Math.max(0, Math.min(available, current + delta));

        const nextCart = { ...cart };
        if (next <= 0) {
            delete nextCart[key];
        } else {
            nextCart[key] = next;
        }

        setCart(nextCart);
        persistCart(nextCart);
    };

    const backToMenuToAddItems = () => {
        setSummaryOpen(false);
        navigation.navigate('Menu');
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#38bdf8" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!!error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.contentCard}>
                <Text style={styles.infoTitle}>Order Page</Text>
                <Text style={styles.infoText}>Items selected from Menu: {selectedItems.length}</Text>
                <Text style={styles.infoText}>Total quantity: {Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0)}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setSummaryOpen(true)}>
                    <Text style={styles.primaryBtnText}>View Order Summary</Text>
                </TouchableOpacity>
                {pendingOrder ? (
                    <TouchableOpacity style={styles.voidBtn} onPress={cancelPendingOrder} disabled={saving}>
                        <Text style={styles.primaryBtnText}>Cancel Pending Order</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <Modal transparent visible={summaryOpen} animationType="fade" onRequestClose={() => setSummaryOpen(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.summaryHeader}>
                            <Text style={styles.summaryTitle}>Order Summary</Text>
                            <Text style={styles.summarySubtitle}>Items: {selectedItems.length}</Text>
                        </View>

                        <View style={styles.divider} />

                        {/* Items List */}
                        <View style={styles.itemsSection}>
                            {selectedItems.length === 0 ? (
                                <Text style={styles.noItems}>No items selected</Text>
                            ) : (
                                selectedItems.map((item) => {
                                    const qty = Number(cart[item._id] || 0);
                                    const price = Number(item.price || 0);
                                    const itemSubtotal = price * qty;
                                    const dailyDiscountPercent = Number(item.dailyDiscount?.discountPercentage || 0);
                                    const dailyDiscountAmt = (price * dailyDiscountPercent * qty) / 100;
                                    const lineTotal = itemSubtotal - dailyDiscountAmt;

                                    return (
                                        <View key={item._id} style={styles.itemRowWrap}>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName}>{item.name}</Text>
                                                {dailyDiscountPercent > 0 && (
                                                    <Text style={styles.itemDiscount}>Daily Discount: {dailyDiscountPercent}% off</Text>
                                                )}
                                            </View>
                                            <View style={styles.itemQtyPrice}>
                                                <Text style={styles.itemQty}>x{qty}</Text>
                                                <Text style={styles.itemPrice}>Rs. {lineTotal.toFixed(2)}</Text>
                                            </View>
                                            <View style={styles.qtyAdjustRow}>
                                                <TouchableOpacity style={styles.qtyAdjustBtn} onPress={() => adjustSummaryQty(item, -1)}>
                                                    <Text style={styles.qtyAdjustBtnText}>−</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.qtyAdjustBtn, qty >= Math.max(0, Number(item.quantity || 0)) && styles.disabledBtn]}
                                                    onPress={() => adjustSummaryQty(item, 1)}
                                                    disabled={qty >= Math.max(0, Number(item.quantity || 0))}
                                                >
                                                    <Text style={styles.qtyAdjustBtnText}>+</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        <View style={styles.divider} />

                        {/* Totals Section */}
                        <View style={styles.totalsSection}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Subtotal</Text>
                                <Text style={styles.totalValue}>Rs. {summary.subtotal.toFixed(2)}</Text>
                            </View>
                            {summary.dailySavings > 0 && (
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, styles.discountLabel]}>Daily Savings</Text>
                                    <Text style={[styles.totalValue, styles.discountValue]}>-Rs. {summary.dailySavings.toFixed(2)}</Text>
                                </View>
                            )}
                            {summary.seasonalSavings > 0 && (
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, styles.discountLabel]}>Seasonal Savings</Text>
                                    <Text style={[styles.totalValue, styles.discountValue]}>-Rs. {summary.seasonalSavings.toFixed(2)}</Text>
                                </View>
                            )}
                            {summary.totalSavings > 0 && (
                                <View style={styles.totalRow}>
                                    <Text style={[styles.totalLabel, styles.discountLabel]}>Total Savings</Text>
                                    <Text style={[styles.totalValue, styles.discountValue]}>-Rs. {summary.totalSavings.toFixed(2)}</Text>
                                </View>
                            )}
                            <View style={styles.finalTotalRow}>
                                <Text style={styles.finalTotalLabel}>Amount to Pay</Text>
                                <Text style={styles.finalTotalValue}>Rs. {summary.payable.toFixed(2)}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Action Buttons */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.menuBtn} onPress={backToMenuToAddItems}>
                                <Text style={styles.primaryBtnText}>Add More Items</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryBtn, saving && styles.disabledBtn]}
                                onPress={proceedToPayment}
                                disabled={saving || selectedItems.length === 0}
                            >
                                <Text style={styles.primaryBtnText}>{saving ? 'Processing...' : 'Proceed to Payment'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.voidBtn, saving && styles.disabledBtn]}
                                onPress={async () => {
                                    if (pendingOrder) {
                                        await cancelPendingOrder();
                                    } else {
                                        setCart({});
                                        await persistCart({});
                                    }
                                    setSummaryOpen(false);
                                }}
                                disabled={saving}
                            >
                                <Text style={styles.primaryBtnText}>Cancel Order</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 10 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: { color: '#ef4444', paddingHorizontal: 12, marginBottom: 8, fontWeight: '600' },
    contentCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginHorizontal: 10, elevation: 2, marginBottom: 12 },
    infoTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
    infoText: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
    primaryBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
    voidBtn: { backgroundColor: '#ef4444', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 8 },
    closeBtn: { backgroundColor: '#334155', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginBottom: 8 },
    menuBtn: { backgroundColor: '#334155', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginBottom: 8 },
    primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    disabledBtn: { opacity: 0.5 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 14 },
    modalCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, maxHeight: '90%' },
    modalActions: { marginTop: 4 },

    // Summary Header
    summaryHeader: { marginBottom: 10 },
    summaryTitle: { fontSize: 19, fontWeight: '700', color: '#f8fafc' },
    summarySubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 10 },
    noItems: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 },

    // Items Section
    itemsSection: { marginBottom: 6 },
    itemRowWrap: { flexDirection: 'row', marginBottom: 10, alignItems: 'center', backgroundColor: '#0f172a', padding: 10, borderRadius: 8 },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 13, fontWeight: '600', color: '#f8fafc' },
    itemDiscount: { fontSize: 11, color: '#ef4444', marginTop: 3, fontStyle: 'italic' },
    itemQtyPrice: { marginHorizontal: 8, alignItems: 'center' },
    itemQty: { fontSize: 12, color: '#94a3b8', marginBottom: 2 },
    itemPrice: { fontSize: 13, fontWeight: '700', color: '#f8fafc' },
    qtyAdjustRow: { flexDirection: 'row', gap: 4 },
    qtyAdjustBtn: { backgroundColor: '#2563eb', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, minWidth: 34, alignItems: 'center' },
    qtyAdjustBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },

    // Totals Section
    totalsSection: { backgroundColor: '#0f172a', padding: 10, borderRadius: 8, marginBottom: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    totalLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    totalValue: { fontSize: 12, fontWeight: '600', color: '#f8fafc' },
    discountLabel: { color: '#ef4444' },
    discountValue: { color: '#ef4444', fontWeight: '700' },
    finalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderTopColor: '#334155' },
    finalTotalLabel: { fontSize: 13, fontWeight: '700', color: '#f8fafc' },
    finalTotalValue: { fontSize: 15, fontWeight: '700', color: '#38bdf8' },
});

export default ManualOrder;
