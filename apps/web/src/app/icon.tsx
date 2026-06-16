import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '30%',
          color: 'white',
          fontWeight: 700,
          fontSize: 20,
          fontFamily: 'sans-serif',
          letterSpacing: '-0.5px',
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
