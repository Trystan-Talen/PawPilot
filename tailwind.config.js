/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 深夜办公室色板
        floor: {
          900: '#07080c', // 最深的地板
          800: '#0b0d14',
          700: '#11141f', // 工位卡片底
          600: '#181c2a',
          500: '#222739'  // 高光描边
        },
        ink: {
          900: '#f5f7fb', // 主文字
          700: '#aeb4c4',
          500: '#6b7388',
          300: '#3a4055'
        },
        // 显示器冷光
        screen: {
          glow: '#3aa8ff',
          bg: '#0d1c2e'
        },
        // 台灯暖光
        lamp: {
          glow: '#ffb86b',
          warm: '#ff8a3d'
        },
        // 状态颜色
        status: {
          working: '#3aa8ff',
          thinking: '#a78bfa',
          idle: '#6b7388',
          done: '#34d399',
          error: '#ef4444',
          waiting: '#fbbf24'
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', 'PingFang SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace']
      },
      animation: {
        'lamp-flicker': 'lamp-flicker 8s ease-in-out infinite',
        'screen-pulse': 'screen-pulse 4s ease-in-out infinite',
        'breathe': 'breathe 3.6s ease-in-out infinite',
        'dust': 'dust 24s linear infinite',
        'walk-in': 'walk-in 1.2s cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'walk-out': 'walk-out 1.4s cubic-bezier(0.6, 0, 0.7, 0.3) both',
        'paws-type': 'paws-type 0.28s steps(2) infinite',
        'head-tilt': 'head-tilt 2.8s ease-in-out infinite',
        'snore': 'snore 3.6s ease-in-out infinite',
        'cheer': 'cheer 0.8s ease-in-out infinite',
        'shake': 'shake 0.35s ease-in-out infinite',
        'zz-float': 'zz-float 3s ease-out infinite'
      },
      keyframes: {
        'lamp-flicker': {
          '0%, 92%, 100%': { opacity: '1' },
          '93%': { opacity: '0.5' },
          '94%': { opacity: '0.95' },
          '95%': { opacity: '0.4' },
          '96%': { opacity: '1' }
        },
        'screen-pulse': {
          '0%, 100%': { opacity: '0.9' },
          '50%': { opacity: '1' }
        },
        breathe: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-1.2px)' }
        },
        dust: {
          '0%': { transform: 'translate3d(0,0,0)', opacity: '0' },
          '10%': { opacity: '0.6' },
          '90%': { opacity: '0.4' },
          '100%': { transform: 'translate3d(40px,-180px,0)', opacity: '0' }
        },
        'walk-in': {
          '0%': { transform: 'translateX(-180%) scale(0.85)', opacity: '0' },
          '60%': { opacity: '1' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' }
        },
        'walk-out': {
          '0%': { transform: 'translateX(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateX(220%) scale(0.8)', opacity: '0' }
        },
        'paws-type': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2.4px)' }
        },
        'head-tilt': {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' }
        },
        snore: {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '50%': { transform: 'scale(1.04, 0.97)' }
        },
        cheer: {
          '0%, 100%': { transform: 'translateY(0) rotate(0)' },
          '50%': { transform: 'translateY(-6px) rotate(-3deg)' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' }
        },
        'zz-float': {
          '0%': { transform: 'translate(0,0) scale(0.8)', opacity: '0' },
          '20%': { opacity: '0.9' },
          '100%': { transform: 'translate(8px,-22px) scale(1.2)', opacity: '0' }
        }
      },
      boxShadow: {
        'card': '0 2px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 2px 0 0 rgba(255,255,255,0.05) inset, 0 12px 32px -8px rgba(58,168,255,0.18), 0 0 0 1px rgba(58,168,255,0.3)',
        'lamp': '0 0 32px 8px rgba(255,184,107,0.5), 0 0 64px 24px rgba(255,138,61,0.18)',
        'screen': '0 0 24px 4px rgba(58,168,255,0.35)'
      }
    }
  },
  plugins: []
}
