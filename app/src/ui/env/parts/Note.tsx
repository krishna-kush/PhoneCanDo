import PlainText from '../../common/PlainText';

// One line of explanation (muted) or of trouble (red), at the size the other
// screens use for helper text.
export default function Note({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return (
    <PlainText fontSize={14} color={tone === 'error' ? 'primary' : 'muted'}>
      {children}
    </PlainText>
  );
}
