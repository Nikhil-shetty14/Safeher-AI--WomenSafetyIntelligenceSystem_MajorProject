// Design system for SafeHer AI
export const Colors = {
  // Primary Purple Gradient
  primary: '#8B5CF6',
  primaryDark: '#6D28D9',
  primaryLight: '#A78BFA',

  // Accent Pink
  accent: '#EC4899',
  accentDark: '#BE185D',
  accentLight: '#F9A8D4',

  // Danger Red
  danger: '#EF4444',
  dangerDark: '#B91C1C',
  dangerLight: '#FCA5A5',

  // Warning
  warning: '#F59E0B',
  warningLight: '#FDE68A',

  // Success Green
  success: '#10B981',
  successLight: '#6EE7B7',

  // Background (dark mode)
  background: '#0F0A1E',
  backgroundSecondary: '#1A1033',
  card: '#1E1535',
  cardBorder: '#2D2050',

  // Text
  textPrimary: '#F8F4FF',
  textSecondary: '#B8A9D9',
  textMuted: '#6B5A8A',

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#8B5CF6', '#EC4899'],
  gradientDanger: ['#EF4444', '#B91C1C'],
  gradientCard: ['#1E1535', '#2D2050'],
  gradientBg: ['#0F0A1E', '#1A1033'],

  // SOS Severity
  severitySafe: '#10B981',
  severityLow: '#F59E0B',
  severityMedium: '#F97316',
  severityHigh: '#EF4444',
  severityCritical: '#DC2626',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Typography = {
  fontSizeXS: 10,
  fontSizeSM: 12,
  fontSizeMD: 14,
  fontSizeLG: 16,
  fontSizeXL: 18,
  fontSize2XL: 22,
  fontSize3XL: 28,
  fontSize4XL: 36,

  fontWeightLight: '300' as const,
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemibold: '600' as const,
  fontWeightBold: '700' as const,
  fontWeightExtrabold: '800' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  card: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  danger: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const getSeverityColor = (level: string): string => {
  const map: Record<string, string> = {
    safe: Colors.severitySafe,
    low: Colors.severityLow,
    medium: Colors.severityMedium,
    high: Colors.severityHigh,
    critical: Colors.severityCritical,
  };
  return map[level] ?? Colors.severityMedium;
};
