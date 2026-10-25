import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { Detection } from '../logic/tracker';
import { VISION_HTML } from '../vision/visionHtml';

export type VisionStatus = {
  state: 'off' | 'loading' | 'ready' | 'error';
  message?: string;
  fps?: number;
  /** Objects seen in the last frame. */
  count?: number;
};

type Props = {
  onDetections: (items: Detection[]) => void;
  onStatus: (status: VisionStatus) => void;
};

/**
 * Rear camera + object detection running in a WebView (TensorFlow.js).
 * Unmount it to switch the camera off.
 */
export function VisionCamera({ onDetections, onStatus }: Props) {
  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; status?: VisionStatus['state']; message?: string; items?: Detection[]; fps?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'status' && msg.status) onStatus({ state: msg.status, message: msg.message });
    if (msg.type === 'detections' && msg.items) {
      onDetections(msg.items);
      onStatus({ state: 'ready', fps: msg.fps, count: msg.items.length });
    }
  };

  return (
    <View style={styles.frame}>
      <WebView
        style={styles.web}
        // An https base URL makes the page a secure context, which getUserMedia requires.
        source={{ html: VISION_HTML, baseUrl: 'https://volta.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        scrollEnabled={false}
        bounces={false}
        onError={(e) => onStatus({ state: 'error', message: e.nativeEvent.description })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
});
