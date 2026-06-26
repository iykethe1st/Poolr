import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { API_BASE_URL } from '@/api/client';

export default function KycWebViewScreen() {
  const { user_id } = useLocalSearchParams<{ user_id: string }>();
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<WebView>(null);

  const widgetUrl = `${API_BASE_URL}/users/kyc/widget?user_id=${encodeURIComponent(user_id ?? '')}`;

  function handleNavigation(state: WebViewNavigation): boolean {
    if (state.url.startsWith('poolr://kyc-callback')) {
      // Parse the callback URL and navigate to the callback handler
      const url = new URL(state.url);
      const status = url.searchParams.get('status') ?? 'closed';
      const referenceId = url.searchParams.get('reference_id') ?? '';
      router.replace({ pathname: '/kyc-callback', params: { status, reference_id: referenceId } });
      return false; // prevent WebView from navigating to poolr://
    }
    return true;
  }

  return (
    <View style={styles.root}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#155e3e" />
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: widgetUrl }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={handleNavigation}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        onError={() => {
          router.replace({ pathname: '/kyc-callback', params: { status: 'error', reference_id: '' } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f9f4' },
  webview: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9f4',
    zIndex: 10,
  },
});
