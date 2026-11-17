import SwiftUI
import UIKit

/// The same palette as the web and Android apps: plain grounds, one teal tint,
/// glass panels over album-art backdrops.
extension Color {
    private static func dynamic(_ light: UInt32, _ dark: UInt32, lightAlpha: CGFloat = 1, darkAlpha: CGFloat = 1) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark, alpha: darkAlpha) : UIColor(hex: light, alpha: lightAlpha)
        })
    }

    static let ground = dynamic(0xFFFFFF, 0x000000)
    static let ground2 = dynamic(0xF2F2F7, 0x1C1C1E)
    static let ink = dynamic(0x000000, 0xFFFFFF)
    static let ink2 = dynamic(0x000000, 0xEBEBF5, lightAlpha: 0.66, darkAlpha: 0.8)
    static let ink3 = dynamic(0x3C3C43, 0xEBEBF5, lightAlpha: 0.4, darkAlpha: 0.36)
    static let hair = dynamic(0x3C3C43, 0x545458, lightAlpha: 0.18, darkAlpha: 0.6)
    static let tint = dynamic(0x0B7A73, 0x3FC9BD)
    static let onTint = dynamic(0xFFFFFF, 0x002B28)
    static let tintSoft = dynamic(0x0B7A73, 0x3FC9BD, lightAlpha: 0.12, darkAlpha: 0.16)
    static let fill = dynamic(0x787880, 0x787880, lightAlpha: 0.12, darkAlpha: 0.24)
    /// Presence ("listening now"): deeper in light mode so the ring clears 3:1 on white.
    static let now = dynamic(0x0F8F84, 0x3FC9BD)
    static let destructive = dynamic(0xB3200E, 0xF2877A)
    /// Text on the backdrop gets a halo in the ground colour; the backdrop gets a veil.
    static let halo = dynamic(0xFFFFFF, 0x000000, lightAlpha: 0.8, darkAlpha: 0.6)
    static let veil = dynamic(0xFAFAFC, 0x000000, lightAlpha: 0.46, darkAlpha: 0.42)
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension View {
    /// Lifts text that sits straight on the backdrop off any cover colour.
    func halo() -> some View {
        shadow(color: .halo, radius: 1.5).shadow(color: .halo, radius: 6)
    }
}

/// Saved appearance choices, shared by Settings and the root view.
enum Preferences {
    static let theme = "teal-color-scheme"
    static let backdrop = "teal-backdrop"
    static let motion = "teal-motion"
    static let colour = "teal-colour"
}

enum ThemePreference: String, CaseIterable {
    case light, dark, system

    var scheme: ColorScheme? {
        switch self {
        case .light: .light
        case .dark: .dark
        case .system: nil
        }
    }

    var label: String { rawValue.capitalized }
}
