import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F6E56',
          borderRadius: '40px',
          color: 'white',
          fontWeight: 700,
          fontSize: 108,
          fontFamily: 'sans-serif',
          letterSpacing: '-3px',
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
