import '@react-native-firebase/app'; // assicurati che venga chiamato prima di tutto il resto
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Removed react-native-vector-icons - using text placeholders
// Simple Icon replacement component
const Icon = ({ name, size = 24, color = '#000' }) => {
  const icons = {
    'thumb-up': '👍',
    'thumb-down': '👎',
    'psychology': '🧠',
    'chevron-right': '›',
    'arrow-back': '←',
    'close': '✕',
    'check': '✓',
    'error-outline': '⚠️',
    'chat': '💬',
    'local-florist': '🌿',
    'science': '🧪',
    'star': '⭐',
    'settings': '⚙️',
    'search': '🔍',
    'schedule': '⏰',
    'trending-up': '📈',
    'download': '⬇️'
  };
  return <Text style={{ fontSize: size, color }}>{icons[name] || '•'}</Text>;
};

// Lazy Loading Image Component with Caching
const LazyImage = React.memo(({ source, style, fallback, ...props }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && !error) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [loading, error, fadeAnim]);

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  if (error && fallback) {
    return fallback();
  }

  return (
    <View style={style}>
      {loading && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
      <Animated.Image
        {...props}
        source={source}
        style={[style, { opacity: fadeAnim }]}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
    </View>
  );
});

// Performance optimized FlatList with virtualization
const OptimizedFlatList = React.memo(({ 
  data, 
  renderItem, 
  keyExtractor,
  onEndReachedThreshold = 0.5,
  windowSize = 10,
  initialNumToRender = 10,
  maxToRenderPerBatch = 5,
  ...props 
}) => {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReachedThreshold={onEndReachedThreshold}
      windowSize={windowSize}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      removeClippedSubviews={true}
      getItemLayout={(data, index) => ({
        length: 100, // Adjust based on your item height
        offset: 100 * index,
        index
      })}
      {...props}
    />
  );
});

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import * as Localize from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';
import WebView from 'react-native-webview';

// Import translations
import { deTranslations, frTranslations } from './src/locales/translations';
// Import services
import { analyticsCollector, analyticsEngine, analyticsDashboard } from './src/services/analytics';
import revenueCatService from './src/services/revenueCat';

// Create analytics service alias
const analyticsService = analyticsDashboard;

// Firebase FieldValue per incrementi atomici
const { FieldValue } = firestore;

// Simple in-memory cache system
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, value, ttl = 300000) { // Default 5 minutes TTL
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now > timestamp) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

const cacheManager = new CacheManager();

// Performance monitoring hook
const usePerformanceMonitor = (componentName) => {
  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      if (duration > 1000) { // Log if component took more than 1s
        console.warn(`${componentName} took ${duration}ms to render`);
      }
    };
  }, [componentName]);
};

// Debounce hook for search inputs
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Memoized heavy computations
const useMemoizedStrainData = (strains, filters) => {
  return React.useMemo(() => {
    if (!strains || strains.length === 0) return [];
    
    return strains.filter(strain => {
      if (filters.thc && strain.thc < filters.thc) return false;
      if (filters.cbd && strain.cbd < filters.cbd) return false;
      if (filters.type && strain.type !== filters.type) return false;
      return true;
    }).sort((a, b) => b.popularity - a.popularity);
  }, [strains, filters]);
};

// ===========================
// 1. THEME CONFIGURATION
// ===========================
export const theme = {
  colors: {
    primary: '#2ECC40',
    secondary: '#FFD700',
    tertiary: '#000000',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    error: '#FF4444',
    success: '#2ECC40',
    warning: '#FF851B',
    info: '#0074D9',
    dark: {
      background: '#121212',
      surface: '#1E1E1E',
      text: '#FFFFFF',
      textSecondary: '#AAAAAA'
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    round: 9999
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40
    },
    h2: {
      fontSize: 24,
      fontWeight: 'bold',
      lineHeight: 32
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28
    },
    body: {
      fontSize: 16,
      fontWeight: 'normal',
      lineHeight: 24
    },
    caption: {
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 20
    }
  }
};

// Safe theme color accessor with fallback
const getThemeColor = (colorPath, fallback = '#000') => {
  try {
    const paths = colorPath.split('.');
    let value = theme.colors;
    for (const path of paths) {
      value = value[path];
      if (!value) return fallback;
    }
    return value || fallback;
  } catch {
    return fallback;
  }
};

// ===========================
// 2. TRANSLATION FILES
// ===========================

const itTranslations = {
  common: {
    loading: "Caricamento...",
    error: "Si è verificato un errore",
    retry: "Riprova",
    save: "Salva",
    cancel: "Annulla",
    confirm: "Conferma",
    delete: "Elimina",
    edit: "Modifica",
    close: "Chiudi",
    search: "Cerca",
    filter: "Filtra",
    sort: "Ordina",
    share: "Condividi",
    success: "Operazione completata con successo",
    welcome_back: "Bentornato! L'ultima volta stavamo parlando di...",
    type_message: "Scrivi un messaggio...",
    send: "Invia",
    typing: "Digitando..."
  },
  navigation: {
    chat: "Chat",
    settings: "Impostazioni",
    profile: "Profilo",
    home: "Home",
    library: "Libreria",
    premium: "Premium"
  },
  settings: {
    title: "Impostazioni",
    profile: "Profilo",
    language: "Lingua",
    notifications: "Notifiche",
    theme: "Tema",
    dark_mode: "Modalità Scura",
    light_mode: "Modalità Chiara",
    manage_subscription: "Gestisci Abbonamento",
    restore_purchases: "Ripristina Acquisti",
    legal: "Informazioni Legali",
    privacy_policy: "Privacy Policy",
    terms_of_service: "Termini di Servizio",
    educational_disclaimer: "Disclaimer Educativo",
    support: "Supporto",
    app_info: "Informazioni App",
    version: "Versione",
    build: "Build",
    credits: "Crediti",
    language_change_confirm: "Sei sicuro di voler cambiare lingua?",
    clear_memory: "Cancella Memoria",
    conversation_history: "Cronologia Conversazioni",
    memory_indicator: "AI ricorda il contesto",
    notification_types: {
      push: "Notifiche Push",
      email: "Email",
      sms: "SMS",
      breeding_updates: "Aggiornamenti Breeding",
      new_strains: "Nuovi Strain",
      price_alerts: "Avvisi Prezzi"
    },
    memory_cleared: "Memoria cancellata con successo",
    clear_memory_confirm: "Sei sicuro di voler cancellare la memoria?"
  },
  chat: {
    ai_name: "GREED & GROSS",
    placeholder: "Chiedi qualsiasi cosa sul breeding...",
    error_message: "Ops! Qualcosa è andato storto. Riprova.",
    thinking: "Sto pensando...",
    memory_loading: "Carico il contesto delle conversazioni precedenti...",
    context_loaded: "Ho caricato la nostra cronologia conversazioni",
    helpful_question: "Questa risposta ti è stata utile?",
    feedback_thanks: "Grazie per il feedback!",
    welcome_message: "Ciao! Sono GREED & GROSS, il tuo esperto di genetica cannabis. Come posso aiutarti oggi?"
  },
  legal: {
    loading_document: "Caricamento documento...",
    document_not_available: "Documento non disponibile",
    last_updated: "Ultimo aggiornamento",
    contact_support: "Contatta il supporto",
    support_email: "supporto@greedandgross.com",
    response_time: "Tempo di risposta: 24-48 ore",
    business_hours: "Orari: Lun-Ven 9:00-18:00 CET"
  },
  subscription: {
    title: "Abbonamento Premium",
    current_plan: "Piano Attuale",
    free_tier: "Gratis",
    premium_tier: "Premium",
    pro_tier: "Pro",
    benefits: "Benefici",
    unlimited_queries: "Query illimitate",
    advanced_genetics: "Analisi genetiche avanzate",
    export_data: "Esporta dati",
    priority_support: "Supporto prioritario",
    upgrade: "Upgrade",
    manage: "Gestisci",
    cancel_subscription: "Annulla abbonamento",
    purchases_restored: "Acquisti ripristinati con successo"
  },
  strains: {
    search_placeholder: "Cerca strain...",
    filters: {
      type: "Tipo",
      effects: "Effetti",
      flavor: "Sapore",
      thc_content: "Contenuto THC",
      flowering_time: "Tempo fioritura"
    },
    details: {
      genetics: "Genetica",
      thc: "THC",
      cbd: "CBD",
      effects: "Effetti",
      flavors: "Sapori",
      terpenes: "Terpeni",
      flowering: "Fioritura",
      yield: "Resa",
      difficulty: "Difficoltà"
    }
  },
  breeding: {
    simulator: "Simulatore Breeding",
    parent1: "Genitore 1",
    parent2: "Genitore 2",
    cross: "Incrocia",
    backcross: "Backcross",
    predicted_results: "Risultati Predetti",
    save_combination: "Salva Combinazione",
    share_results: "Condividi Risultati"
  },
  errors: {
    network: "Errore di rete. Controlla la connessione.",
    firebase: "Errore di autenticazione",
    storage_quota: "Quota storage superata",
    invalid_document: "Documento non valido",
    cache_error: "Errore cache",
    language_load: "Impossibile caricare la lingua"
  }
};

const enTranslations = {
  common: {
    loading: "Loading...",
    error: "An error occurred",
    retry: "Retry",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    share: "Share",
    success: "Operation completed successfully",
    welcome_back: "Welcome back! Last time we were talking about...",
    type_message: "Type a message...",
    send: "Send",
    typing: "Typing..."
  },
  navigation: {
    chat: "Chat",
    settings: "Settings",
    profile: "Profile",
    home: "Home",
    library: "Library",
    premium: "Premium"
  },
  settings: {
    title: "Settings",
    profile: "Profile",
    language: "Language",
    notifications: "Notifications",
    theme: "Theme",
    dark_mode: "Dark Mode",
    light_mode: "Light Mode",
    manage_subscription: "Manage Subscription",
    restore_purchases: "Restore Purchases",
    legal: "Legal Information",
    privacy_policy: "Privacy Policy",
    terms_of_service: "Terms of Service",
    educational_disclaimer: "Educational Disclaimer",
    support: "Support",
    app_info: "App Information",
    version: "Version",
    build: "Build",
    credits: "Credits",
    language_change_confirm: "Are you sure you want to change language?",
    clear_memory: "Clear Memory",
    conversation_history: "Conversation History",
    memory_indicator: "AI remembers context",
    notification_types: {
      push: "Push Notifications",
      email: "Email",
      sms: "SMS",
      breeding_updates: "Breeding Updates",
      new_strains: "New Strains",
      price_alerts: "Price Alerts"
    },
    memory_cleared: "Memory cleared successfully",
    clear_memory_confirm: "Are you sure you want to clear memory?"
  },
  chat: {
    ai_name: "GREED & GROSS",
    placeholder: "Ask anything about breeding...",
    error_message: "Oops! Something went wrong. Please try again.",
    thinking: "Thinking...",
    memory_loading: "Loading previous conversation context...",
    context_loaded: "I've loaded our conversation history",
    helpful_question: "Was this response helpful?",
    feedback_thanks: "Thanks for your feedback!",
    welcome_message: "Hello! I'm GREED & GROSS, your cannabis genetics expert. How can I help you today?"
  },
  legal: {
    loading_document: "Loading document...",
    document_not_available: "Document not available",
    last_updated: "Last updated",
    contact_support: "Contact support",
    support_email: "support@greedandgross.com",
    response_time: "Response time: 24-48 hours",
    business_hours: "Hours: Mon-Fri 9:00-18:00 CET"
  },
  subscription: {
    title: "Premium Subscription",
    current_plan: "Current Plan",
    free_tier: "Free",
    premium_tier: "Premium",
    pro_tier: "Pro",
    benefits: "Benefits",
    unlimited_queries: "Unlimited queries",
    advanced_genetics: "Advanced genetic analysis",
    export_data: "Export data",
    priority_support: "Priority support",
    upgrade: "Upgrade",
    manage: "Manage",
    cancel_subscription: "Cancel subscription",
    purchases_restored: "Purchases restored successfully"
  },
  strains: {
    search_placeholder: "Search strains...",
    filters: {
      type: "Type",
      effects: "Effects",
      flavor: "Flavor",
      thc_content: "THC Content",
      flowering_time: "Flowering Time"
    },
    details: {
      genetics: "Genetics",
      thc: "THC",
      cbd: "CBD",
      effects: "Effects",
      flavors: "Flavors",
      terpenes: "Terpenes",
      flowering: "Flowering",
      yield: "Yield",
      difficulty: "Difficulty"
    }
  },
  breeding: {
    simulator: "Breeding Simulator",
    parent1: "Parent 1",
    parent2: "Parent 2",
    cross: "Cross",
    backcross: "Backcross",
    predicted_results: "Predicted Results",
    save_combination: "Save Combination",
    share_results: "Share Results"
  },
  errors: {
    network: "Network error. Check your connection.",
    firebase: "Authentication error",
    storage_quota: "Storage quota exceeded",
    invalid_document: "Invalid document",
    cache_error: "Cache error",
    language_load: "Unable to load language"
  }
};

const esTranslations = {
  common: {
    loading: "Cargando...",
    error: "Se produjo un error",
    retry: "Reintentar",
    save: "Guardar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    delete: "Eliminar",
    edit: "Editar",
    close: "Cerrar",
    search: "Buscar",
    filter: "Filtrar",
    sort: "Ordenar",
    share: "Compartir",
    success: "Operación completada con éxito",
    welcome_back: "¡Bienvenido de nuevo! La última vez hablábamos de...",
    type_message: "Escribe un mensaje...",
    send: "Enviar",
    typing: "Escribiendo..."
  },
  navigation: {
    chat: "Chat",
    settings: "Configuración",
    profile: "Perfil",
    home: "Inicio",
    library: "Biblioteca",
    premium: "Premium"
  },
  settings: {
    title: "Configuración",
    profile: "Perfil",
    language: "Idioma",
    notifications: "Notificaciones",
    theme: "Tema",
    dark_mode: "Modo Oscuro",
    light_mode: "Modo Claro",
    manage_subscription: "Gestionar Suscripción",
    restore_purchases: "Restaurar Compras",
    legal: "Información Legal",
    privacy_policy: "Política de Privacidad",
    terms_of_service: "Términos de Servicio",
    educational_disclaimer: "Descargo Educativo",
    support: "Soporte",
    app_info: "Información de la App",
    version: "Versión",
    build: "Build",
    credits: "Créditos",
    language_change_confirm: "¿Estás seguro de que quieres cambiar el idioma?",
    clear_memory: "Borrar Memoria",
    conversation_history: "Historial de Conversaciones",
    memory_indicator: "IA recuerda el contexto",
    notification_types: {
      push: "Notificaciones Push",
      email: "Email",
      sms: "SMS",
      breeding_updates: "Actualizaciones de Cultivo",
      new_strains: "Nuevas Cepas",
      price_alerts: "Alertas de Precios"
    },
    memory_cleared: "Memoria borrada con éxito",
    clear_memory_confirm: "¿Estás seguro de que quieres borrar la memoria?"
  },
  chat: {
    ai_name: "GREED & GROSS",
    placeholder: "Pregunta cualquier cosa sobre el cultivo...",
    error_message: "¡Ups! Algo salió mal. Por favor, inténtalo de nuevo.",
    thinking: "Pensando...",
    memory_loading: "Cargando el contexto de conversaciones anteriores...",
    context_loaded: "He cargado nuestro historial de conversaciones",
    helpful_question: "¿Te resultó útil esta respuesta?",
    feedback_thanks: "¡Gracias por tu comentario!",
    welcome_message: "¡Hola! Soy GREED & GROSS, tu experto en genética del cannabis. ¿Cómo puedo ayudarte hoy?"
  },
  legal: {
    loading_document: "Cargando documento...",
    document_not_available: "Documento no disponible",
    last_updated: "Última actualización",
    contact_support: "Contactar soporte",
    support_email: "soporte@greedandgross.com",
    response_time: "Tiempo de respuesta: 24-48 horas",
    business_hours: "Horario: Lun-Vie 9:00-18:00 CET"
  },
  subscription: {
    title: "Suscripción Premium",
    current_plan: "Plan Actual",
    free_tier: "Gratis",
    premium_tier: "Premium",
    pro_tier: "Pro",
    benefits: "Beneficios",
    unlimited_queries: "Consultas ilimitadas",
    advanced_genetics: "Análisis genético avanzado",
    export_data: "Exportar datos",
    priority_support: "Soporte prioritario",
    upgrade: "Mejorar",
    manage: "Gestionar",
    cancel_subscription: "Cancelar suscripción",
    purchases_restored: "Compras restauradas con éxito"
  },
  strains: {
    search_placeholder: "Buscar cepas...",
    filters: {
      type: "Tipo",
      effects: "Efectos",
      flavor: "Sabor",
      thc_content: "Contenido THC",
      flowering_time: "Tiempo de floración"
    },
    details: {
      genetics: "Genética",
      thc: "THC",
      cbd: "CBD",
      effects: "Efectos",
      flavors: "Sabores",
      terpenes: "Terpenos",
      flowering: "Floración",
      yield: "Rendimiento",
      difficulty: "Dificultad"
    }
  },
  breeding: {
    simulator: "Simulador de Cultivo",
    parent1: "Padre 1",
    parent2: "Padre 2",
    cross: "Cruzar",
    backcross: "Retrocruce",
    predicted_results: "Resultados Predichos",
    save_combination: "Guardar Combinación",
    share_results: "Compartir Resultados"
  },
  errors: {
    network: "Error de red. Verifica tu conexión.",
    firebase: "Error de autenticación",
    storage_quota: "Cuota de almacenamiento excedida",
    invalid_document: "Documento inválido",
    cache_error: "Error de caché",
    language_load: "No se puede cargar el idioma"
  }
};

// ===========================
// 3. i18n CONFIGURATION
// ===========================
const STORAGE_KEY = '@app_language';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedLanguage) {
        return callback(savedLanguage);
      }
      
      const bestLanguage = Localize.findBestAvailableLanguage(['it', 'en', 'es', 'de', 'fr']);
      callback(bestLanguage?.languageTag || 'it');
    } catch (error) {
      callback('it');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  }
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    fallbackLng: 'it',
    resources: {
      it: { translation: itTranslations },
      en: { translation: enTranslations },
      es: { translation: esTranslations },
      de: { translation: deTranslations },
      fr: { translation: frTranslations }
    },
    interpolation: {
      escapeValue: false
    }
  });

// ===========================
// 4. SMART MEMORY SYSTEM
// ===========================
class SmartMemorySystem {
  constructor() {
    this.cache = new Map();
    this.userId = null;
    this.sessionId = null;
    this.currentSession = [];
  }

  async initialize(userId) {
    try {
      this.userId = userId;
      this.sessionId = `session_${Date.now()}`;
      
      await this.loadUserContext();
    } catch (error) {
      console.error('Error initializing memory system:', error);
    }
  }

  async processQuery(userQuery) {
    try {
      const queryHash = this.generateQueryHash(userQuery);
      const cachedResponse = await this.checkCache(queryHash);
      
      if (cachedResponse) {
        console.log('💰 CACHE HIT - Risparmio API call!');
        await this.updateAccessTime(queryHash);
        
        this.currentSession.push({
          query: userQuery,
          response: cachedResponse.aiResponse,
          cached: true
        });
        
        return cachedResponse.aiResponse;
      }
      
      console.log('🚀 CACHE MISS - Chiamo API');
      const context = await this.buildContextFromHistory();
      const aiResponse = await this.callCustomAPI(userQuery, context);
      
      await this.saveToMemory(userQuery, aiResponse, queryHash);
      
      return aiResponse;
    } catch (error) {
      console.error('Error processing query:', error);
      return 'Errore nel processare la richiesta. Riprova più tardi.';
    }
  }

  async checkCache(queryHash) {
    try {
      if (this.cache.has(queryHash)) {
        return this.cache.get(queryHash);
      }
      
      const snapshot = await firestore()
        .collection('ai_responses')
        .where('queryHash', '==', queryHash)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        this.cache.set(queryHash, data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Cache check error:', error);
      return null;
    }
  }

  async callCustomAPI(query, context) {
    try {
      // Try to get API key from AsyncStorage first
      let OPENAI_API_KEY = await AsyncStorage.getItem('@openai_api_key');
      
      if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        // Return a helpful message instead of crashing
        return "⚠️ Configurazione AI non completata. Per utilizzare l'assistente AI, configura la chiave API nelle impostazioni dell'app.";
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: context
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Errore API OpenAI:', error);
      return 'Errore nel generare la risposta AI. Riprova più tardi.';
    }
  }

  async saveToMemory(query, response, queryHash) {
    try {
      const strainsMentioned = this.extractStrains(response);
      
      const memoryEntry = {
        queryHash,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: new Date(),
        userQuery: query,
        aiResponse: response,
        strainsMentioned,
        queryType: this.classifyQuery(query),
        responseLength: response.length,
        hasBreedingInfo: response.includes('incrocio') || response.includes('cross'),
        hasMedicalInfo: response.includes('medical') || response.includes('terapeutico'),
        accessCount: 1,
        lastAccessed: new Date()
      };
      
      try {
        await firestore().collection('ai_responses').add(memoryEntry);
        
        await firestore().collection('conversations').add({
          userId: this.userId,
          sessionId: this.sessionId,
          timestamp: new Date(),
          query,
          response,
          strainsMentioned
        });
      } catch (error) {
        console.error('Error saving to Firestore:', error);
      }
      
      this.cache.set(queryHash, memoryEntry);
      
      this.currentSession.push({
        query,
        response,
        cached: false
      });
    } catch (error) {
      console.error('Error in saveToMemory:', error);
    }
  }

  async buildContextFromHistory() {
    try {
      const snapshot = await firestore()
        .collection('conversations')
        .where('userId', '==', this.userId)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      
      if (snapshot.empty) {
        return "Sei GREED & GROSS, un esperto genetista della cannabis. La tua specializzazione è nel breeding e backcrossing della cannabis, con una conoscenza approfondita di ogni strain esistente.";
      }
      
      const conversations = snapshot.docs.map(doc => doc.data());
      const recentStrains = new Set();
      const userPreferences = {
        effects: new Set(),
        types: new Set(),
        medicalNeeds: new Set()
      };
      
      conversations.forEach(conv => {
        if (conv.strainsMentioned) {
          conv.strainsMentioned.forEach(s => recentStrains.add(s));
        }
        
        const query = conv.query.toLowerCase();
        if (query.includes('energetic') || query.includes('energizzante')) {
          userPreferences.effects.add('energetic');
        }
        if (query.includes('relax') || query.includes('rilassante')) {
          userPreferences.effects.add('relaxing');
        }
        if (query.includes('sativa')) {
          userPreferences.types.add('sativa');
        }
        if (query.includes('indica')) {
          userPreferences.types.add('indica');
        }
      });
      
      let contextPrompt = "Sei GREED & GROSS, un esperto genetista della cannabis. La tua specializzazione è nel breeding e backcrossing della cannabis.\n\n";
      
      if (recentStrains.size > 0) {
        contextPrompt += `CONTEXT DA CONVERSAZIONI PRECEDENTI:\n`;
        contextPrompt += `- L'utente ha recentemente discusso questi strain: ${Array.from(recentStrains).join(', ')}\n`;
      }
      
      if (userPreferences.effects.size > 0) {
        contextPrompt += `- Ha mostrato interesse per effetti: ${Array.from(userPreferences.effects).join(', ')}\n`;
      }
      
      if (userPreferences.types.size > 0) {
        contextPrompt += `- Preferisce varietà: ${Array.from(userPreferences.types).join(', ')}\n`;
      }
      
      if (conversations.length > 0) {
        contextPrompt += `\nUltime 3 interazioni per context:\n`;
        conversations.slice(0, 3).forEach((conv, i) => {
          contextPrompt += `${i + 1}. User: ${conv.query}\n`;
          contextPrompt += `   You: ${conv.response.substring(0, 100)}...\n\n`;
        });
      }
      
      contextPrompt += "\nContinua la conversazione tenendo conto di questo context.";
      
      return contextPrompt;
    } catch (error) {
      console.error('Error building context:', error);
      return "Sei GREED & GROSS, un esperto genetista della cannabis.";
    }
  }

  generateQueryHash(query) {
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/[àáäâ]/g, 'a')
      .replace(/[èéëê]/g, 'e')
      .replace(/[ìíïî]/g, 'i')
      .replace(/[òóöô]/g, 'o')
      .replace(/[ùúüû]/g, 'u')
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => word.length > 2)
      .sort()
      .join(' ');
    
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `query_${Math.abs(hash)}`;
  }

  extractStrains(text) {
    const strainPatterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /([A-Z][a-z]+ #\d+)/g,
      /([A-Z]{2,} [A-Z][a-z]+)/g,
      /([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+)/g,
    ];
    
    const strains = new Set();
    strainPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          if (!['The Best', 'La Migliore', 'Il Risultato'].includes(m)) {
            strains.add(m);
          }
        });
      }
    });
    
    return Array.from(strains);
  }

  classifyQuery(query) {
    const q = query.toLowerCase();
    if (q.includes('incrocio') || q.includes('cross') || q.includes('breed')) {
      return 'breeding';
    }
    if (q.includes('effetti') || q.includes('effects') || q.includes('high')) {
      return 'effects';
    }
    if (q.includes('coltiv') || q.includes('grow') || q.includes('fioritura')) {
      return 'cultivation';
    }
    if (q.includes('medical') || q.includes('terapeutic') || q.includes('cbd')) {
      return 'medical';
    }
    if (q.includes('terpeni') || q.includes('sapore') || q.includes('aroma')) {
      return 'terpenes';
    }
    return 'general';
  }

  async updateAccessTime(queryHash) {
    try {
      const snapshot = await firestore()
        .collection('ai_responses')
        .where('queryHash', '==', queryHash)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({
          lastAccessed: new Date(),
          accessCount: FieldValue.increment(1)
        });
      }
    } catch (error) {
      console.error('Error updating access time:', error);
    }
  }

  async getCacheStats() {
    try {
      const snapshot = await firestore()
        .collection('ai_responses')
        .where('userId', '==', this.userId)
        .get();
      
      let totalQueries = 0;
      let cachedQueries = 0;
      let uniqueQueries = snapshot.size;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalQueries += data.accessCount || 1;
        if (data.accessCount > 1) {
          cachedQueries += data.accessCount - 1;
        }
      });
      
      return {
        totalQueries,
        uniqueQueries,
        cachedQueries,
        cacheHitRate: totalQueries > 0 ? (cachedQueries / totalQueries * 100).toFixed(2) + '%' : '0%',
        apiCallsSaved: cachedQueries,
        estimatedSavings: (cachedQueries * 0.002).toFixed(2) + '€'
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  getSessionContext() {
    return this.currentSession.map(entry => [
      { role: 'user', content: entry.query },
      { role: 'assistant', content: entry.response }
    ]).flat();
  }

  async clearMemory() {
    try {
      this.currentSession = [];
      this.cache.clear();
      await AsyncStorage.removeItem(`@user_context_${this.userId}`);
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  }

  async loadUserContext() {
    try {
      return null;
    } catch (error) {
      console.error('Error loading user context:', error);
      return null;
    }
  }

  async loadUserHistory() {
    try {
      return null;
    } catch (error) {
      console.error('Error loading user history:', error);
      return null;
    }
  }
}

export const memorySystem = new SmartMemorySystem();

// ===========================
// 5. ANALYTICS SYSTEM
// ===========================
class AnalyticsSystem {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 300000;
  }

  async recordInteraction(data) {
    try {
      const interaction = {
        user_id: data.userId,
        session_id: data.sessionId,
        query_type: this.classifyQuery(data.query),
        user_query: data.query,
        ai_response: data.response,
        strains_mentioned: this.extractStrains(data.response),
        effects_requested: this.extractEffects(data.query),
        query_intent: this.detectIntent(data.query),
        timestamp: new Date(),
        user_location: data.userLocation,
        device_type: data.deviceType
      };
      
      await firestore().collection('user_interactions').add(interaction);
      await this.updateUserPreferences(data.userId, interaction);
      await this.updateStrainAnalytics(interaction.strains_mentioned);
      
      await analytics().logEvent('user_query', {
        query_type: interaction.query_type,
        strains_count: interaction.strains_mentioned.length,
        has_effects: interaction.effects_requested.length > 0
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  async updateUserPreferences(userId, interaction) {
    try {
      const userRef = firestore().collection('user_preferences').doc(userId);
      const doc = await userRef.get();
      
      if (doc.exists) {
        const data = doc.data();
        const updatedData = {
          ...data,
          preferred_strains: [...new Set([...(data.preferred_strains || []), ...interaction.strains_mentioned])],
          preferred_effects: [...new Set([...(data.preferred_effects || []), ...interaction.effects_requested])],
          last_updated: new Date()
        };
        await userRef.update(updatedData);
      } else {
        await userRef.set({
          user_id: userId,
          preferred_strains: interaction.strains_mentioned,
          preferred_effects: interaction.effects_requested,
          last_updated: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }

  async updateStrainAnalytics(strains) {
    try {
      for (const strain of strains) {
        try {
          const strainRef = firestore().collection('strain_analytics').doc(strain);
          await strainRef.update({
            total_requests: FieldValue.increment(1),
            last_requested: new Date()
          });
        } catch (error) {
          await firestore().collection('strain_analytics').doc(strain).set({
            strain_name: strain,
            total_requests: 1,
            last_requested: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error updating strain analytics:', error);
    }
  }

  async getStrainPopularity(timeframe = '30d') {
    const cacheKey = `strain_popularity_${timeframe}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const snapshot = await firestore()
        .collection('strain_analytics')
        .orderBy('total_requests', 'desc')
        .limit(50)
        .get();

      const data = snapshot.docs.map(doc => ({
        strain_name: doc.id,
        ...doc.data()
      }));

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.error('Error getting strain popularity:', error);
      return [];
    }
  }

  async getUserPatterns(userId) {
    try {
      const snapshot = await firestore()
        .collection('user_interactions')
        .where('user_id', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const interactions = snapshot.docs.map(doc => doc.data());
      
      const patterns = {
        mostRequestedType: this.getMostFrequent(interactions.map(i => i.query_type)),
        commonEffects: this.getMostFrequent(interactions.flatMap(i => i.effects_requested || [])),
        favoriteStrains: this.getMostFrequent(interactions.flatMap(i => i.strains_mentioned || [])),
        averageSessionLength: this.calculateAverageSessionLength(interactions)
      };

      return patterns;
    } catch (error) {
      console.error('Error analyzing user patterns:', error);
      return null;
    }
  }

  getMostFrequent(arr) {
    const frequency = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([item, count]) => ({ item, count }));
  }

  calculateAverageSessionLength(interactions) {
    const sessions = {};
    interactions.forEach(i => {
      if (!sessions[i.session_id]) {
        sessions[i.session_id] = [];
      }
      sessions[i.session_id].push(i.timestamp);
    });

    const durations = Object.values(sessions).map(timestamps => {
      const sorted = timestamps.sort();
      return sorted[sorted.length - 1] - sorted[0];
    });

    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  classifyQuery(query) {
    if (query.includes('cross') || query.includes('breed')) return 'breeding';
    if (query.includes('recommend') || query.includes('suggest')) return 'recommendation';
    if (query.includes('how') || query.includes('why')) return 'education';
    return 'general';
  }

  extractStrains(text) {
    const strainDatabase = ['Blue Dream', 'White Widow', 'OG Kush', 'Sour Diesel'];
    return strainDatabase.filter(strain => 
      text.toLowerCase().includes(strain.toLowerCase())
    );
  }

  extractEffects(query) {
    const effects = ['creative', 'energetic', 'relaxing', 'sleepy', 'focused', 'happy'];
    return effects.filter(effect => 
      query.toLowerCase().includes(effect.toLowerCase())
    );
  }

  detectIntent(query) {
    const intents = {
      'sleep': ['sleep', 'insomnia', 'dormire'],
      'pain': ['pain', 'dolore', 'ache'],
      'anxiety': ['anxiety', 'ansia', 'stress'],
      'creativity': ['creative', 'creatività', 'focus']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        return intent;
      }
    }
    return 'general';
  }

  async getBreedingOpportunities() {
    try {
      return [];
    } catch (error) {
      console.error('Error getting breeding opportunities:', error);
      return [];
    }
  }
}

export const analyticsSystem = new AnalyticsSystem();

// ===========================
// 6. CONTEXT PROVIDERS
// ===========================
export const ThemeContext = React.createContext();
export const UserContext = React.createContext();

const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      
      await AsyncStorage.setItem('@theme_preference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const profile = await loadUserProfile(firebaseUser.uid);
        setUserProfile(profile);
        
        // Initialize services
        await revenueCatService.initialize(firebaseUser.uid);
        await memorySystem.initialize(firebaseUser.uid);
      } else {
        setUserProfile(null);
        await revenueCatService.logout();
      }
    });

    return unsubscribe;
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      const doc = await firestore()
        .collection('users')
        .doc(userId)
        .get();
      
      if (doc.exists) {
        return doc.data();
      }
      
      const defaultProfile = {
        username: 'User',
        tier: 'free',
        avatar: null,
        createdAt: new Date()
      };
      
      await firestore()
        .collection('users')
        .doc(userId)
        .set(defaultProfile);
      
      return defaultProfile;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  };

  return (
    <UserContext.Provider value={{ user, userProfile, setUserProfile }}>
      {children}
    </UserContext.Provider>
  );
};

// ===========================
// 7. CHAT SCREEN WITH AI
// ===========================
const ChatScreen = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(ThemeContext);
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      setIsLoadingContext(true);
      
      if (user) {
        await memorySystem.initialize(user.uid);
      }
      
      const context = await memorySystem.loadUserHistory();
      
      if (context) {
        const welcomeMessage = {
          id: Date.now().toString(),
          text: `${t('common.welcome_back')} ${context}`,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      } else {
        const welcomeMessage = {
          id: Date.now().toString(),
          text: t('chat.welcome_message'),
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      const errorMessage = {
        id: Date.now().toString(),
        text: t('chat.error_message'),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages([errorMessage]);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const aiResponse = await memorySystem.processQuery(inputText);

      if (user) {
        await analyticsSystem.recordInteraction({
          userId: user.uid,
          sessionId: memorySystem.sessionId,
          query: inputText,
          response: aiResponse,
          userLocation: 'unknown',
          deviceType: Platform.OS
        });
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
        showFeedback: true
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: t('chat.error_message'),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (messageId, isHelpful) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, feedbackGiven: true, wasHelpful: isHelpful }
        : msg
    ));

    if (user) {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        try {
          const snapshot = await firestore()
            .collection('conversations')
            .where('aiResponse', '==', message.text)
            .where('userId', '==', user.uid)
            .limit(1)
            .get();
          
          if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
              userFeedback: isHelpful ? 'helpful' : 'not_helpful'
            });
          }
        } catch (error) {
          console.error('Error updating feedback:', error);
        }
      }
    }

    Alert.alert(t('common.success'), t('chat.feedback_thanks'));
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isDarkMode && (isUser ? styles.darkUserBubble : styles.darkAiBubble)
        ]}>
          <Text style={[
            styles.messageText,
            isUser && styles.userMessageText,
            isDarkMode && !isUser && styles.darkMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={[styles.timestamp, isDarkMode && styles.darkTimestamp]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        {item.showFeedback && !item.feedbackGiven && (
          <View style={styles.feedbackContainer}>
            <Text style={[styles.feedbackText, isDarkMode && styles.darkText]}>
              {t('chat.helpful_question')}
            </Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleFeedback(item.id, true)}
              >
                <Icon name="thumb-up" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => handleFeedback(item.id, false)}
              >
                <Icon name="thumb-down" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoadingContext) {
    return (
      <View style={[styles.loadingContainer, isDarkMode && styles.darkContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
          {t('chat.memory_loading')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={[styles.header, isDarkMode && styles.darkHeader]}>
        <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
          {t('chat.ai_name')}
        </Text>
        {memorySystem.currentSession.length > 0 && (
          <View style={styles.memoryIndicator}>
            <Icon name="psychology" size={20} color={theme.colors.primary} />
            <Text style={styles.memoryText}>{t('settings.memory_indicator')}</Text>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={[styles.typingText, isDarkMode && styles.darkText]}>
            {t('chat.thinking')}
          </Text>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
          <TextInput
            style={[styles.input, isDarkMode && styles.darkInput]}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxHeight={100}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <Icon 
              name="send" 
              size={24} 
              color={inputText.trim() ? '#FFF' : '#999'} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ===========================
// 8. SETTINGS SCREEN COMPONENT
// ===========================
const SettingsScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { user, userProfile } = useContext(UserContext);
  
  const [loading, setLoading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [documentType, setDocumentType] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState({
    push: true,
    email: true,
    sms: false,
    breeding_updates: true,
    new_strains: true,
    price_alerts: false
  });

  const handleLanguageChange = async (language) => {
    Alert.alert(
      t('settings.language'),
      t('settings.language_change_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              setLoading(true);
              await i18n.changeLanguage(language);
              await AsyncStorage.setItem(STORAGE_KEY, language);
              setShowLanguageModal(false);
            } catch (error) {
              console.error('Error changing language:', error);
              Alert.alert(t('common.error'), t('errors.language_load'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDocumentPress = (type) => {
    setDocumentType(type);
    setShowDocumentViewer(true);
  };

  const handleNotificationToggle = async (type) => {
    try {
      const newSettings = {
        ...notificationSettings,
        [type]: !notificationSettings[type]
      };
      setNotificationSettings(newSettings);
      
      if (user) {
        await firestore()
          .collection('users')
          .doc(user.uid)
          .update({
            notificationSettings: newSettings
          });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      // Revert the change on error
      setNotificationSettings(notificationSettings);
    }
  };

  const handleClearMemory = () => {
    Alert.alert(
      t('settings.clear_memory'),
      t('settings.clear_memory_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await memorySystem.clearMemory();
              Alert.alert(t('common.success'), t('settings.memory_cleared'));
            } catch (error) {
              console.error('Error clearing memory:', error);
              Alert.alert(t('common.error'), t('errors.cache_error'));
            }
          }
        }
      ]
    );
  };

  const handleRestorePurchases = async () => {
    try {
      setLoading(true);
      const result = await revenueCatService.restorePurchases();
      if (result.success) {
        Alert.alert(t('common.success'), t('subscription.purchases_restored'));
      } else {
        Alert.alert(t('common.error'), result.error);
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(t('common.error'), error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const SettingItem = ({ icon, title, onPress, rightComponent }) => (
    <TouchableOpacity
      style={[styles.settingItem, isDarkMode && styles.darkSettingItem]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>{title}</Text>
      </View>
      {rightComponent || <Icon name="chevron-right" size={24} color={isDarkMode ? '#AAA' : '#666'} />}
    </TouchableOpacity>
  );

  const SettingSwitch = ({ icon, title, value, onValueChange }) => (
    <View style={[styles.settingItem, isDarkMode && styles.darkSettingItem]}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: theme.colors.primary }}
        thumbColor={value ? '#FFF' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>{t('settings.title')}</Text>
        <AdminPanel />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <View style={styles.profileSection}>
            <Image
              source={{ uri: userProfile?.avatar || 'https://via.placeholder.com/80' }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={[styles.username, isDarkMode && styles.darkText]}>
                {userProfile?.username || 'User'}
              </Text>
              <Text style={[styles.tier, isDarkMode && styles.darkTextSecondary]}>
                {userProfile?.tier || t('subscription.free_tier')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.language')}</Text>
          <SettingItem
            icon="language"
            title={i18n.language.toUpperCase()}
            onPress={() => setShowLanguageModal(true)}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.notifications')}</Text>
          <SettingSwitch
            icon="notifications"
            title={t('settings.notification_types.push')}
            value={notificationSettings.push}
            onValueChange={() => handleNotificationToggle('push')}
          />
          <SettingSwitch
            icon="email"
            title={t('settings.notification_types.email')}
            value={notificationSettings.email}
            onValueChange={() => handleNotificationToggle('email')}
          />
          <SettingSwitch
            icon="update"
            title={t('settings.notification_types.breeding_updates')}
            value={notificationSettings.breeding_updates}
            onValueChange={() => handleNotificationToggle('breeding_updates')}
          />
          <SettingSwitch
            icon="local-offer"
            title={t('settings.notification_types.price_alerts')}
            value={notificationSettings.price_alerts}
            onValueChange={() => handleNotificationToggle('price_alerts')}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.theme')}</Text>
          <SettingSwitch
            icon="brightness-6"
            title={t('settings.dark_mode')}
            value={isDarkMode}
            onValueChange={toggleTheme}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('subscription.title')}</Text>
          <SettingItem
            icon="card-membership"
            title={t('settings.manage_subscription')}
            onPress={() => navigation.navigate('Subscription')}
          />
          <SettingItem
            icon="restore"
            title={t('settings.restore_purchases')}
            onPress={handleRestorePurchases}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.memory_indicator')}</Text>
          <SettingItem
            icon="history"
            title={t('settings.conversation_history')}
            onPress={() => navigation.navigate('ConversationHistory')}
          />
          <SettingItem
            icon="delete-sweep"
            title={t('settings.clear_memory')}
            onPress={handleClearMemory}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.legal')}</Text>
          <SettingItem
            icon="privacy-tip"
            title={t('settings.privacy_policy')}
            onPress={() => handleDocumentPress('privacy')}
          />
          <SettingItem
            icon="description"
            title={t('settings.terms_of_service')}
            onPress={() => handleDocumentPress('terms')}
          />
          <SettingItem
            icon="school"
            title={t('settings.educational_disclaimer')}
            onPress={() => handleDocumentPress('disclaimer')}
          />
          <SettingItem
            icon="support-agent"
            title={t('settings.support')}
            onPress={() => handleDocumentPress('support')}
          />
        </View>

        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{t('settings.app_info')}</Text>
          <View style={styles.appInfo}>
            <Text style={[styles.infoText, isDarkMode && styles.darkTextSecondary]}>
              {t('settings.version')}: 1.0.0
            </Text>
            <Text style={[styles.infoText, isDarkMode && styles.darkTextSecondary]}>
              {t('settings.build')}: 2024.01.01
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <LanguageSelector
          currentLanguage={i18n.language}
          onSelect={handleLanguageChange}
          onClose={() => setShowLanguageModal(false)}
        />
      </Modal>

      <Modal
        visible={showDocumentViewer}
        animationType="slide"
        onRequestClose={() => setShowDocumentViewer(false)}
      >
        <DocumentViewer
          documentType={documentType}
          language={i18n.language}
          onClose={() => setShowDocumentViewer(false)}
        />
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};

// ===========================
// 9. LANGUAGE SELECTOR COMPONENT
// ===========================
const LanguageSelector = ({ currentLanguage, onSelect, onClose }) => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(ThemeContext);

  const languages = [
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' }
  ];

  return (
    <View style={[styles.modalContainer, isDarkMode && styles.darkModalContainer]}>
      <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>
            {t('settings.language')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
          </TouchableOpacity>
        </View>

        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageItem,
              currentLanguage === lang.code && styles.selectedLanguage
            ]}
            onPress={() => onSelect(lang.code)}
          >
            <Text style={styles.flag}>{lang.flag}</Text>
            <Text style={[
              styles.languageName,
              isDarkMode && styles.darkText,
              currentLanguage === lang.code && styles.selectedText
            ]}>
              {lang.name}
            </Text>
            {currentLanguage === lang.code && (
              <Icon name="check" size={24} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ===========================
// 10. DOCUMENT VIEWER COMPONENT
// ===========================
const DocumentViewer = ({ documentType, language, onClose }) => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [documentHtml, setDocumentHtml] = useState('');

  useEffect(() => {
    loadDocument();
  }, [documentType, language]);

  const loadDocument = async () => {
    setLoading(true);
    setError(false);

    try {
      const cacheKey = `@doc_${documentType}_${language}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const { html, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 86400000) {
          setDocumentHtml(html);
          setLoading(false);
          return;
        }
      }

      // Load from GitHub raw content (free hosting)
      const docPath = `https://raw.githubusercontent.com/Marcone1983/greed-gross-ai/main/legal/${language}/${documentType}.html`;
      const response = await fetch(docPath);
      const html = await response.text();

      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        html,
        timestamp: Date.now()
      }));

      setDocumentHtml(html);
    } catch (err) {
      console.error('Error loading document:', err);
      
      if (language !== 'en') {
        try {
          // Fallback to English from GitHub
          const fallbackPath = `https://raw.githubusercontent.com/Marcone1983/greed-gross-ai/main/legal/en/${documentType}.html`;
          const response = await fetch(fallbackPath);
          const html = await response.text();
          setDocumentHtml(html);
        } catch (fallbackErr) {
          setError(true);
        }
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const injectedJavaScript = `
    (function() {
      if (${isDarkMode}) {
        document.body.style.backgroundColor = '#121212';
        document.body.style.color = '#FFFFFF';
        
        const links = document.getElementsByTagName('a');
        for (let link of links) {
          link.style.color = '#2ECC40';
        }
      }
      
      document.body.style.padding = '16px';
      
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(meta);
    })();
  `;

  if (loading) {
    return (
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
            {t(`settings.${documentType}`)}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
            {t('legal.loading_document')}
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
            {t(`settings.${documentType}`)}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, isDarkMode && styles.darkText]}>
            {t('legal.document_not_available')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDocument}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
            {t(`settings.${documentType}`)}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <WebView
          source={{ html: documentHtml }}
          style={styles.webView}
          injectedJavaScript={injectedJavaScript}
          scalesPageToFit={false}
        />
      </SafeAreaView>
    </View>
  );
};

// ===========================
// 11. ADMIN PANEL (7-TAP UNLOCK)
// ===========================
const AdminPanel = ({ userId }) => {
  const { isDarkMode } = useContext(ThemeContext);
  const [tapCount, setTapCount] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedLanguage, setSelectedLanguage] = useState('it');
  const [documents, setDocuments] = useState({
    privacy: '',
    terms: '',
    disclaimer: '',
    support: ''
  });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const tapTimerRef = useRef(null);

  const handleLogoTap = () => {
    setTapCount(prev => prev + 1);
    
    clearTimeout(tapTimerRef.current);
    
    if (tapCount === 6) {
      setIsUnlocked(true);
      setTapCount(0);
      Alert.alert('Admin Mode', 'Admin panel unlocked!');
    }

    tapTimerRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2000);
  };

  const loadAnalytics = async () => {
    try {
      const [
        popularity,
        patterns,
        opportunities
      ] = await Promise.all([
        analyticsEngine.getStrainPopularity(),
        analyticsEngine.getUserPatterns(userId),
        analyticsEngine.getBreedingOpportunities()
      ]);

      setAnalyticsData({
        popularity,
        patterns,
        opportunities
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const createDocumentHTML = (type, content) => {
    const date = new Date().toLocaleDateString();
    return `
<!DOCTYPE html>
<html lang="${selectedLanguage}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type.toUpperCase()} - GREED & GROSS</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2ECC40;
            border-bottom: 2px solid #2ECC40;
            padding-bottom: 10px;
        }
        h2 {
            color: #FFD700;
            margin-top: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #E0E0E0;
            text-align: center;
            color: #666;
        }
        .last-updated {
            font-style: italic;
            color: #666;
            margin-bottom: 30px;
        }
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #121212;
                color: #E0E0E0;
            }
            h1, h2 {
                color: #2ECC40;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>GREED & GROSS</h1>
        <h2>${type.toUpperCase()}</h2>
        <p class="last-updated">Last updated: ${date}</p>
    </div>
    <main>
        ${content}
    </main>
    <footer class="footer">
        <p>© 2024 GREED & GROSS. All rights reserved.</p>
    </footer>
</body>
</html>
    `;
  };

  const uploadDocument = async (type, content) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const html = createDocumentHTML(type, content);
      const docPath = `legal/${selectedLanguage}/${type}.html`;
      const reference = storage().ref(docPath);
      
      const task = reference.putString(html, 'raw', {
        contentType: 'text/html'
      });

      task.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Error', 'Failed to upload document');
          setIsUploading(false);
        },
        async () => {
          setIsUploading(false);
          Alert.alert('Success', 'Document uploaded successfully');
          
          const cacheKey = `@doc_${type}_${selectedLanguage}`;
          try {
            await AsyncStorage.removeItem(cacheKey);
          } catch (error) {
            console.error('Error clearing cache:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error uploading document:', error);
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, []);

  if (!isUnlocked) {
    return (
      <TouchableOpacity 
        style={styles.hiddenTapArea} 
        onPress={handleLogoTap}
        activeOpacity={1}
      />
    );
  }

  return (
    <Modal
      visible={isUnlocked}
      animationType="slide"
      onRequestClose={() => setIsUnlocked(false)}
    >
      <SafeAreaView style={[styles.adminContainer, isDarkMode && styles.darkAdminContainer]}>
        <View style={styles.adminHeader}>
          <Text style={[styles.adminTitle, isDarkMode && styles.darkText]}>Admin Panel</Text>
          <TouchableOpacity onPress={() => setIsUnlocked(false)}>
            <Icon name="close" size={24} color={isDarkMode ? '#FFF' : theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
            onPress={() => setActiveTab('analytics')}
          >
            <Text style={styles.tabText}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'documents' && styles.activeTab]}
            onPress={() => setActiveTab('documents')}
          >
            <Text style={styles.tabText}>Documents</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'analytics' && (
          <ScrollView style={styles.adminContent}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
              Strain Popularity
            </Text>
          </ScrollView>
        )}

        {activeTab === 'documents' && (
          <ScrollView style={styles.adminContent}>
            <View style={styles.languageSelector}>
              {['it', 'en', 'es'].map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langButton,
                    selectedLanguage === lang && styles.activeLangButton
                  ]}
                  onPress={() => setSelectedLanguage(lang)}
                >
                  <Text style={styles.langButtonText}>{lang.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {Object.keys(documents).map(docType => (
              <View key={docType} style={styles.documentEditor}>
                <Text style={[styles.documentTitle, isDarkMode && styles.darkText]}>
                  {docType.charAt(0).toUpperCase() + docType.slice(1)}
                </Text>
                <TextInput
                  style={[styles.documentInput, isDarkMode && styles.darkInput]}
                  multiline
                  value={documents[docType]}
                  onChangeText={(text) => setDocuments(prev => ({
                    ...prev,
                    [docType]: text
                  }))}
                  placeholder={`Enter ${docType} content in HTML format...`}
                />
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => uploadDocument(docType, documents[docType])}
                >
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </TouchableOpacity>
              </View>
            ))}

            {isUploading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Uploading... {Math.round(uploadProgress)}%
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${uploadProgress}%` }
                    ]} 
                  />
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ===========================
// 12. PLACEHOLDER SCREENS
// ===========================
const LibraryScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Strain Library</Text>
    </SafeAreaView>
  );
};

const BreedingScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Breeding Simulator</Text>
    </SafeAreaView>
  );
};

const PremiumScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Premium Features</Text>
    </SafeAreaView>
  );
};

const SubscriptionScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Manage Subscription</Text>
    </SafeAreaView>
  );
};

const ConversationHistoryScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Conversation History</Text>
    </SafeAreaView>
  );
};

const AnalyticsDashboardScreen = () => {
  const { isDarkMode } = useContext(ThemeContext);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('week');
  const [selectedMetric, setSelectedMetric] = useState('popularity');

  useEffect(() => {
    loadAnalytics();
  }, [selectedTimeRange, selectedMetric]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await analyticsService.getDashboardData(selectedTimeRange, selectedMetric);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert(t('error'), t('analytics.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const renderMetricCard = (title, value, change, icon) => (
    <View style={[styles.metricCard, isDarkMode && styles.darkCard]}>
      <View style={styles.metricHeader}>
        <Icon name={icon} size={24} color={theme.colors.primary} />
        <Text style={[styles.metricTitle, isDarkMode && styles.darkText]}>{title}</Text>
      </View>
      <Text style={[styles.metricValue, isDarkMode && styles.darkText]}>{value}</Text>
      {change !== null && (
        <Text style={[
          styles.metricChange,
          { color: change >= 0 ? theme.colors.success : theme.colors.error }
        ]}>
          {change >= 0 ? '+' : ''}{change}%
        </Text>
      )}
    </View>
  );

  const renderStrainChart = () => {
    if (!analytics?.topStrains) return null;
    
    return (
      <View style={[styles.chartContainer, isDarkMode && styles.darkCard]}>
        <Text style={[styles.chartTitle, isDarkMode && styles.darkText]}>
          {t('analytics.topStrains')}
        </Text>
        {analytics.topStrains.map((strain, index) => (
          <View key={strain.id} style={styles.chartRow}>
            <Text style={[styles.chartLabel, isDarkMode && styles.darkText]} numberOfLines={1}>
              {index + 1}. {strain.name}
            </Text>
            <View style={styles.chartBarContainer}>
              <View 
                style={[
                  styles.chartBar,
                  { 
                    width: `${(strain.score / analytics.topStrains[0].score) * 100}%`,
                    backgroundColor: theme.colors.primary 
                  }
                ]}
              />
            </View>
            <Text style={[styles.chartValue, isDarkMode && styles.darkText]}>
              {strain.score}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, isDarkMode && styles.darkText]}>
          {t('analytics.title')}
        </Text>

        {/* Time Range Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRangeContainer}>
          {['day', 'week', 'month', 'year'].map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                selectedTimeRange === range && styles.timeRangeButtonActive
              ]}
              onPress={() => setSelectedTimeRange(range)}
            >
              <Text style={[
                styles.timeRangeText,
                selectedTimeRange === range && styles.timeRangeTextActive
              ]}>
                {t(`analytics.${range}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          {renderMetricCard(
            t('analytics.totalSearches'),
            analytics?.totalSearches || 0,
            analytics?.searchesChange || 0,
            'search'
          )}
          {renderMetricCard(
            t('analytics.uniqueUsers'),
            analytics?.uniqueUsers || 0,
            analytics?.usersChange || 0,
            'psychology'
          )}
          {renderMetricCard(
            t('analytics.avgSessionTime'),
            analytics?.avgSessionTime || '0m',
            analytics?.sessionChange || 0,
            'schedule'
          )}
          {renderMetricCard(
            t('analytics.conversionRate'),
            `${analytics?.conversionRate || 0}%`,
            analytics?.conversionChange || 0,
            'trending-up'
          )}
        </View>

        {/* Charts */}
        {renderStrainChart()}

        {/* User Behavior */}
        <View style={[styles.behaviorContainer, isDarkMode && styles.darkCard]}>
          <Text style={[styles.chartTitle, isDarkMode && styles.darkText]}>
            {t('analytics.userBehavior')}
          </Text>
          <View style={styles.behaviorRow}>
            <Text style={[styles.behaviorLabel, isDarkMode && styles.darkText]}>
              {t('analytics.avgSearchesPerUser')}
            </Text>
            <Text style={[styles.behaviorValue, isDarkMode && styles.darkText]}>
              {analytics?.avgSearchesPerUser || 0}
            </Text>
          </View>
          <View style={styles.behaviorRow}>
            <Text style={[styles.behaviorLabel, isDarkMode && styles.darkText]}>
              {t('analytics.returnRate')}
            </Text>
            <Text style={[styles.behaviorValue, isDarkMode && styles.darkText]}>
              {analytics?.returnRate || 0}%
            </Text>
          </View>
          <View style={styles.behaviorRow}>
            <Text style={[styles.behaviorLabel, isDarkMode && styles.darkText]}>
              {t('analytics.premiumConversion')}
            </Text>
            <Text style={[styles.behaviorValue, isDarkMode && styles.darkText]}>
              {analytics?.premiumConversion || 0}%
            </Text>
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            Alert.alert(
              t('analytics.export'),
              t('analytics.exportConfirm'),
              [
                { text: t('cancel'), style: 'cancel' },
                { text: t('export'), onPress: () => analyticsService.exportData(selectedTimeRange) }
              ]
            );
          }}
        >
          <Icon name="download" size={20} color="#FFF" />
          <Text style={styles.exportButtonText}>{t('analytics.exportData')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ===========================
// 14. NAVIGATION SETUP
// ===========================
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: isDarkMode ? '#666' : '#999',
        tabBarStyle: {
          backgroundColor: isDarkMode ? theme.colors.dark.surface : '#FFF',
          borderTopColor: isDarkMode ? '#333' : '#E0E0E0'
        },
        headerShown: false
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t('navigation.chat'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="chat" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          tabBarLabel: t('navigation.library'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="local-florist" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Breeding"
        component={BreedingScreen}
        options={{
          tabBarLabel: t('breeding.simulator'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="science" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Premium"
        component={PremiumScreen}
        options={{
          tabBarLabel: t('navigation.premium'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="star" size={size} color={color} />
          )
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

// ===========================
// 13. SPLASH SCREEN COMPONENT
// ===========================
const SplashScreen = ({ onAnimationComplete }) => {
  const [progress, setProgress] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            onAnimationComplete();
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [onAnimationComplete, fadeAnim, scaleAnim]);

  return (
    <View style={splashStyles.container}>
      <Animated.View
        style={[
          splashStyles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={splashStyles.logo}>
          <LazyImage 
            source={{uri: 'https://i.imgur.com/zkyXF7Y.png'}} 
            style={splashStyles.logoImage}
            resizeMode="contain"
            fallback={() => (
              <View style={[splashStyles.logoImage, {backgroundColor: '#2ECC40', justifyContent: 'center', alignItems: 'center'}]}>
                <Text style={{fontSize: 60}}>🌿</Text>
              </View>
            )}
          />
          <Text style={splashStyles.titleText}>GREED & GROSS</Text>
          <Text style={splashStyles.subtitleText}>Cannabis Breeding AI</Text>
        </View>
      </Animated.View>

      {/* Loading Bar */}
      <View style={splashStyles.loadingContainer}>
        <View style={splashStyles.progressBarBackground}>
          <View
            style={[
              splashStyles.progressBar,
              { width: `${progress}%` },
            ]}
          />
        </View>
        <Text style={splashStyles.loadingText}>
          {progress < 30 ? 'Initializing AI...' : 
           progress < 60 ? 'Loading strain database...' :
           progress < 90 ? 'Preparing breeding simulator...' :
           'Almost ready...'}
        </Text>
      </View>

      {/* Effects */}
      <View style={splashStyles.effects}>
        {[...Array(5)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              splashStyles.smokeEffect,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, -20],
                    }),
                  },
                ],
                left: `${20 + i * 15}%`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// ===========================
// 15. MAIN APP COMPONENT
// ===========================
const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Timeout di sicurezza - rimuove splash dopo 10 secondi
    const timeout = setTimeout(() => {
      setShowSplash(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  return (
    <ThemeProvider>
      <UserProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="ConversationHistory" component={ConversationHistoryScreen} />
            <Stack.Screen name="AnalyticsDashboard" component={AnalyticsDashboardScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </UserProvider>
    </ThemeProvider>
  );
};

// ===========================
// 15. STYLES
// ===========================
const styles = StyleSheet.create({
  // Main containers
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  darkContainer: {
    backgroundColor: theme.colors.dark.background
  },
  safeArea: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl
  },
  
  // Headers
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF'
  },
  darkHeader: {
    backgroundColor: theme.colors.dark.surface,
    borderBottomColor: '#333'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  
  // Text styles
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  darkText: {
    color: theme.colors.dark.text
  },
  darkTextSecondary: {
    color: theme.colors.dark.textSecondary
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  
  // Chat styles
  messagesContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  messageContainer: {
    marginVertical: theme.spacing.xs
  },
  userMessageContainer: {
    alignItems: 'flex-end'
  },
  aiMessageContainer: {
    alignItems: 'flex-start'
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4
  },
  aiBubble: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4
  },
  darkUserBubble: {
    backgroundColor: theme.colors.primary
  },
  darkAiBubble: {
    backgroundColor: theme.colors.dark.surface
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.text
  },
  userMessageText: {
    color: '#FFF'
  },
  darkMessageText: {
    color: theme.colors.dark.text
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  darkTimestamp: {
    color: '#666'
  },
  
  // Feedback
  feedbackContainer: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md
  },
  feedbackText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md
  },
  feedbackButton: {
    padding: theme.spacing.xs
  },
  
  // Typing indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  typingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  darkInputContainer: {
    backgroundColor: theme.colors.dark.surface,
    borderTopColor: '#333'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F5F5F5'
  },
  darkInput: {
    backgroundColor: theme.colors.dark.background,
    borderColor: '#333',
    color: theme.colors.dark.text
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0'
  },
  
  // Memory indicator
  memoryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md
  },
  memoryText: {
    fontSize: 12,
    color: theme.colors.primary,
    marginLeft: 4
  },
  
  // Settings
  content: {
    flex: 1
  },
  section: {
    backgroundColor: '#FFF',
    marginVertical: theme.spacing.xs,
    paddingVertical: theme.spacing.sm
  },
  darkSection: {
    backgroundColor: theme.colors.dark.surface
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase'
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: theme.spacing.md
  },
  profileInfo: {
    flex: 1
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  tier: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#FFF'
  },
  darkSettingItem: {
    backgroundColor: theme.colors.dark.surface
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  settingText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: theme.spacing.md
  },
  appInfo: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginVertical: 2
  },
  
  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  darkModalContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)'
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing.xl
  },
  darkModalContent: {
    backgroundColor: theme.colors.dark.surface
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  
  // Language selector
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  selectedLanguage: {
    backgroundColor: theme.colors.primary + '20'
  },
  flag: {
    fontSize: 24,
    marginRight: theme.spacing.md
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text
  },
  selectedText: {
    color: theme.colors.primary,
    fontWeight: 'bold'
  },
  
  // Buttons
  retryButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  
  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  
  // WebView
  webView: {
    flex: 1
  },
  
  // Admin panel
  hiddenTapArea: {
    width: 44,
    height: 44
  },
  adminContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  darkAdminContainer: {
    backgroundColor: theme.colors.dark.background
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  adminTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center'
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.primary
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600'
  },
  adminContent: {
    flex: 1,
    padding: theme.spacing.md
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg
  },
  langButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#E0E0E0'
  },
  activeLangButton: {
    backgroundColor: theme.colors.primary
  },
  langButtonText: {
    fontWeight: 'bold',
    color: '#FFF'
  },
  documentEditor: {
    marginBottom: theme.spacing.xl
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm
  },
  documentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 200,
    backgroundColor: '#FFF',
    textAlignVertical: 'top'
  },
  darkInput: {
    backgroundColor: theme.colors.dark.surface,
    color: theme.colors.dark.text,
    borderColor: '#333'
  },
  uploadButton: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  uploadButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  progressContainer: {
    padding: theme.spacing.md
  },
  progressText: {
    marginBottom: theme.spacing.sm,
    textAlign: 'center'
  },
  progressBar: {
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary
  },

  // Analytics Dashboard Styles
  timeRangeContainer: {
    paddingVertical: theme.spacing.md
  },
  timeRangeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: '#F0F0F0'
  },
  timeRangeButtonActive: {
    backgroundColor: theme.colors.primary
  },
  timeRangeText: {
    fontSize: 14,
    color: '#666'
  },
  timeRangeTextActive: {
    color: '#FFF',
    fontWeight: 'bold'
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  metricTitle: {
    fontSize: 12,
    color: '#666',
    marginLeft: theme.spacing.xs
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  metricChange: {
    fontSize: 12,
    marginTop: theme.spacing.xs
  },
  chartContainer: {
    backgroundColor: '#FFF',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.md
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  chartLabel: {
    flex: 0.3,
    fontSize: 14
  },
  chartBarContainer: {
    flex: 0.5,
    height: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.sm
  },
  chartBar: {
    height: '100%',
    borderRadius: 10
  },
  chartValue: {
    flex: 0.2,
    fontSize: 14,
    textAlign: 'right'
  },
  behaviorContainer: {
    backgroundColor: '#FFF',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.md
  },
  behaviorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  behaviorLabel: {
    fontSize: 14,
    color: '#666'
  },
  behaviorValue: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg
  },
  exportButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm
  }
});

// Splash Screen Styles
const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logo: {
    alignItems: 'center',
  },
  logoImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2ECC40',
    letterSpacing: 2,
    marginBottom: 10,
  },
  subtitleText: {
    fontSize: 18,
    color: '#FFD700',
    letterSpacing: 1,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    width: '80%',
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2ECC40',
    borderRadius: 3,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
  },
  effects: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  smokeEffect: {
    position: 'absolute',
    bottom: 50,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(46, 204, 64, 0.2)',
    borderRadius: 40,
    transform: [{ scale: 2 }],
  },
  // Error Boundary styles
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#2ECC40',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, styles.errorContainer]}>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.error?.toString()}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Wrap App with ErrorBoundary
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;
