import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');
export const ONBOARDING_KEY = 'poolr_onboarding_seen';

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
}

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === '1';
}

interface Slide {
  id: string;
  icon: string;
  title: string;
  body: string;
  accent: string;
}

const slides: Slide[] = [
  {
    id: '1',
    icon: '🤝',
    title: 'Save Together,\nWin Together',
    body: 'Create or join a savings circle with friends, family, or colleagues — the modern way to pool money with people you trust.',
    accent: '#1a6b47',
  },
  {
    id: '2',
    icon: '💸',
    title: 'Your Turn\nTo Get Paid',
    body: 'Everyone contributes, everyone receives. Each member gets the full pot in rotation — fair, transparent, and fully automated.',
    accent: '#145235',
  },
  {
    id: '3',
    icon: '📲',
    title: 'Always In\nControl',
    body: 'Track contributions in real time, get instant notifications, and never miss a payment with smart reminders.',
    accent: '#0f3d27',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    if (index < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    await markOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const renderItem = ({ item }: ListRenderItemInfo<Slide>) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconWrap, { backgroundColor: item.accent }]}>
        <View style={styles.iconRing} />
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Logo row */}
      <View style={styles.header}>
        <Text style={styles.logo}>Poolr</Text>
        {index < slides.length - 1 && (
          <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={renderItem}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {/* Animated dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const w = scrollX.interpolate({
              inputRange,
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width: w, opacity }]} />;
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.btnText}>
            {index === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink}>Terms</Text> &{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060f0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#22c55e',
    letterSpacing: -0.5,
  },
  skip: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 32,
    gap: 0,
  },
  iconWrap: {
    width: 172,
    height: 172,
    borderRadius: 86,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  icon: {
    fontSize: 80,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -1,
    marginBottom: 18,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 310,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 44,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  btn: {
    width: '100%',
    backgroundColor: '#155e3e',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  legal: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  legalLink: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
