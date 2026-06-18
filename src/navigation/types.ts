export type MainTabParamList = {
  Dashboard: undefined;
  Professions: undefined;
  RegisterBusiness: undefined;
  Subscription: undefined;
  Chats: undefined;
  Account: undefined;
  ProfileEdit: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  AdminLogin: undefined;
  MainTabs: undefined;
  Cart: undefined;
  Withdrawal: undefined;
  Transactions: undefined;
  OrderDetails: {
    orderId: string;
  };
  BusinessDetails: {
    businessId: string;
  };
  SellerProfile: {
    userId: string;
  };
};

type AppNavigate = {
  (screen: 'Login'): void;
  (screen: 'Signup'): void;
  (screen: 'AdminLogin'): void;
  (screen: 'Cart'): void;
  (screen: 'Withdrawal'): void;
  (screen: 'Transactions'): void;
  (screen: keyof MainTabParamList): void;
  (screen: 'OrderDetails', params: RootStackParamList['OrderDetails']): void;
  (screen: 'BusinessDetails', params: RootStackParamList['BusinessDetails']): void;
  (screen: 'SellerProfile', params: RootStackParamList['SellerProfile']): void;
};

type AppReplace = {
  (screen: 'OrderDetails', params: RootStackParamList['OrderDetails']): void;
  (screen: 'BusinessDetails', params: RootStackParamList['BusinessDetails']): void;
  (screen: 'SellerProfile', params: RootStackParamList['SellerProfile']): void;
};

export type AppNavigation = {
  navigate: AppNavigate;
  replace: AppReplace;
  goBack: () => void;
};

export type MainTabsScreenProps<T extends keyof MainTabParamList> = {
  navigation: AppNavigation;
};

export type LoginScreenProps = {
  navigation: AppNavigation;
};

export type SignupScreenProps = {
  navigation: AppNavigation;
};

export type AdminLoginScreenProps = {
  navigation: AppNavigation;
};

export type CartScreenProps = {
  navigation: AppNavigation;
};

export type WithdrawalScreenProps = {
  navigation: AppNavigation;
};

export type TransactionsScreenProps = {
  navigation: AppNavigation;
};

export type OrderDetailsScreenProps = {
  navigation: AppNavigation;
  route: {
    params: RootStackParamList['OrderDetails'];
  };
};

export type BusinessDetailsScreenProps = {
  navigation: AppNavigation;
  route: {
    params: RootStackParamList['BusinessDetails'];
  };
};

export type SellerProfileScreenProps = {
  navigation: AppNavigation;
  route: {
    params: RootStackParamList['SellerProfile'];
  };
};
