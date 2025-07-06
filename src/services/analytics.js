import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===========================
// PRODUCTION ANALYTICS SYSTEM
// ===========================

export class AnalyticsCollector {
  static async recordInteraction(data) {
    try {
      const interaction = {
        userId: data.userId,
        sessionId: data.sessionId,
        queryType: this.classifyQuery(data.query),
        userQuery: data.query,
        aiResponse: data.response,
        strainsMentioned: this.extractStrains(data.response),
        effectsRequested: this.extractEffects(data.query),
        queryIntent: this.detectIntent(data.query),
        timestamp: firestore.FieldValue.serverTimestamp(),
        userLocation: data.userLocation || await this.detectLocation(),
        deviceType: data.deviceType,
        userSatisfaction: data.satisfaction,
        followUpQuestions: data.followUpCount || 0,
        sessionDuration: data.duration,
        userAgeRange: data.ageRange,
        responseLength: data.response.length,
        hasBreedingInfo: this.hasBreedingInfo(data.response),
        hasMedicalInfo: this.hasMedicalInfo(data.response),
        experienceLevel: await this.detectExperienceLevel(data.userId)
      };
      
      // Save to Firestore
      await firestore().collection('user_interactions').add(interaction);
      
      // Update aggregated stats
      await this.updateUserPreferences(data.userId, interaction);
      await this.updateStrainAnalytics(interaction.strainsMentioned);
      
      // Log to Firebase Analytics
      await analytics().logEvent('ai_interaction', {
        query_type: interaction.queryType,
        query_intent: interaction.queryIntent,
        strains_count: interaction.strainsMentioned.length,
        satisfaction: interaction.userSatisfaction
      });
      
      return interaction;
    } catch (error) {
      console.error('Error recording interaction:', error);
      throw error;
    }
  }
  
  static classifyQuery(query) {
    const q = query.toLowerCase();
    if (q.match(/\b(cross|breed|incrocio|parent|f1|f2|backcross)\b/)) return 'breeding';
    if (q.match(/\b(recommend|suggest|consiglia|best|migliore)\b/)) return 'recommendation';
    if (q.match(/\b(how|why|what|come|perché|cosa|explain)\b/)) return 'education';
    if (q.match(/\b(problem|issue|help|aiuto|problema)\b/)) return 'troubleshooting';
    return 'general';
  }
  
  static extractStrains(text) {
    // Comprehensive strain pattern matching
    const strainPatterns = [
      // Standard strain names (Capital Letter + Capital Letter)
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
      // Numbered strains (e.g., "Gelato #33")
      /\b([A-Z][a-z]+\s+#\d+)\b/g,
      // Acronym strains (e.g., "OG Kush", "AK 47")
      /\b([A-Z]{2,}\s+[A-Z][a-z]+)\b/g,
      /\b([A-Z]{2,}\s+\d+)\b/g,
      // Triple word strains
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
      // Special patterns
      /\b(Super\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+\s+Auto)\b/g
    ];
    
    const strains = new Set();
    const commonWords = ['The Best', 'La Migliore', 'Il Risultato', 'Very Good', 'Super Strong'];
    
    strainPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!commonWords.includes(match) && match.length > 3) {
            strains.add(match.trim());
          }
        });
      }
    });
    
    return Array.from(strains);
  }
  
  static extractEffects(query) {
    const effectKeywords = {
      creative: ['creative', 'creativity', 'creativo', 'creatività'],
      energetic: ['energetic', 'energy', 'energizzante', 'energia'],
      relaxing: ['relax', 'relaxing', 'rilassante', 'calming'],
      sleepy: ['sleep', 'sleepy', 'dormire', 'sonnolenza'],
      focused: ['focus', 'concentration', 'concentrazione'],
      happy: ['happy', 'euphoric', 'felice', 'euforia'],
      hungry: ['hungry', 'appetite', 'fame', 'appetito'],
      uplifted: ['uplifted', 'mood', 'umore'],
      talkative: ['talkative', 'social', 'sociale'],
      giggly: ['giggly', 'laugh', 'ridere']
    };
    
    const effects = [];
    const queryLower = query.toLowerCase();
    
    Object.entries(effectKeywords).forEach(([effect, keywords]) => {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        effects.push(effect);
      }
    });
    
    return effects;
  }
  
  static detectIntent(query) {
    const intents = {
      sleep_aid: /\b(sleep|insomnia|dormire|insonnia)\b/i,
      pain_relief: /\b(pain|dolor|dolore|ache)\b/i,
      anxiety_relief: /\b(anxiety|ansia|stress|panic)\b/i,
      creativity: /\b(creative|creativity|creativ|artist)\b/i,
      energy: /\b(energy|energetic|energi|active)\b/i,
      focus: /\b(focus|concentration|study|concentr)\b/i,
      appetite: /\b(appetite|hungry|fame|eating)\b/i,
      recreation: /\b(fun|party|social|divertimento)\b/i,
      medical: /\b(medical|medicinal|therapeutic|terapeutic)\b/i,
      growing: /\b(grow|coltiv|harvest|raccolt)\b/i
    };
    
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(query)) {
        return intent;
      }
    }
    
    return 'general_inquiry';
  }
  
  static async detectLocation() {
    try {
      // In production, use a proper geolocation service
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return data.country_code || 'XX';
    } catch (error) {
      return 'XX';
    }
  }
  
  static hasBreedingInfo(text) {
    return /\b(f1|f2|phenotype|genotype|backcross|hybrid|parent|cross)\b/i.test(text);
  }
  
  static hasMedicalInfo(text) {
    return /\b(medical|therapeutic|cbd|relief|treatment|symptom)\b/i.test(text);
  }
  
  static async detectExperienceLevel(userId) {
    try {
      const interactions = await firestore()
        .collection('user_interactions')
        .where('userId', '==', userId)
        .get();
      
      const count = interactions.size;
      if (count < 10) return 'beginner';
      if (count < 50) return 'intermediate';
      return 'expert';
    } catch (error) {
      return 'beginner';
    }
  }
  
  static async updateUserPreferences(userId, interaction) {
    try {
      const userRef = firestore().collection('user_preferences').doc(userId);
      const doc = await userRef.get();
      
      const currentPrefs = doc.exists ? doc.data() : {
        preferredStrains: [],
        avoidedStrains: [],
        preferredEffects: [],
        avoidedEffects: [],
        typicalUseCases: [],
        experienceLevel: 'beginner',
        growingType: null
      };
      
      // Update preferences based on interaction
      if (interaction.strainsMentioned.length > 0) {
        currentPrefs.preferredStrains = [
          ...new Set([...currentPrefs.preferredStrains, ...interaction.strainsMentioned])
        ].slice(-20); // Keep last 20
      }
      
      if (interaction.effectsRequested.length > 0) {
        currentPrefs.preferredEffects = [
          ...new Set([...currentPrefs.preferredEffects, ...interaction.effectsRequested])
        ].slice(-10);
      }
      
      if (interaction.queryIntent !== 'general_inquiry') {
        currentPrefs.typicalUseCases = [
          ...new Set([...currentPrefs.typicalUseCases, interaction.queryIntent])
        ].slice(-5);
      }
      
      currentPrefs.lastUpdated = firestore.FieldValue.serverTimestamp();
      currentPrefs.experienceLevel = interaction.experienceLevel;
      
      await userRef.set(currentPrefs, { merge: true });
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }
  
  static async updateStrainAnalytics(strainsMentioned) {
    if (strainsMentioned.length === 0) return;
    
    try {
      const batch = firestore().batch();
      
      for (const strain of strainsMentioned) {
        const strainRef = firestore().collection('strain_analytics').doc(strain);
        
        batch.set(strainRef, {
          strainName: strain,
          totalRequests: firestore.FieldValue.increment(1),
          lastRequested: firestore.FieldValue.serverTimestamp(),
          monthlyRequests: firestore.FieldValue.increment(1)
        }, { merge: true });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error updating strain analytics:', error);
    }
  }
}

// ===========================
// ANALYTICS ENGINE
// ===========================

export class AnalyticsEngine {
  static cache = new Map();
  static CACHE_TTL = 300000; // 5 minutes
  
  static async getCached(key, fetcher) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
  
  // Top Requested Strains with detailed metrics
  static async getStrainPopularity(timeframe = '30d') {
    return this.getCached(`strain_popularity_${timeframe}`, async () => {
      const daysAgo = parseInt(timeframe) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      
      const interactions = await firestore()
        .collection('user_interactions')
        .where('timestamp', '>=', startDate)
        .get();
      
      const strainStats = {};
      
      interactions.forEach(doc => {
        const data = doc.data();
        const strains = data.strainsMentioned || [];
        
        strains.forEach(strain => {
          if (!strainStats[strain]) {
            strainStats[strain] = {
              strainName: strain,
              totalRequests: 0,
              positiveFeedback: 0,
              totalSatisfaction: 0,
              uniqueUsers: new Set(),
              queryTypes: {},
              effects: {},
              intents: {}
            };
          }
          
          strainStats[strain].totalRequests++;
          strainStats[strain].uniqueUsers.add(data.userId);
          
          if (data.userSatisfaction >= 4) {
            strainStats[strain].positiveFeedback++;
          }
          
          if (data.userSatisfaction) {
            strainStats[strain].totalSatisfaction += data.userSatisfaction;
          }
          
          // Track query types
          strainStats[strain].queryTypes[data.queryType] = 
            (strainStats[strain].queryTypes[data.queryType] || 0) + 1;
          
          // Track associated effects
          (data.effectsRequested || []).forEach(effect => {
            strainStats[strain].effects[effect] = 
              (strainStats[strain].effects[effect] || 0) + 1;
          });
          
          // Track intents
          strainStats[strain].intents[data.queryIntent] = 
            (strainStats[strain].intents[data.queryIntent] || 0) + 1;
        });
      });
      
      // Convert to array and calculate averages
      const results = Object.values(strainStats).map(strain => ({
        strainName: strain.strainName,
        totalRequests: strain.totalRequests,
        positiveFeedback: strain.positiveFeedback,
        avgSatisfaction: strain.totalSatisfaction / strain.totalRequests || 0,
        uniqueUsers: strain.uniqueUsers.size,
        popularityScore: this.calculatePopularityScore(strain),
        dominantQueryType: this.getDominant(strain.queryTypes),
        topEffects: this.getTop3(strain.effects),
        primaryIntent: this.getDominant(strain.intents)
      }));
      
      return results.sort((a, b) => b.popularityScore - a.popularityScore);
    });
  }
  
  static calculatePopularityScore(strain) {
    // Weighted scoring algorithm
    const requestWeight = 0.3;
    const uniqueUserWeight = 0.3;
    const satisfactionWeight = 0.2;
    const feedbackWeight = 0.2;
    
    const normalizedRequests = Math.min(strain.totalRequests / 100, 1);
    const normalizedUsers = Math.min(strain.uniqueUsers.size / 50, 1);
    const normalizedSatisfaction = (strain.totalSatisfaction / strain.totalRequests) / 5 || 0;
    const normalizedFeedback = strain.positiveFeedback / strain.totalRequests || 0;
    
    return (
      normalizedRequests * requestWeight +
      normalizedUsers * uniqueUserWeight +
      normalizedSatisfaction * satisfactionWeight +
      normalizedFeedback * feedbackWeight
    ) * 100;
  }
  
  static getDominant(obj) {
    return Object.entries(obj).reduce((a, b) => a[1] > b[1] ? a : b, ['none', 0])[0];
  }
  
  static getTop3(obj) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);
  }
  
  // User Behavior Patterns Analysis
  static async getUserPatterns(userId = null) {
    return this.getCached(`user_patterns_${userId || 'all'}`, async () => {
      let query = firestore().collection('user_interactions');
      
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      
      const interactions = await query.limit(1000).get();
      
      const patterns = {
        queryTypeDistribution: {},
        intentDistribution: {},
        timeOfDayDistribution: Array(24).fill(0),
        dayOfWeekDistribution: Array(7).fill(0),
        averageSessionDuration: 0,
        averageQueriesPerSession: 0,
        effectsCombinations: {},
        strainProgressions: [],
        userJourneys: []
      };
      
      const sessions = {};
      let totalDuration = 0;
      let sessionCount = 0;
      
      interactions.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp.toDate();
        
        // Query type distribution
        patterns.queryTypeDistribution[data.queryType] = 
          (patterns.queryTypeDistribution[data.queryType] || 0) + 1;
        
        // Intent distribution
        patterns.intentDistribution[data.queryIntent] = 
          (patterns.intentDistribution[data.queryIntent] || 0) + 1;
        
        // Time patterns
        patterns.timeOfDayDistribution[timestamp.getHours()]++;
        patterns.dayOfWeekDistribution[timestamp.getDay()]++;
        
        // Session tracking
        if (!sessions[data.sessionId]) {
          sessions[data.sessionId] = {
            queries: [],
            duration: 0,
            strains: new Set()
          };
          sessionCount++;
        }
        
        sessions[data.sessionId].queries.push(data);
        sessions[data.sessionId].duration = data.sessionDuration || 0;
        data.strainsMentioned?.forEach(s => sessions[data.sessionId].strains.add(s));
        
        totalDuration += data.sessionDuration || 0;
        
        // Effects combinations
        if (data.effectsRequested?.length > 1) {
          const combo = data.effectsRequested.sort().join('+');
          patterns.effectsCombinations[combo] = 
            (patterns.effectsCombinations[combo] || 0) + 1;
        }
      });
      
      // Calculate averages
      patterns.averageSessionDuration = totalDuration / sessionCount || 0;
      patterns.averageQueriesPerSession = interactions.size / sessionCount || 0;
      
      // Analyze strain progressions (what users search after each strain)
      Object.values(sessions).forEach(session => {
        const strains = Array.from(session.strains);
        if (strains.length > 1) {
          for (let i = 0; i < strains.length - 1; i++) {
            patterns.strainProgressions.push({
              from: strains[i],
              to: strains[i + 1]
            });
          }
        }
      });
      
      // Identify common user journeys
      patterns.userJourneys = this.identifyUserJourneys(sessions);
      
      return patterns;
    });
  }
  
  static identifyUserJourneys(sessions) {
    const journeys = {};
    
    Object.values(sessions).forEach(session => {
      const journey = session.queries
        .map(q => q.queryType)
        .join(' → ');
      
      if (!journeys[journey]) {
        journeys[journey] = {
          pattern: journey,
          count: 0,
          avgSatisfaction: 0,
          totalSatisfaction: 0
        };
      }
      
      journeys[journey].count++;
      
      const satisfaction = session.queries
        .filter(q => q.userSatisfaction)
        .reduce((sum, q) => sum + q.userSatisfaction, 0);
      
      journeys[journey].totalSatisfaction += satisfaction;
    });
    
    return Object.values(journeys)
      .map(j => ({
        ...j,
        avgSatisfaction: j.totalSatisfaction / j.count || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  // Strain Correlation Analysis
  static async getStrainCorrelations() {
    return this.getCached('strain_correlations', async () => {
      const interactions = await firestore()
        .collection('user_interactions')
        .where('strainsMentioned', '!=', [])
        .limit(5000)
        .get();
      
      const userStrains = {};
      const coOccurrences = {};
      
      // Build user-strain mapping
      interactions.forEach(doc => {
        const data = doc.data();
        if (!userStrains[data.userId]) {
          userStrains[data.userId] = new Set();
        }
        data.strainsMentioned.forEach(strain => {
          userStrains[data.userId].add(strain);
        });
      });
      
      // Calculate co-occurrences
      Object.values(userStrains).forEach(strainSet => {
        const strains = Array.from(strainSet);
        
        for (let i = 0; i < strains.length; i++) {
          for (let j = i + 1; j < strains.length; j++) {
            const pair = [strains[i], strains[j]].sort().join(' ↔ ');
            coOccurrences[pair] = (coOccurrences[pair] || 0) + 1;
          }
        }
      });
      
      // Calculate correlation strength
      const correlations = Object.entries(coOccurrences)
        .filter(([_, count]) => count >= 3) // Minimum threshold
        .map(([pair, count]) => {
          const [strainA, strainB] = pair.split(' ↔ ');
          const usersWithA = Object.values(userStrains)
            .filter(set => set.has(strainA)).length;
          const usersWithB = Object.values(userStrains)
            .filter(set => set.has(strainB)).length;
          
          const correlationStrength = count / Math.min(usersWithA, usersWithB);
          
          return {
            strainA,
            strainB,
            coOccurrenceCount: count,
            correlationPercentage: (correlationStrength * 100).toFixed(2),
            strength: correlationStrength > 0.5 ? 'strong' : 
                     correlationStrength > 0.3 ? 'moderate' : 'weak'
          };
        })
        .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount);
      
      return correlations;
    });
  }
  
  // Geographic Insights
  static async getGeographicInsights() {
    return this.getCached('geographic_insights', async () => {
      const interactions = await firestore()
        .collection('user_interactions')
        .where('userLocation', '!=', 'XX')
        .get();
      
      const locationData = {};
      
      interactions.forEach(doc => {
        const data = doc.data();
        const location = data.userLocation;
        
        if (!locationData[location]) {
          locationData[location] = {
            location,
            totalQueries: 0,
            uniqueUsers: new Set(),
            popularStrains: {},
            commonIntents: {},
            avgSatisfaction: 0,
            totalSatisfaction: 0,
            preferredQueryTypes: {},
            timeZoneActivity: Array(24).fill(0)
          };
        }
        
        const loc = locationData[location];
        loc.totalQueries++;
        loc.uniqueUsers.add(data.userId);
        
        // Track strains
        data.strainsMentioned?.forEach(strain => {
          loc.popularStrains[strain] = (loc.popularStrains[strain] || 0) + 1;
        });
        
        // Track intents
        loc.commonIntents[data.queryIntent] = 
          (loc.commonIntents[data.queryIntent] || 0) + 1;
        
        // Track query types
        loc.preferredQueryTypes[data.queryType] = 
          (loc.preferredQueryTypes[data.queryType] || 0) + 1;
        
        // Satisfaction
        if (data.userSatisfaction) {
          loc.totalSatisfaction += data.userSatisfaction;
        }
        
        // Time patterns
        const hour = data.timestamp.toDate().getHours();
        loc.timeZoneActivity[hour]++;
      });
      
      // Process and format results
      const results = Object.values(locationData)
        .map(loc => ({
          location: loc.location,
          totalQueries: loc.totalQueries,
          uniqueUsers: loc.uniqueUsers.size,
          avgSatisfaction: loc.totalSatisfaction / loc.totalQueries || 0,
          topStrains: this.getTopN(loc.popularStrains, 5),
          primaryIntent: this.getDominant(loc.commonIntents),
          preferredQueryType: this.getDominant(loc.preferredQueryTypes),
          peakActivityHour: loc.timeZoneActivity.indexOf(Math.max(...loc.timeZoneActivity)),
          engagementScore: this.calculateEngagementScore(loc)
        }))
        .sort((a, b) => b.totalQueries - a.totalQueries);
      
      return results;
    });
  }
  
  static getTopN(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, value]) => ({ name: key, count: value }));
  }
  
  static calculateEngagementScore(locationData) {
    const queryWeight = 0.3;
    const userWeight = 0.3;
    const satisfactionWeight = 0.4;
    
    const normalizedQueries = Math.min(locationData.totalQueries / 1000, 1);
    const normalizedUsers = Math.min(locationData.uniqueUsers.size / 100, 1);
    const normalizedSatisfaction = locationData.avgSatisfaction / 5;
    
    return (
      normalizedQueries * queryWeight +
      normalizedUsers * userWeight +
      normalizedSatisfaction * satisfactionWeight
    ) * 100;
  }
  
  // Trend Detection
  static async detectTrends() {
    return this.getCached('trends', async () => {
      const now = new Date();
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      
      const recentInteractions = await firestore()
        .collection('user_interactions')
        .where('timestamp', '>=', fourWeeksAgo)
        .orderBy('timestamp', 'desc')
        .get();
      
      // Organize by week
      const weeklyData = {
        week1: {}, // Current week
        week2: {},
        week3: {},
        week4: {}  // 4 weeks ago
      };
      
      recentInteractions.forEach(doc => {
        const data = doc.data();
        const weeksSinceStart = Math.floor(
          (now - data.timestamp.toDate()) / (7 * 24 * 60 * 60 * 1000)
        );
        
        let weekKey;
        if (weeksSinceStart === 0) weekKey = 'week1';
        else if (weeksSinceStart === 1) weekKey = 'week2';
        else if (weeksSinceStart === 2) weekKey = 'week3';
        else if (weeksSinceStart === 3) weekKey = 'week4';
        else return;
        
        data.strainsMentioned?.forEach(strain => {
          if (!weeklyData[weekKey][strain]) {
            weeklyData[weekKey][strain] = 0;
          }
          weeklyData[weekKey][strain]++;
        });
      });
      
      // Calculate trends
      const trends = [];
      const allStrains = new Set();
      
      Object.values(weeklyData).forEach(week => {
        Object.keys(week).forEach(strain => allStrains.add(strain));
      });
      
      allStrains.forEach(strain => {
        const week1Count = weeklyData.week1[strain] || 0;
        const week2Count = weeklyData.week2[strain] || 0;
        const week3Count = weeklyData.week3[strain] || 0;
        const week4Count = weeklyData.week4[strain] || 0;
        
        // Skip strains with too little data
        if (week1Count + week2Count + week3Count + week4Count < 5) return;
        
        const weekOverWeekGrowth = week2Count > 0 ? 
          ((week1Count - week2Count) / week2Count * 100) : 
          (week1Count > 0 ? 100 : 0);
        
        const monthOverMonthGrowth = week4Count > 0 ? 
          ((week1Count - week4Count) / week4Count * 100) : 
          (week1Count > 0 ? 100 : 0);
        
        const momentum = this.calculateMomentum([week4Count, week3Count, week2Count, week1Count]);
        
        trends.push({
          strainName: strain,
          currentWeekRequests: week1Count,
          previousWeekRequests: week2Count,
          weekOverWeekGrowth: weekOverWeekGrowth.toFixed(2),
          monthOverMonthGrowth: monthOverMonthGrowth.toFixed(2),
          momentum,
          trendStatus: this.getTrendStatus(weekOverWeekGrowth, monthOverMonthGrowth),
          predictedNextWeek: this.predictNextWeek([week4Count, week3Count, week2Count, week1Count])
        });
      });
      
      return trends.sort((a, b) => b.momentum - a.momentum);
    });
  }
  
  static calculateMomentum(weekCounts) {
    // Weighted average giving more importance to recent weeks
    const weights = [0.1, 0.2, 0.3, 0.4];
    const weightedSum = weekCounts.reduce((sum, count, i) => sum + count * weights[i], 0);
    const avgCount = weekCounts.reduce((sum, count) => sum + count, 0) / 4;
    
    return avgCount > 0 ? (weightedSum / avgCount * 100) : 0;
  }
  
  static getTrendStatus(weekGrowth, monthGrowth) {
    if (weekGrowth > 50 && monthGrowth > 100) return '🔥 Hot';
    if (weekGrowth > 20 && monthGrowth > 50) return '📈 Rising';
    if (weekGrowth > -20 && weekGrowth < 20) return '➡️ Stable';
    if (weekGrowth < -20) return '📉 Declining';
    return '🆕 Emerging';
  }
  
  static predictNextWeek(weekCounts) {
    // Simple linear regression
    const n = weekCounts.length;
    const sumX = n * (n - 1) / 2;
    const sumY = weekCounts.reduce((sum, y) => sum + y, 0);
    const sumXY = weekCounts.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const prediction = Math.max(0, Math.round(slope * n + intercept));
    return prediction;
  }
  
  // Market Opportunities Detection
  static async getBreedingOpportunities() {
    return this.getCached('breeding_opportunities', async () => {
      const interactions = await firestore()
        .collection('user_interactions')
        .where('effectsRequested', '!=', [])
        .get();
      
      const effectCombinations = {};
      const unmetNeeds = [];
      
      interactions.forEach(doc => {
        const data = doc.data();
        
        if (data.effectsRequested.length >= 2) {
          const combo = data.effectsRequested.sort().join('+');
          
          if (!effectCombinations[combo]) {
            effectCombinations[combo] = {
              effects: data.effectsRequested,
              requestCount: 0,
              suggestedStrains: new Set(),
              avgSatisfaction: 0,
              totalSatisfaction: 0,
              exampleQueries: []
            };
          }
          
          effectCombinations[combo].requestCount++;
          
          if (data.userSatisfaction) {
            effectCombinations[combo].totalSatisfaction += data.userSatisfaction;
          }
          
          data.strainsMentioned?.forEach(strain => {
            effectCombinations[combo].suggestedStrains.add(strain);
          });
          
          if (effectCombinations[combo].exampleQueries.length < 3) {
            effectCombinations[combo].exampleQueries.push(data.userQuery);
          }
        }
      });
      
      // Analyze opportunities
      Object.entries(effectCombinations).forEach(([combo, data]) => {
        data.avgSatisfaction = data.totalSatisfaction / data.requestCount || 0;
        
        const opportunity = {
          desiredEffects: data.effects,
          effectsCombination: combo,
          requestCount: data.requestCount,
          currentOptions: Array.from(data.suggestedStrains),
          avgSatisfaction: data.avgSatisfaction,
          opportunityLevel: 'LOW',
          marketGap: 0,
          exampleQueries: data.exampleQueries
        };
        
        // Determine opportunity level
        if (data.suggestedStrains.size < 3 && data.requestCount >= 10) {
          opportunity.opportunityLevel = 'HIGH';
          opportunity.marketGap = 90;
        } else if (data.suggestedStrains.size < 6 && data.requestCount >= 5) {
          opportunity.opportunityLevel = 'MEDIUM';
          opportunity.marketGap = 60;
        } else if (data.avgSatisfaction < 3.5 && data.requestCount >= 10) {
          opportunity.opportunityLevel = 'MEDIUM';
          opportunity.marketGap = 50;
        } else {
          opportunity.marketGap = 20;
        }
        
        unmetNeeds.push(opportunity);
      });
      
      return unmetNeeds
        .sort((a, b) => b.marketGap - a.marketGap)
        .slice(0, 20);
    });
  }
  
  // User Segmentation
  static async getUserSegmentation() {
    return this.getCached('user_segmentation', async () => {
      const userPrefs = await firestore()
        .collection('user_preferences')
        .get();
      
      const segments = {
        medical: { users: [], characteristics: {} },
        recreational: { users: [], characteristics: {} },
        growers: { users: [], characteristics: {} },
        connoisseurs: { users: [], characteristics: {} },
        beginners: { users: [], characteristics: {} }
      };
      
      userPrefs.forEach(doc => {
        const data = doc.data();
        const userId = doc.id;
        
        // Classify user into segments
        const segment = this.classifyUserSegment(data);
        
        segments[segment].users.push({
          userId,
          preferences: data
        });
        
        // Aggregate characteristics
        this.aggregateSegmentCharacteristics(segments[segment].characteristics, data);
      });
      
      // Calculate segment insights
      const segmentInsights = Object.entries(segments).map(([name, data]) => ({
        segmentName: name,
        userCount: data.users.length,
        characteristics: this.summarizeCharacteristics(data.characteristics),
        topStrains: this.getTopFromAggregated(data.characteristics.strains || {}),
        topEffects: this.getTopFromAggregated(data.characteristics.effects || {}),
        avgExperienceLevel: this.getAverageExperience(data.users)
      }));
      
      return segmentInsights;
    });
  }
  
  static classifyUserSegment(preferences) {
    const useCases = preferences.typicalUseCases || [];
    const experience = preferences.experienceLevel;
    
    if (useCases.includes('medical') || useCases.includes('pain_relief') || 
        useCases.includes('anxiety_relief')) {
      return 'medical';
    }
    
    if (useCases.includes('growing') || preferences.growingType) {
      return 'growers';
    }
    
    if (experience === 'expert' && preferences.preferredStrains?.length > 10) {
      return 'connoisseurs';
    }
    
    if (experience === 'beginner') {
      return 'beginners';
    }
    
    return 'recreational';
  }
  
  static aggregateSegmentCharacteristics(characteristics, userData) {
    // Initialize if needed
    if (!characteristics.strains) characteristics.strains = {};
    if (!characteristics.effects) characteristics.effects = {};
    if (!characteristics.useCases) characteristics.useCases = {};
    
    // Aggregate strains
    userData.preferredStrains?.forEach(strain => {
      characteristics.strains[strain] = (characteristics.strains[strain] || 0) + 1;
    });
    
    // Aggregate effects
    userData.preferredEffects?.forEach(effect => {
      characteristics.effects[effect] = (characteristics.effects[effect] || 0) + 1;
    });
    
    // Aggregate use cases
    userData.typicalUseCases?.forEach(useCase => {
      characteristics.useCases[useCase] = (characteristics.useCases[useCase] || 0) + 1;
    });
  }
  
  static summarizeCharacteristics(characteristics) {
    return {
      dominantUseCase: this.getDominant(characteristics.useCases || {}),
      strainVariety: Object.keys(characteristics.strains || {}).length,
      effectDiversity: Object.keys(characteristics.effects || {}).length
    };
  }
  
  static getTopFromAggregated(obj) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ name: key, count }));
  }
  
  static getAverageExperience(users) {
    const experienceLevels = { beginner: 1, intermediate: 2, expert: 3 };
    const total = users.reduce((sum, user) => 
      sum + (experienceLevels[user.preferences.experienceLevel] || 1), 0);
    
    const avg = total / users.length;
    if (avg < 1.5) return 'beginner';
    if (avg < 2.5) return 'intermediate';
    return 'expert';
  }
}

// ===========================
// ANALYTICS DASHBOARD API
// ===========================

export class AnalyticsDashboard {
  static async getDashboardMetrics() {
    try {
      const [
        totalUsers,
        totalQueries,
        avgSatisfaction,
        topStrains,
        userPatterns,
        trends,
        activeUsers
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getTotalQueries(),
        this.getAverageSatisfaction(),
        AnalyticsEngine.getStrainPopularity('30d'),
        AnalyticsEngine.getUserPatterns(),
        AnalyticsEngine.detectTrends(),
        this.getActiveUsers()
      ]);
      
      return {
        overview: {
          totalUsers,
          activeUsers,
          totalQueries,
          avgSatisfaction: avgSatisfaction.toFixed(2),
          queryGrowth: await this.getQueryGrowth(),
          userGrowth: await this.getUserGrowth()
        },
        topStrains: topStrains.slice(0, 10),
        userPatterns,
        trends: trends.slice(0, 5),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }
  
  static async getTotalUsers() {
    const snapshot = await firestore()
      .collection('users')
      .get();
    return snapshot.size;
  }
  
  static async getActiveUsers() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await firestore()
      .collection('user_interactions')
      .where('timestamp', '>=', thirtyDaysAgo)
      .get();
    
    const uniqueUsers = new Set();
    snapshot.forEach(doc => {
      uniqueUsers.add(doc.data().userId);
    });
    
    return uniqueUsers.size;
  }
  
  static async getTotalQueries() {
    const snapshot = await firestore()
      .collection('user_interactions')
      .get();
    return snapshot.size;
  }
  
  static async getAverageSatisfaction() {
    const snapshot = await firestore()
      .collection('user_interactions')
      .where('userSatisfaction', '>', 0)
      .get();
    
    let total = 0;
    let count = 0;
    
    snapshot.forEach(doc => {
      total += doc.data().userSatisfaction;
      count++;
    });
    
    return count > 0 ? total / count : 0;
  }
  
  static async getQueryGrowth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    
    const [currentMonth, previousMonth] = await Promise.all([
      firestore()
        .collection('user_interactions')
        .where('timestamp', '>=', lastMonth)
        .get(),
      firestore()
        .collection('user_interactions')
        .where('timestamp', '>=', twoMonthsAgo)
        .where('timestamp', '<', lastMonth)
        .get()
    ]);
    
    const growth = previousMonth.size > 0 ? 
      ((currentMonth.size - previousMonth.size) / previousMonth.size * 100) : 100;
    
    return growth.toFixed(2);
  }
  
  static async getUserGrowth() {
    // Similar to getQueryGrowth but for users
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const recentUsers = await firestore()
      .collection('users')
      .where('createdAt', '>=', lastMonth)
      .get();
    
    return recentUsers.size;
  }
  
  static async generateInsightReport(dateRange = '90d') {
    try {
      const insights = await Promise.all([
        AnalyticsEngine.getStrainCorrelations(),
        AnalyticsEngine.getGeographicInsights(),
        AnalyticsEngine.getBreedingOpportunities(),
        AnalyticsEngine.getUserSegmentation()
      ]);
      
      return {
        strainCorrelations: insights[0],
        geographicData: insights[1],
        breedingOpportunities: insights[2],
        userSegments: insights[3],
        generatedAt: new Date(),
        dateRange
      };
    } catch (error) {
      console.error('Error generating insight report:', error);
      throw error;
    }
  }
  
  static async exportAnalytics(format = 'json', dateRange = '30d') {
    const data = await this.generateInsightReport(dateRange);
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }
  
  static convertToCSV(data) {
    // Simplified CSV conversion
    let csv = 'Metric,Value\\n';
    
    // Add overview metrics
    csv += `Total Users,${data.overview?.totalUsers || 0}\\n`;
    csv += `Active Users,${data.overview?.activeUsers || 0}\\n`;
    csv += `Total Queries,${data.overview?.totalQueries || 0}\\n`;
    csv += `Average Satisfaction,${data.overview?.avgSatisfaction || 0}\\n`;
    
    // Add top strains
    csv += '\\nTop Strains\\n';
    csv += 'Strain,Requests,Satisfaction\\n';
    data.topStrains?.forEach(strain => {
      csv += `${strain.strainName},${strain.totalRequests},${strain.avgSatisfaction}\\n`;
    });
    
    return csv;
  }
}

// ===========================
// BACKGROUND PROCESSING
// ===========================

export class AnalyticsProcessor {
  static processingInterval = null;
  
  static startBackgroundProcessing() {
    // Process analytics every hour
    this.processingInterval = setInterval(() => {
      this.processHourlyAnalytics();
    }, 3600000); // 1 hour
    
    // Run immediately
    this.processHourlyAnalytics();
  }
  
  static stopBackgroundProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
  
  static async processHourlyAnalytics() {
    try {
      await Promise.all([
        this.updateStrainTrendingScores(),
        this.cleanupOldCache(),
        this.aggregateHourlyStats()
      ]);
      
      console.log('Hourly analytics processing completed');
    } catch (error) {
      console.error('Error in hourly analytics processing:', error);
    }
  }
  
  static async updateStrainTrendingScores() {
    try {
      const trends = await AnalyticsEngine.detectTrends();
      const batch = firestore().batch();
      
      trends.slice(0, 50).forEach(trend => {
        const strainRef = firestore()
          .collection('strain_analytics')
          .doc(trend.strainName);
        
        batch.set(strainRef, {
          trendingScore: trend.momentum,
          weekOverWeekGrowth: parseFloat(trend.weekOverWeekGrowth),
          lastCalculated: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error updating trending scores:', error);
    }
  }
  
  static cleanupOldCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    AnalyticsEngine.cache.forEach((value, key) => {
      if (now - value.timestamp > AnalyticsEngine.CACHE_TTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      AnalyticsEngine.cache.delete(key);
    });
  }
  
  static async aggregateHourlyStats() {
    try {
      const hourAgo = new Date();
      hourAgo.setHours(hourAgo.getHours() - 1);
      
      const interactions = await firestore()
        .collection('user_interactions')
        .where('timestamp', '>=', hourAgo)
        .get();
      
      const stats = {
        hour: new Date().getHours(),
        date: new Date().toDateString(),
        interactions: interactions.size,
        uniqueUsers: new Set(),
        queryTypes: {},
        avgSatisfaction: 0,
        totalSatisfaction: 0
      };
      
      interactions.forEach(doc => {
        const data = doc.data();
        stats.uniqueUsers.add(data.userId);
        stats.queryTypes[data.queryType] = (stats.queryTypes[data.queryType] || 0) + 1;
        
        if (data.userSatisfaction) {
          stats.totalSatisfaction += data.userSatisfaction;
        }
      });
      
      stats.uniqueUsers = stats.uniqueUsers.size;
      stats.avgSatisfaction = interactions.size > 0 ? 
        stats.totalSatisfaction / interactions.size : 0;
      
      await firestore()
        .collection('hourly_stats')
        .add({
          ...stats,
          timestamp: firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error aggregating hourly stats:', error);
    }
  }
}

// Export analytics instance for global use
export const analyticsCollector = new AnalyticsCollector();
export const analyticsEngine = new AnalyticsEngine();
export const analyticsDashboard = new AnalyticsDashboard();
export const analyticsProcessor = new AnalyticsProcessor();