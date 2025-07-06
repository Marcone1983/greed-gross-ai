import { Platform } from 'react-native';
import Purchases, { 
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASE_TYPE 
} from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';

// ===========================
// REVENUECAT INTEGRATION
// ===========================

class RevenueCatService {
  constructor() {
    this.isConfigured = false;
    this.currentUserId = null;
    this.offerings = null;
    this.customerInfo = null;
    this.entitlements = {
      premium: 'premium_access',
      pro: 'pro_access'
    };
  }

  // Initialize RevenueCat
  async initialize(userId) {
    try {
      if (this.isConfigured) {
        console.log('RevenueCat already configured');
        return;
      }

      // Configure with your RevenueCat API keys
      const apiKey = Platform.select({
        ios: process.env.REVENUECAT_IOS_KEY || 'YOUR_IOS_API_KEY',
        android: process.env.REVENUECAT_ANDROID_KEY || 'YOUR_ANDROID_API_KEY'
      });

      if (!apiKey || apiKey.includes('YOUR_')) {
        console.warn('RevenueCat API key not configured');
        return false;
      }

      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure Purchases
      await Purchases.configure({
        apiKey,
        appUserID: userId,
        observerMode: false,
        useAmazon: false
      });

      this.isConfigured = true;
      this.currentUserId = userId;

      // Set up listeners
      this.setupListeners();

      // Fetch initial data
      await this.fetchCustomerInfo();
      await this.fetchOfferings();

      // Sync with Firebase
      await this.syncSubscriptionStatus();

      console.log('RevenueCat initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      this.isConfigured = false;
      return false;
    }
  }

  // Set up purchase listeners
  setupListeners() {
    // Customer info update listener
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      console.log('Customer info updated:', customerInfo);
      this.customerInfo = customerInfo;
      this.syncSubscriptionStatus();
    });

    // Should purchase promo product listener (iOS only)
    if (Platform.OS === 'ios') {
      Purchases.addShouldPurchasePromoProductListener(async ({ product }) => {
        console.log('Promo product:', product);
        // Handle promo product purchase
        return true; // Return true to continue with purchase
      });
    }
  }

  // Fetch customer info
  async fetchCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      this.customerInfo = customerInfo;
      return customerInfo;
    } catch (error) {
      console.error('Error fetching customer info:', error);
      return null;
    }
  }

  // Fetch available offerings
  async fetchOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      this.offerings = offerings;
      return offerings;
    } catch (error) {
      console.error('Error fetching offerings:', error);
      return null;
    }
  }

  // Get subscription status
  async getSubscriptionStatus() {
    try {
      if (!this.customerInfo) {
        await this.fetchCustomerInfo();
      }

      const entitlements = this.customerInfo?.entitlements?.active || {};
      
      return {
        isPremium: this.entitlements.premium in entitlements,
        isPro: this.entitlements.pro in entitlements,
        isActive: Object.keys(entitlements).length > 0,
        activeEntitlements: Object.keys(entitlements),
        expirationDate: this.getExpirationDate(entitlements),
        willRenew: this.checkWillRenew(entitlements)
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isPremium: false,
        isPro: false,
        isActive: false,
        activeEntitlements: [],
        expirationDate: null,
        willRenew: false
      };
    }
  }

  // Get expiration date from entitlements
  getExpirationDate(entitlements) {
    const dates = Object.values(entitlements)
      .map(e => e.expirationDate)
      .filter(d => d);
    
    if (dates.length === 0) return null;
    
    // Return the latest expiration date
    return dates.reduce((latest, date) => 
      new Date(date) > new Date(latest) ? date : latest
    );
  }

  // Check if subscription will renew
  checkWillRenew(entitlements) {
    return Object.values(entitlements).some(e => e.willRenew);
  }

  // Purchase a product
  async purchaseProduct(productIdentifier) {
    try {
      // Log purchase attempt
      await analytics().logEvent('purchase_attempt', {
        product_id: productIdentifier,
        user_id: this.currentUserId
      });

      // Find the product
      const product = this.findProduct(productIdentifier);
      if (!product) {
        throw new Error('Product not found');
      }

      // Make the purchase
      const { customerInfo, productIdentifier: purchasedProduct } = 
        await Purchases.purchaseStoreProduct(product);

      // Update local state
      this.customerInfo = customerInfo;

      // Log successful purchase
      await analytics().logEvent('purchase_success', {
        product_id: purchasedProduct,
        user_id: this.currentUserId,
        revenue: product.price
      });

      // Sync with Firebase
      await this.syncSubscriptionStatus();

      return {
        success: true,
        customerInfo,
        productIdentifier: purchasedProduct
      };
    } catch (error) {
      console.error('Purchase error:', error);

      // Log failed purchase
      await analytics().logEvent('purchase_failed', {
        product_id: productIdentifier,
        error_code: error.code,
        error_message: error.message
      });

      // Handle specific error cases
      if (error.userCancelled) {
        return {
          success: false,
          error: 'Purchase cancelled',
          userCancelled: true
        };
      }

      return {
        success: false,
        error: error.message || 'Purchase failed',
        errorCode: error.code
      };
    }
  }

  // Find product in offerings
  findProduct(productIdentifier) {
    if (!this.offerings?.current) return null;

    const packages = this.offerings.current.availablePackages;
    
    for (const pkg of packages) {
      if (pkg.storeProduct.identifier === productIdentifier) {
        return pkg.storeProduct;
      }
    }

    // Check all offerings
    for (const offering of Object.values(this.offerings.all)) {
      for (const pkg of offering.availablePackages) {
        if (pkg.storeProduct.identifier === productIdentifier) {
          return pkg.storeProduct;
        }
      }
    }

    return null;
  }

  // Restore purchases
  async restorePurchases() {
    try {
      await analytics().logEvent('restore_purchases_attempt');

      const customerInfo = await Purchases.restorePurchases();
      this.customerInfo = customerInfo;

      await analytics().logEvent('restore_purchases_success');
      await this.syncSubscriptionStatus();

      return {
        success: true,
        customerInfo,
        restoredEntitlements: Object.keys(customerInfo.entitlements.active)
      };
    } catch (error) {
      console.error('Restore purchases error:', error);
      
      await analytics().logEvent('restore_purchases_failed', {
        error_code: error.code,
        error_message: error.message
      });

      return {
        success: false,
        error: error.message || 'Restore failed'
      };
    }
  }

  // Sync subscription status with Firebase
  async syncSubscriptionStatus() {
    try {
      if (!this.currentUserId || !this.customerInfo) return;

      const status = await this.getSubscriptionStatus();
      
      // Update user document
      await firestore()
        .collection('users')
        .doc(this.currentUserId)
        .set({
          subscription: {
            isPremium: status.isPremium,
            isPro: status.isPro,
            isActive: status.isActive,
            entitlements: status.activeEntitlements,
            expirationDate: status.expirationDate,
            willRenew: status.willRenew,
            lastUpdated: firestore.FieldValue.serverTimestamp()
          }
        }, { merge: true });

      // Cache locally
      await AsyncStorage.setItem(
        '@subscription_status',
        JSON.stringify(status)
      );

      // Log to analytics
      await analytics().setUserProperty('subscription_status', 
        status.isPro ? 'pro' : status.isPremium ? 'premium' : 'free'
      );

    } catch (error) {
      console.error('Error syncing subscription status:', error);
    }
  }

  // Get available packages
  getAvailablePackages() {
    if (!this.offerings?.current) return [];

    return this.offerings.current.availablePackages.map(pkg => ({
      identifier: pkg.identifier,
      packageType: pkg.packageType,
      product: {
        identifier: pkg.storeProduct.identifier,
        title: pkg.storeProduct.title,
        description: pkg.storeProduct.description,
        price: pkg.storeProduct.price,
        priceString: pkg.storeProduct.priceString,
        currencyCode: pkg.storeProduct.currencyCode,
        introPrice: pkg.storeProduct.introPrice
      }
    }));
  }

  // Check if user can access premium features
  async canAccessPremiumFeatures() {
    const status = await this.getSubscriptionStatus();
    return status.isPremium || status.isPro;
  }

  // Check if user can access pro features
  async canAccessProFeatures() {
    const status = await this.getSubscriptionStatus();
    return status.isPro;
  }

  // Get subscription details
  async getSubscriptionDetails() {
    try {
      const status = await this.getSubscriptionStatus();
      const packages = this.getAvailablePackages();

      return {
        currentPlan: status.isPro ? 'Pro' : status.isPremium ? 'Premium' : 'Free',
        isActive: status.isActive,
        expirationDate: status.expirationDate,
        willRenew: status.willRenew,
        availablePlans: packages.map(pkg => ({
          id: pkg.product.identifier,
          name: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.priceString,
          type: pkg.packageType
        }))
      };
    } catch (error) {
      console.error('Error getting subscription details:', error);
      return null;
    }
  }

  // Cancel subscription (directs to platform subscription management)
  async manageSubscription() {
    try {
      await analytics().logEvent('manage_subscription_pressed');

      if (Platform.OS === 'ios') {
        // iOS - Open subscription management
        await Purchases.showManageSubscriptions();
      } else {
        // Android - Get management URL
        const managementUrl = this.customerInfo?.managementURL;
        if (managementUrl) {
          // Open URL in browser
          const { Linking } = require('react-native');
          await Linking.openURL(managementUrl);
        } else {
          throw new Error('Management URL not available');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error managing subscription:', error);
      return {
        success: false,
        error: error.message || 'Could not open subscription management'
      };
    }
  }

  // Check introductory price eligibility
  async checkIntroEligibility(productIdentifiers) {
    try {
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(
        productIdentifiers
      );
      return eligibility;
    } catch (error) {
      console.error('Error checking intro eligibility:', error);
      return {};
    }
  }

  // Set user attributes for targeting
  async setUserAttributes(attributes) {
    try {
      if (attributes.email) {
        await Purchases.setEmail(attributes.email);
      }
      if (attributes.displayName) {
        await Purchases.setDisplayName(attributes.displayName);
      }
      if (attributes.phoneNumber) {
        await Purchases.setPhoneNumber(attributes.phoneNumber);
      }

      // Set custom attributes
      Object.entries(attributes).forEach(async ([key, value]) => {
        if (!['email', 'displayName', 'phoneNumber'].includes(key)) {
          await Purchases.setAttributes({ [key]: value });
        }
      });

    } catch (error) {
      console.error('Error setting user attributes:', error);
    }
  }

  // Handle app lifecycle
  async handleAppBackground() {
    // Sync any pending data
    await this.syncSubscriptionStatus();
  }

  async handleAppForeground() {
    // Refresh customer info when app comes to foreground
    await this.fetchCustomerInfo();
    await this.syncSubscriptionStatus();
  }

  // Get promotional offer (iOS only)
  async getPromotionalOffer(storeProduct, storeProductDiscount) {
    if (Platform.OS !== 'ios') return null;

    try {
      const offer = await Purchases.getPromotionalOffer(
        storeProduct,
        storeProductDiscount
      );
      return offer;
    } catch (error) {
      console.error('Error getting promotional offer:', error);
      return null;
    }
  }

  // Purchase with promotional offer (iOS only)
  async purchaseWithPromotionalOffer(pkg, offer) {
    if (Platform.OS !== 'ios') {
      throw new Error('Promotional offers are only available on iOS');
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg, offer);
      this.customerInfo = customerInfo;
      await this.syncSubscriptionStatus();
      
      return { success: true, customerInfo };
    } catch (error) {
      console.error('Error purchasing with promotional offer:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if user has made any purchase
  async hasEverPurchased() {
    try {
      const customerInfo = this.customerInfo || await this.fetchCustomerInfo();
      return customerInfo.nonSubscriptionTransactions.length > 0 || 
             Object.keys(customerInfo.allPurchasedProductIdentifiers).length > 0;
    } catch (error) {
      console.error('Error checking purchase history:', error);
      return false;
    }
  }

  // Get purchase history
  async getPurchaseHistory() {
    try {
      const customerInfo = this.customerInfo || await this.fetchCustomerInfo();
      
      return {
        subscriptions: customerInfo.activeSubscriptions,
        nonSubscriptions: customerInfo.nonSubscriptionTransactions,
        allPurchased: customerInfo.allPurchasedProductIdentifiers,
        firstSeen: customerInfo.firstSeen,
        originalAppUserId: customerInfo.originalAppUserId
      };
    } catch (error) {
      console.error('Error getting purchase history:', error);
      return null;
    }
  }

  // Logout (remove user association)
  async logout() {
    try {
      if (this.isConfigured) {
        await Purchases.logOut();
        this.currentUserId = null;
        this.customerInfo = null;
        await AsyncStorage.removeItem('@subscription_status');
      }
    } catch (error) {
      console.error('Error during RevenueCat logout:', error);
    }
  }
}

// Create singleton instance
const revenueCatService = new RevenueCatService();

// Export service and helper functions
export default revenueCatService;

// Helper hooks for React Native
export const useRevenueCat = () => {
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRevenueCatData = async () => {
      try {
        const status = await revenueCatService.getSubscriptionStatus();
        const packages = revenueCatService.getAvailablePackages();
        
        setSubscriptionStatus(status);
        setOfferings(packages);
      } catch (error) {
        console.error('Error loading RevenueCat data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (revenueCatService.isConfigured) {
      loadRevenueCatData();
    } else {
      setLoading(false);
    }

    // Set up listener for updates
    const updateListener = () => {
      loadRevenueCatData();
    };

    // Add listener (implementation depends on your event system)
    // EventEmitter.on('subscription-updated', updateListener);

    return () => {
      // EventEmitter.off('subscription-updated', updateListener);
    };
  }, []);

  return {
    subscriptionStatus,
    offerings,
    loading,
    purchaseProduct: revenueCatService.purchaseProduct.bind(revenueCatService),
    restorePurchases: revenueCatService.restorePurchases.bind(revenueCatService),
    manageSubscription: revenueCatService.manageSubscription.bind(revenueCatService)
  };
};