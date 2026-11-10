import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  Dimensions,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type HostView = React.ComponentRef<typeof View>;
type HostScroll = React.ComponentRef<typeof ScrollView>;

const MASK = 'rgba(4, 4, 6, 0.88)';
const CYAN = '#00E6FF';

type Hole = { x: number; y: number; w: number; h: number };

export function FeatureCoach({
  visible,
  stepIndex,
  stepCount,
  title,
  body,
  cta,
  targetRef,
  scrollRef,
  onNext,
}: {
  visible: boolean;
  stepIndex: number;
  stepCount: number;
  title: string;
  body: string;
  cta: string;
  targetRef: RefObject<HostView | null>;
  scrollRef?: RefObject<HostScroll | null>;
  onNext: () => void;
}) {
  const [hole, setHole] = useState<Hole | null>(null);
  const [screen, setScreen] = useState(() => Dimensions.get('window'));

  const measure = useCallback(() => {
    const node = targetRef.current;
    if (!node) {
      setHole(null);
      return;
    }
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const pad = 6;
      setHole({ x: x - pad, y: y - pad, w: width + pad * 2, h: height + pad * 2 });
    });
  }, [targetRef]);

  useEffect(() => {
    if (!visible) return;
    const node = targetRef.current;
    const scroll = scrollRef?.current;
    if (node && scroll) {
      const inner = (scroll as unknown as { getInnerViewNode?: () => number | null }).getInnerViewNode?.() ?? findNodeHandle(scroll);
      if (inner) {
        node.measureLayout(
          inner,
          (_x: number, y: number) => {
            scroll.scrollTo({ y: Math.max(0, y - 88), animated: true });
          },
          () => undefined,
        );
      }
    }
    const timers = [40, 240, 520].map((ms) => setTimeout(measure, ms));
    const sub = Dimensions.addEventListener('change', ({ window }: { window: { width: number; height: number; scale: number; fontScale: number } }) => {
      setScreen(window);
      setTimeout(measure, 40);
    });
    return () => {
      timers.forEach(clearTimeout);
      sub.remove();
    };
  }, [visible, stepIndex, measure, targetRef, scrollRef]);

  if (!visible) return null;

  const width = screen.width;
  const height = screen.height;
  const zones = hole
    ? [
        { top: 0, left: 0, width, height: Math.max(0, hole.y) },
        { top: hole.y + hole.h, left: 0, width, height: Math.max(0, height - hole.y - hole.h) },
        { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h },
        { top: hole.y, left: hole.x + hole.w, width: Math.max(0, width - hole.x - hole.w), height: hole.h },
      ]
    : [{ top: 0, left: 0, width, height }];

  const below = hole ? hole.y + hole.h + 12 : height * 0.62;
  const cardTop = hole && below + 210 > height - 12 ? Math.max(12, hole.y - 214) : below;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onNext}>
      <View style={styles.root}>
        {zones.map((zone, index) => (
          <View key={index} style={[styles.zone, zone]} />
        ))}
        {hole ? <View pointerEvents="none" style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]} /> : null}
        {hole ? <View style={[styles.freeze, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]} /> : null}
        <View style={[styles.card, { top: cardTop }]}>
          <View style={styles.stripe} />
          <View style={styles.cardBody}>
            <View style={styles.progressRow}>
              <Text style={styles.progress}>{stepIndex + 1} / {stepCount}</Text>
              <View style={styles.dots}>
                {Array.from({ length: stepCount }, (_, index) => (
                  <View key={index} style={[styles.dot, index === stepIndex ? styles.dotOn : styles.dotOff]} />
                ))}
              </View>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable style={styles.next} onPress={onNext}>
              <Text style={styles.nextText}>{cta}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  zone: { position: 'absolute', backgroundColor: MASK },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: CYAN,
    borderRadius: 12,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 14,
  },
  freeze: { position: 'absolute', backgroundColor: 'transparent' },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#14141c',
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 6,
    elevation: 18,
  },
  stripe: { width: 4, backgroundColor: CYAN },
  cardBody: { flex: 1, padding: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progress: { color: CYAN, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginRight: 10 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: { height: 4, borderRadius: 2, marginRight: 6 },
  dotOn: { width: 24, backgroundColor: CYAN },
  dotOff: { width: 6, backgroundColor: 'rgba(255,255,255,0.22)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.4, marginBottom: 8 },
  body: { color: '#b7b7c4', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  next: { backgroundColor: CYAN, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  nextText: { color: '#041016', fontWeight: '900', fontSize: 14, letterSpacing: 0.4 },
});
