import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Renders the Poolr 5-circle logo mark at 180×180 (Apple touch icon)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: 180,
          height: 180,
          borderRadius: '40px',
          background: '#085041',
          display: 'flex',
        }}
      >
        {/* Outer ring — center (90,90), radius 56 */}
        <div
          style={{
            position: 'absolute',
            top: 34,
            left: 34,
            width: 112,
            height: 112,
            borderRadius: '50%',
            border: '2px solid rgba(159,225,203,0.7)',
          }}
        />
        {/* top      cx=90  cy=65  → top=48  left=73 */}
        <div style={{ position: 'absolute', top: 48, left: 73, width: 34, height: 34, borderRadius: '50%', background: '#FAC775' }} />
        {/* top-right cx=116 cy=86  → top=69  left=99 */}
        <div style={{ position: 'absolute', top: 69, left: 99, width: 34, height: 34, borderRadius: '50%', background: '#EF9F27' }} />
        {/* bottom-right cx=106 cy=115 → top=98  left=89 */}
        <div style={{ position: 'absolute', top: 98, left: 89, width: 34, height: 34, borderRadius: '50%', background: '#FAC775' }} />
        {/* bottom-left cx=74  cy=115 → top=98  left=57 */}
        <div style={{ position: 'absolute', top: 98, left: 57, width: 34, height: 34, borderRadius: '50%', background: '#EF9F27' }} />
        {/* top-left  cx=64  cy=86  → top=69  left=47 */}
        <div style={{ position: 'absolute', top: 69, left: 47, width: 34, height: 34, borderRadius: '50%', background: '#FAC775' }} />
      </div>
    ),
    { ...size },
  );
}
