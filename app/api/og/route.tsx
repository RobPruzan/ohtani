import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 25px 25px, #1a1a1a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1a1a1a 2%, transparent 0%)',
          backgroundSize: '100px 100px',
        }}
      >
        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 300,
              background: 'linear-gradient(to right, #7c3aed, #3b82f6)',
              backgroundClip: 'text',
              color: 'transparent',
              margin: 0,
              padding: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Harada Method
          </h1>
          <p
            style={{
              fontSize: '28px',
              color: '#9ca3af',
              margin: '12px 0 0 0',
              fontWeight: 300,
            }}
          >
            64-cell goal planning system powered by AI
          </p>
        </div>

        {/* Simplified 3x3 grid visualization */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {[0, 1, 2].map((col) => {
                const isCenter = row === 1 && col === 1;
                return (
                  <div
                    key={col}
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '8px',
                      background: isCenter
                        ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                        : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <span
                      style={{
                        color: 'white',
                        fontSize: isCenter ? '16px' : '14px',
                        fontWeight: 300,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {isCenter ? 'Goal' : 'Pillar'}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
