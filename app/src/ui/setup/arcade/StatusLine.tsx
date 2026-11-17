import PlainText from '../../common/PlainText';

// The line under a scene: what the setup is doing now, in words.
export default function StatusLine({ label }: { label: string }) {
  return (
    <PlainText fontFamily="mono" fontSize={12} color="muted" textAlign="center" numberOfLines={2}>
      {label}
    </PlainText>
  );
}
