import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator
} from 'react-native';
import { theme } from '../../App';

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
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logo}>
          <View style={[styles.logoImage, {backgroundColor: '#2ECC40', justifyContent: 'center', alignItems: 'center'}]}>
            <Text style={{fontSize: 60}}>🌿</Text>
          </View>
          <Text style={styles.titleText}>GREED & GROSS</Text>
          <Text style={styles.subtitleText}>Cannabis Breeding AI</Text>
        </View>
      </Animated.View>

      {/* Loading Bar */}
      <View style={styles.loadingContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBar,
              { width: `${progress}%` },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>
          {progress < 30 ? 'Initializing AI...' : 
           progress < 60 ? 'Loading strain database...' :
           progress < 90 ? 'Preparing breeding simulator...' :
           'Almost ready...'}
        </Text>
      </View>

      {/* Effects */}
      <View style={styles.effects}>
        {[...Array(5)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.smokeEffect,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60
  },
  logo: {
    alignItems: 'center'
  },
  logoImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
    borderRadius: 75
  },
  titleText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 2
  },
  subtitleText: {
    fontSize: 16,
    color: '#AAAAAA',
    letterSpacing: 1
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    width: '80%',
    alignItems: 'center'
  },
  progressBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 16
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2
  },
  loadingText: {
    color: '#AAAAAA',
    fontSize: 14
  },
  effects: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0
  },
  smokeEffect: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    opacity: 0.1
  }
});

export default SplashScreen;