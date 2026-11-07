import { StyleSheet, Text, View } from 'react-native';

const SECTIONS = [
  {
    title: '1. Data Collection',
    body: 'We respect your privacy. When you log in using Google Sign-In, we only collect your basic public profile information (Name, Email address, and Profile Picture) to create and maintain your secure personal account.',
  },
  {
    title: '2. Data Usage',
    body: 'Your information is strictly used to customize your in-app profile dashboard and sync your preferences between the web and mobile versions. We never sell, rent, or share your personal data with third-party advertising companies.',
  },
  {
    title: '3. Subscriptions & Payments',
    body: "All app subscriptions and payments are securely handled directly through Apple's App Store billing system. We do not store or process your credit card or financial details on our servers.",
  },
  {
    title: '4. Contact Us',
    body: 'If you have any questions or wish to delete your account data, please contact our support email directly.',
  },
];

export function PrivacyPolicyCopy() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Privacy Policy for Hookup Mobile</Text>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  title: { color: '#f4efe8', fontSize: 18, fontWeight: '700' },
  section: { gap: 4 },
  heading: { color: '#d8b4fe', fontSize: 15, fontWeight: '700' },
  body: { color: '#e9d5ff', fontSize: 14, lineHeight: 21 },
});
