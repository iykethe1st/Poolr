import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Renders the Poolr 5-circle logo mark at 32×32
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: 32,
          height: 32,
          borderRadius: '30%',
          background: '#085041',
          display: 'flex',
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1px solid rgba(159,225,203,0.6)',
          }}
        />
        {/* top */}
        <div style={{ position: 'absolute', top: 9, left: 13, width: 6, height: 6, borderRadius: '50%', background: '#FAC775' }} />
        {/* top-right */}
        <div style={{ position: 'absolute', top: 12, left: 18, width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />
        {/* bottom-right */}
        <div style={{ position: 'absolute', top: 17, left: 16, width: 6, height: 6, borderRadius: '50%', background: '#FAC775' }} />
        {/* bottom-left */}
        <div style={{ position: 'absolute', top: 17, left: 10, width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />
        {/* top-left */}
        <div style={{ position: 'absolute', top: 12, left: 8, width: 6, height: 6, borderRadius: '50%', background: '#FAC775' }} />
      </div>
    ),
    { ...size },
  );
}
