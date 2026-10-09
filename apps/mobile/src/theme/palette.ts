export const lightPalette = {
  background: "#F8FAF8",
  surface: "#FFFFFF",
  surfaceRaised: "#F0F4F1",
  border: "#DDE5DF",
  borderInput: "#819187",
  textPrimary: "#1B2520",
  textSecondary: "#4B5A51",
  textTertiary: "#5F6D63",
  textOnPrimary: "#FFFFFF",
  textInverse: "#FFFFFF",
  primary: "#145C45",
  primaryPressed: "#104A37",
  primarySubtle: "#E7F3ED",
  success: "#176B42",
  successSubtle: "#E8F5EC",
  warning: "#835500",
  warningSubtle: "#FFF4D6",
  danger: "#B42318",
  dangerSubtle: "#FDECEA",
  overlay: "#101A14B8",
  skeleton: "#E7ECE8",
  icon: "#25352D",
  iconMuted: "#66756B",
} as const;

export const darkPalette = {
  background: "#111815",
  surface: "#19221D",
  surfaceRaised: "#222D26",
  border: "#35433B",
  borderInput: "#73877B",
  textPrimary: "#F3F7F4",
  textSecondary: "#C1CEC5",
  textTertiary: "#A2B1A7",
  textOnPrimary: "#0C2118",
  textInverse: "#111815",
  primary: "#54C59A",
  primaryPressed: "#68D1A6",
  primarySubtle: "#18392B",
  success: "#72D6A1",
  successSubtle: "#173824",
  warning: "#FFD174",
  warningSubtle: "#3B2D15",
  danger: "#FF8B82",
  dangerSubtle: "#422321",
  overlay: "#000000A6",
  skeleton: "#2A352E",
  icon: "#DAE5DD",
  iconMuted: "#9BAAA0",
} as const;

export type ThemeColors = {
  [Key in keyof typeof lightPalette]: string;
};

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const radii = {
  small: 8,
  medium: 12,
  large: 16,
} as const;

export const elevation = {
  low: 1,
  medium: 3,
  high: 6,
} as const;

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0,
  },
  headline: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0,
  },
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
