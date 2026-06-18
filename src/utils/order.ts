import type { OrderStatus, PaymentMethod, PaymentStatus } from '../types/business';

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case 'placed':
      return 'Placed';
    case 'packed':
      return 'Packed';
    case 'outForDelivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Updated';
  }
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Unknown';
  }
}

export function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case 'flutterwave':
      return 'Flutterwave checkout';
    case 'bankTransfer':
      return 'Bank transfer';
    case 'walletAccount':
      return 'Wallet account';
    case 'cashOnDelivery':
      return 'Cash on delivery';
    default:
      return 'Payment';
  }
}

const activeOrderStages: OrderStatus[] = [
  'placed',
  'packed',
  'outForDelivery',
  'delivered',
];

export function normalizeOrderStatus(status?: string | null): OrderStatus {
  switch (status) {
    case 'confirmed':
      return 'packed';
    case 'warehouseVerified':
      return 'outForDelivery';
    case 'packed':
    case 'outForDelivery':
    case 'delivered':
    case 'cancelled':
      return status;
    case 'placed':
    default:
      return 'placed';
  }
}

export function getOrderProgress(orderStatus: OrderStatus) {
  if (orderStatus === 'cancelled') {
    return 0;
  }

  const statusIndex = activeOrderStages.indexOf(normalizeOrderStatus(orderStatus));
  return statusIndex < 0 ? 0 : (statusIndex + 1) / activeOrderStages.length;
}

export function getOrderStageLabels() {
  return activeOrderStages.map(getOrderStatusLabel);
}
