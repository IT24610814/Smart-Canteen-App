import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { financeService, orderService } from '../../shared/api/services';
import api from '../../shared/api/axiosConfig';

const CUSTOMER_CART_KEY = 'customerCart';

const BillingSystem = ({ navigation }) => {
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paymentType, setPaymentType] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [email, setEmail] = useState('');
  const [stripePaymentMethodId, setStripePaymentMethodId] = useState('pm_card_visa');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [paidBillData, setPaidBillData] = useState(null);
  const [isTransactionComplete, setIsTransactionComplete] = useState(false);

  const resetBillingState = async () => {
    setPaymentType('cash');
    setAmountReceived('');
    setCardHolderName('');
    setCardNumber('');
    setExpiryDate('');
    setCvc('');
    setCountry('Sri Lanka');
    setEmail('');
    setStripePaymentMethodId('pm_card_visa');
    setShowGatewayModal(false);
    setPaidBillData(null);
    setSuccess('');
    setError('');
    setIsTransactionComplete(false);
    await loadPendingOrder();
  };

  const loadPendingOrder = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await orderService.getMyPendingOrder();
      setPendingOrder(data || null);
      if (data?.payableAmount) {
        setAmountReceived(String(data.payableAmount));
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending order');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateChange = () => {
    if (paymentType !== 'cash' || !pendingOrder) return '0.00';
    const received = Number(amountReceived || 0);
    const total = Number(pendingOrder.payableAmount || 0);
    if (received < total) return '0.00';
    return (received - total).toFixed(2);
  };

  const buildReceiptContent = (source) => {
    return [
      '============================================',
      '              SMART CANTEEN SYSTEM         ',
      '                  Receipt                  ',
      '============================================',
      `Order ID: ${source.order.orderId}`,
      `Transaction ID: ${source.transactionId || 'N/A'}`,
      `Date: ${new Date(source.paidAt).toLocaleString()}`,
      `Payment Method: ${source.paymentType === 'cash' ? 'Cash' : 'Card'}`,
      '--------------------------------------------',
      'Items:',
      ...(source.order.items || []).map((item) => {
        const itemDiscount = Number(item.discount || 0);
        const discountAmt = itemDiscount > 0 ? (Number(item.lineTotal || 0) * itemDiscount / 100) : 0;
        const lineTotal = Number(item.lineTotal || 0);
        return `  ${item.itemName} x${item.quantity}${itemDiscount > 0 ? ` [${itemDiscount}% off]` : ''}  Rs. ${lineTotal.toFixed(2)}`;
      }),
      '--------------------------------------------',
      `Subtotal           : Rs. ${Number(source.order.subtotal || 0).toFixed(2)}`,
      source.order.dailyDiscountTotal > 0 ? `Daily Discounts    : -Rs. ${Number(source.order.dailyDiscountTotal || 0).toFixed(2)}` : null,
      source.order.seasonalPromoDiscount > 0 ? `Seasonal Discount  : -Rs. ${Number(source.order.seasonalPromoDiscount || 0).toFixed(2)}` : null,
      `Total Savings      : -Rs. ${Number(source.order.totalDiscount || 0).toFixed(2)}`,
      '============================================',
      `FINAL AMOUNT       : Rs. ${Number(source.order.payableAmount || 0).toFixed(2)}`,
      source.paymentType === 'cash' ? `Amount Received    : Rs. ${Number(source.amountReceived || 0).toFixed(2)}` : null,
      source.paymentType === 'cash' ? `Change             : Rs. ${calculateChange()}` : null,
      '============================================',
      '         Thank you for your order!          ',
      '============================================',
    ].filter(Boolean).join('\n');
  };

  const saveReceiptToBackend = async (source) => {
    try {
      const receiptContent = buildReceiptContent(source);
      const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
      
      const formData = new FormData();
      formData.append('receipt', blob, `receipt_${source.transactionId || source.order.orderId}.txt`);
      formData.append('transactionId', source.transactionId || 'N/A');
      formData.append('orderId', source.order.orderId);

      await api.post('/save-receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (err) {
      console.error('Error saving receipt to backend:', err);
      // Don't throw error, allow transaction to continue
    }
  };

  const startNewOrder = () => {
    resetBillingState();
    if (navigation?.navigate) {
      navigation.navigate('Menu'); // Navigate to Menu to show updated stock
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPendingOrder();
    }, [loadPendingOrder])
  );

  const completePayment = async () => {
    if (!pendingOrder?._id) {
      setError('No pending order available for billing');
      return;
    }

    const received = Number(amountReceived || 0);
    if (!Number.isFinite(received) || received < Number(pendingOrder.payableAmount || 0)) {
      setError('Amount received must be at least payable amount');
      return;
    }

    if (paymentType === 'card' && (!cardHolderName.trim() || !cardNumber.trim() || !expiryDate.trim() || !cvc.trim() || !country.trim())) {
      setError('Card holder, card number, expiry, CVC and country are required for card payment');
      return;
    }

    setPaying(true);
    try {
      const paymentMethodId = paymentType === 'card'
        ? stripePaymentMethodId.trim() || 'pm_card_visa'
        : undefined;

      const payload = {
        orderId: pendingOrder._id,
        paymentType,
        amountReceived: received,
        stripePaymentMethodId: paymentType === 'card' ? paymentMethodId : undefined,
        cardDetails: paymentType === 'card'
          ? {
              cardHolderName: cardHolderName.trim(),
              cardNumber: cardNumber.trim(),
              expiryDate: expiryDate.trim(),
              cvc: cvc.trim(),
              country: country.trim(),
              email: email.trim() || undefined,
            }
          : null,
      };

      const { data } = await financeService.createTransaction(payload);
      setSuccess(`Payment complete. Transaction ${data.transaction?.transactionId || ''}`.trim());
      
      const billData = {
        transactionId: data.transaction?.transactionId,
        paymentType,
        amountReceived: received,
        order: pendingOrder,
        paidAt: new Date().toISOString(),
      };
      
      setPaidBillData(billData);

      await AsyncStorage.removeItem(CUSTOMER_CART_KEY);

      setPendingOrder(null);
      setError('');
      setIsTransactionComplete(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const downloadBill = async () => {
    const source = paidBillData || {
      transactionId: 'N/A',
      paymentType,
      amountReceived: amountReceived || '0',
      order: pendingOrder,
      paidAt: new Date().toISOString(),
    };

    if (!source?.order) {
      setError('No bill data available');
      return;
    }

    // Save receipt to backend when download is clicked
    await saveReceiptToBackend(source);

    const content = buildReceiptContent(source);

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `receipt_${source.order.orderId || 'bill'}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return;
    }

    setSuccess('Bill is ready. On mobile, this demo shows bill generation confirmation.');
  };

  const openCardGateway = () => {
    setStripePaymentMethodId('pm_card_visa');
    setShowGatewayModal(true);
  };

  const confirmCardGatewayPayment = async () => {
    await completePayment();
    setShowGatewayModal(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  // Show empty state only if no pending order AND no completed transaction
  if (!pendingOrder && !isTransactionComplete) {
    return (
      <View style={styles.center}>
        <Text allowFontScaling={false} style={styles.emptyTitle}>No Pending Order</Text>
        <Text allowFontScaling={false} style={styles.emptySub}>Create an order first from the menu and order summary flow.</Text>
        {paidBillData ? (
          <TouchableOpacity style={styles.downloadBtn} onPress={downloadBill}>
            <Text allowFontScaling={false} style={styles.payText}>Download Bill</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  // Use paidBillData if transaction complete, otherwise use pendingOrder
  const displayOrder = isTransactionComplete ? paidBillData?.order : pendingOrder;

  return (
    <View style={styles.container}>
      <Text allowFontScaling={false} style={styles.title}>Billing System</Text>
      {!!error ? <Text allowFontScaling={false} style={styles.error}>{error}</Text> : null}
      {!!success ? <Text allowFontScaling={false} style={styles.success}>{success}</Text> : null}

      {/* Bill Display Section */}
      <View style={styles.billCard}>
        <View style={styles.billHeader}>
          <Text allowFontScaling={false} style={styles.billTitle}>Generated Bill</Text>
          <Text allowFontScaling={false} style={styles.billOrderId}>Order ID: {displayOrder?.orderId || 'N/A'}</Text>
          <Text allowFontScaling={false} style={styles.billDate}>{new Date().toLocaleDateString()}</Text>
        </View>

        {/* Itemized Items */}
        <View style={styles.billDivider} />
        <Text allowFontScaling={false} style={styles.billSectionTitle}>Items:</Text>
        {(displayOrder?.items || []).map((item, idx) => {
          const diascount = Number(item.discount || 0);
          const discountAmount = diascount > 0 ? (Number(item.lineTotal || 0) * diascount / 100).toFixed(2) : 0;
          return (
            <View key={idx} style={styles.itemRow}>
              <Text allowFontScaling={false} style={styles.itemName}>{item.itemName} x{item.quantity}</Text>
              {diascount > 0 && <Text allowFontScaling={false} style={styles.itemDiscount}>({diascount}% off)</Text>}
              <Text allowFontScaling={false} style={styles.itemTotal}>Rs. {Number(item.lineTotal || 0).toFixed(2)}</Text>
            </View>
          );
        })}

        {/* Bill Totals */}
        <View style={styles.billDivider} />
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text allowFontScaling={false} style={styles.totalLabel}>Subtotal</Text>
            <Text allowFontScaling={false} style={styles.totalValue}>Rs. {Number(displayOrder?.subtotal || 0).toFixed(2)}</Text>
          </View>
          {Number(displayOrder?.dailyDiscountTotal || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text allowFontScaling={false} style={[styles.totalLabel, styles.discountLabel]}>Daily Discounts</Text>
              <Text allowFontScaling={false} style={[styles.totalValue, styles.discountValue]}>-Rs. {Number(displayOrder?.dailyDiscountTotal || 0).toFixed(2)}</Text>
            </View>
          )}
          {Number(displayOrder?.seasonalPromoDiscount || 0) > 0 && (
            <View style={styles.totalRow}>
              <Text allowFontScaling={false} style={[styles.totalLabel, styles.discountLabel]}>Seasonal Discount</Text>
              <Text allowFontScaling={false} style={[styles.totalValue, styles.discountValue]}>-Rs. {Number(displayOrder?.seasonalPromoDiscount || 0).toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text allowFontScaling={false} style={[styles.totalLabel, styles.discountLabel]}>Total Savings</Text>
            <Text allowFontScaling={false} style={[styles.totalValue, styles.discountValue]}>-Rs. {Number(displayOrder?.totalDiscount || 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.finalTotalRow]}>
            <Text allowFontScaling={false} style={styles.finalTotalLabel}>TOTAL AMOUNT</Text>
            <Text allowFontScaling={false} style={styles.finalTotalValue}>Rs. {Number(displayOrder?.payableAmount || 0).toFixed(2)}</Text>
          </View>

          {/* Cash Change Display */}
          {isTransactionComplete && paymentType === 'cash' && (
            <>
              <View style={styles.totalRow}>
                <Text allowFontScaling={false} style={styles.totalLabel}>Amount Received</Text>
                <Text allowFontScaling={false} style={styles.totalValue}>Rs. {Number(amountReceived || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text allowFontScaling={false} style={[styles.totalLabel, styles.changeLabel]}>Change</Text>
                <Text allowFontScaling={false} style={[styles.totalValue, styles.changeValue]}>Rs. {calculateChange()}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Payment Section */}
      {!isTransactionComplete && (
        <View style={styles.paymentCard}>
          <Text allowFontScaling={false} style={styles.paymentTitle}>Select Payment Method</Text>
          
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodBtn, paymentType === 'cash' && styles.methodBtnActive]}
              onPress={() => setPaymentType('cash')}
            >
              <Text allowFontScaling={false} style={[styles.methodText, paymentType === 'cash' && styles.methodTextActive]}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodBtn, paymentType === 'card' && styles.methodBtnActive]}
              onPress={() => setPaymentType('card')}
            >
              <Text allowFontScaling={false} style={[styles.methodText, paymentType === 'card' && styles.methodTextActive]}>Card</Text>
            </TouchableOpacity>
          </View>

          {paymentType === 'cash' && (
            <TextInput
              style={styles.input}
              value={amountReceived}
              onChangeText={setAmountReceived}
              keyboardType="numeric"
              placeholder="Amount received"
            />
          )}

          {paymentType === 'cash' ? (
            <TouchableOpacity
              style={[styles.payBtn, paying && styles.disabled]}
              onPress={completePayment}
              disabled={paying}
            >
              <Text allowFontScaling={false} style={styles.payText}>{paying ? 'Processing...' : 'Complete Payment'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.payBtn, paying && styles.disabled]}
              onPress={openCardGateway}
              disabled={paying}
            >
              <Text allowFontScaling={false} style={styles.payText}>{paying ? 'Processing...' : 'Open Card Payment'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Transaction Complete Section */}
      {isTransactionComplete && (
        <View style={styles.completeCard}>
          <Text allowFontScaling={false} style={styles.successIcon}>✓</Text>
          <Text allowFontScaling={false} style={styles.completeTitle}>Transaction Completed!</Text>
          <Text allowFontScaling={false} style={styles.completeSubtitle}>Payment recorded successfully</Text>
          
          <View style={styles.completeBtnRow}>
            <TouchableOpacity style={styles.downloadBtn} onPress={downloadBill}>
              <Text allowFontScaling={false} style={styles.payText}>Download Bill</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.newTransactionBtn} onPress={startNewOrder}>
              <Text allowFontScaling={false} style={styles.payText}>New Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Card Gateway Modal */}
      <Modal transparent visible={showGatewayModal} animationType="slide" onRequestClose={() => setShowGatewayModal(false)}>
        <View style={styles.gatewayBackdrop}>
          <View style={styles.gatewayCard}>
            <View style={styles.gatewayHeader}>
              <Text allowFontScaling={false} style={styles.gatewayTitle}>Pay with card</Text>
              <Text allowFontScaling={false} style={styles.gatewaySubtitle}>Secure, fast checkout with Stripe</Text>
            </View>

            <View style={styles.paymentBrandRow}>
              <View style={styles.cardBrandPill}>
                <Text allowFontScaling={false} style={styles.brandIcon}>💳</Text>
                <Text allowFontScaling={false} style={styles.brandText}>Card</Text>
              </View>
              <Text allowFontScaling={false} style={styles.linkText}>Secure, fast checkout with Link</Text>
            </View>

            <View style={styles.orderPaySummary}>
              <Text allowFontScaling={false} style={styles.summaryLabel}>Amount</Text>
              <Text allowFontScaling={false} style={styles.summaryAmount}>Rs. {Number(pendingOrder?.payableAmount || 0).toFixed(2)}</Text>
            </View>

            <TextInput
              style={styles.input}
              value={cardHolderName}
              onChangeText={setCardHolderName}
              placeholder="Cardholder name"
              placeholderTextColor="#94a3b8"
            />

            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="Card number"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
            />

            <View style={styles.inlineRow}>
              <TextInput
                style={[styles.input, styles.expiryInput]}
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="MM/YY"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={5}
              />
              <TextInput
                style={[styles.input, styles.cvcInput]}
                value={cvc}
                onChangeText={setCvc}
                placeholder="CVC"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              placeholderTextColor="#94a3b8"
            />

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email (optional)"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={[styles.payBtn, paying && styles.disabled]}
              onPress={confirmCardGatewayPayment}
              disabled={paying}
            >
              <Text allowFontScaling={false} style={styles.payText}>{paying ? 'Processing...' : 'Pay now'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeGatewayBtn} onPress={() => setShowGatewayModal(false)}>
              <Text allowFontScaling={false} style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#38bdf8', marginBottom: 12 },
  
  // Bill Card Styles
  billCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, elevation: 2, marginBottom: 12 },
  billHeader: { marginBottom: 10 },
  billTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  billOrderId: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  billDate: { fontSize: 11, color: '#94a3b8' },
  billDivider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },
  billSectionTitle: { fontSize: 13, fontWeight: '600', color: '#e2e8f0', marginBottom: 6 },
  
  // Item Display
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  itemName: { fontSize: 12, color: '#f1f5f9', fontWeight: '500', flex: 1 },
  itemDiscount: { fontSize: 10, color: '#ef4444', marginHorizontal: 4 },
  itemTotal: { fontSize: 12, fontWeight: '600', color: '#f8fafc', minWidth: 60, textAlign: 'right' },
  
  // Totals Section
  totalsSection: { marginTop: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  totalValue: { fontSize: 12, color: '#f8fafc', fontWeight: '600' },
  discountLabel: { color: '#ef4444' },
  discountValue: { color: '#ef4444' },
  finalTotalRow: { paddingTop: 8, borderTopWidth: 2, borderTopColor: '#334155', marginTop: 4 },
  finalTotalLabel: { fontSize: 13, fontWeight: '700', color: '#f8fafc' },
  finalTotalValue: { fontSize: 16, fontWeight: '700', color: '#38bdf8' },
  changeLabel: { color: '#10b981' },
  changeValue: { color: '#10b981', fontWeight: '700' },
  
  // Payment Card
  paymentCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, elevation: 2, marginBottom: 12 },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: '#f8fafc', marginBottom: 10 },
  
  // Method Selection
  methodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  methodBtn: { flex: 1, borderWidth: 2, borderColor: '#334155', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: 'transparent', marginRight: 8 },
  methodBtnActive: { backgroundColor: '#2563eb', borderColor: '#38bdf8' },
  methodText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  methodTextActive: { color: '#ffffff' },
  
  // Input
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 8, backgroundColor: '#0f172a', color: '#f8fafc', paddingHorizontal: 10, paddingVertical: 10, marginBottom: 10, fontSize: 13 },
  
  // Buttons
  payBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  downloadBtn: { backgroundColor: '#38bdf8', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 6, flex: 1, marginRight: 5 },
  newTransactionBtn: { backgroundColor: '#334155', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 6, flex: 1, marginLeft: 5 },
  completeBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  closeGatewayBtn: { backgroundColor: '#334155', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  payText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  
  // Complete Card
  completeCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, elevation: 2, alignItems: 'center', marginBottom: 12 },
  successIcon: { fontSize: 40, color: '#10b981', fontWeight: '700', marginBottom: 8 },
  completeTitle: { fontSize: 18, fontWeight: '700', color: '#10b981', marginBottom: 4 },
  completeSubtitle: { fontSize: 13, color: '#10b981', marginBottom: 12 },
  
  // Messages
  error: { color: '#ef4444', marginBottom: 8, paddingHorizontal: 4, fontWeight: '600' },
  success: { color: '#10b981', marginBottom: 8, paddingHorizontal: 4, fontWeight: '600' },
  emptyTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 18 },
  emptySub: { color: '#94a3b8', marginTop: 4 },
  
  // Gateway Modal
  gatewayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  gatewayCard: { backgroundColor: '#1e293b', borderRadius: 24, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, maxHeight: '100%', width: '90%', alignSelf: 'center', maxWidth: 380, marginTop: 10 },
  gatewayHeader: { marginBottom: 16 },
  gatewayTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
  gatewaySubtitle: { color: '#94a3b8', fontSize: 14 },
  paymentBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  cardBrandPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  brandIcon: { fontSize: 16 },
  brandText: { fontSize: 14, fontWeight: '700', color: '#38bdf8' },
  linkText: { color: '#38bdf8', fontSize: 13, flex: 1, marginLeft: 12 },
  orderPaySummary: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 14 },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  inlineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  expiryInput: { width: 110 },
  cvcInput: { width: 80 },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 14, color: '#f8fafc', width: '100%' },
  payBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  closeGatewayBtn: { backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  payText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  closeText: { color: '#94a3b8', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
});

export default BillingSystem;
