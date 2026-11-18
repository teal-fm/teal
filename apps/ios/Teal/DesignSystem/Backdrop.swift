import SwiftUI

struct AmbientBlob: Hashable {
    var url: URL
    /// 0...1, how close the cover's source is to the middle of the screen.
    var weight: Double
}

/// Collects the covers on one page and turns their positions into backdrop blobs.
/// Positions arrive on every scroll frame, so they're kept out of observation and
/// measured at most every 80 ms.
@Observable
final class AmbientModel {
    private(set) var blobs: [AmbientBlob] = []

    @ObservationIgnored private var sources: [UUID: (url: URL, frame: CGRect)] = [:]
    @ObservationIgnored private var pending = false
    @ObservationIgnored var viewport: CGFloat = 800

    /// How many covers blend at once; more turns the backdrop to mud.
    private static let maxBlobs = 6
    /// The nearest cover counts as at least this close, so a lone far one stays faint.
    private static let minLead = 0.6

    func update(_ id: UUID, url: URL?, frame: CGRect) {
        if let url { sources[id] = (url, frame) } else { sources[id] = nil }
        schedule()
    }

    func remove(_ id: UUID) {
        sources[id] = nil
        schedule()
    }

    private func schedule() {
        guard !pending else { return }
        pending = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            pending = false
            measure()
        }
    }

    private func measure() {
        let all = Array(sources.values)
        // A page with one cover in it, like an album or a listen, keeps that cover
        // at full strength however far it scrolls.
        let urls = Set(all.map(\.url))
        if urls.count == 1, let url = urls.first {
            let next = [AmbientBlob(url: url, weight: 1)]
            if blobs != next { blobs = next }
            return
        }
        var best: [URL: Double] = [:]
        for source in all where source.frame.height > 0 {
            let mid = viewport * 0.45
            let weight = max(0, 1 - abs(source.frame.midY - mid) / (viewport * 1.1))
            if weight > (best[source.url] ?? 0) { best[source.url] = weight }
        }
        let top = best.map { AmbientBlob(url: $0.key, weight: $0.value) }
            .sorted { $0.weight > $1.weight }
            .prefix(Self.maxBlobs)
        // Scale to the nearest cover, so a fast scroll between covers shifts the colour instead of draining it.
        let scale = 1 / max(top.first?.weight ?? 1, Self.minLead)
        let next = top.map { AmbientBlob(url: $0.url, weight: min(1, $0.weight * scale)) }
        if blobs != next { blobs = next }
    }
}

private struct AmbientKey: EnvironmentKey {
    static let defaultValue: AmbientModel? = nil
}

extension EnvironmentValues {
    var ambient: AmbientModel? {
        get { self[AmbientKey.self] }
        set { self[AmbientKey.self] = newValue }
    }
}

private struct AmbientSource: ViewModifier {
    var url: URL?
    @Environment(\.ambient) private var ambient
    @State private var id = UUID()

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
                ambient?.update(id, url: url, frame: frame)
            }
            .onChange(of: url) { ambient?.remove(id) }
            .onDisappear { ambient?.remove(id) }
    }
}

extension View {
    /// Marks a cover whose colour feeds the page's backdrop while it is near the middle of the screen.
    func ambientSource(_ url: URL?) -> some View {
        modifier(AmbientSource(url: url))
    }

    /// The release cover for `releaseMbId` feeds the page's backdrop.
    func ambientSource(release releaseMbId: String?) -> some View {
        modifier(AmbientSource(url: Artwork.releaseCover(releaseMbId, size: 250)))
    }

    /// Hosts the blurred-cover backdrop for one page.
    func ambientScreen() -> some View {
        modifier(AmbientScreen())
    }
}

private struct AmbientScreen: ViewModifier {
    @State private var model = AmbientModel()

    func body(content: Content) -> some View {
        content
            .environment(\.ambient, model)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { model.viewport = $0 }
            .background { Backdrop(blobs: model.blobs).ignoresSafeArea() }
            .scrollContentBackground(.hidden)
    }
}

/// A blend of the blurred covers on screen, drifting slowly behind everything.
/// A veil per theme keeps text readable on any cover.
struct Backdrop: View {
    var blobs: [AmbientBlob]

    @AppStorage(Preferences.backdrop) private var enabled = true
    @AppStorage(Preferences.motion) private var moving = true
    @AppStorage(Preferences.colour) private var vivid = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Shown: Identifiable, Equatable {
        var url: URL
        var weight: Double
        var slot: Int
        var since: Date
        var id: URL { url }
    }

    @State private var shown: [Shown] = []

    /// Home spots, as fractions of the screen. The colour doesn't follow the page as it
    /// scrolls, which reads as swimming; each spot drifts slowly on its own instead.
    private static let slots: [CGPoint] = [
        CGPoint(x: 0.15, y: 0.25), CGPoint(x: 0.85, y: 0.35), CGPoint(x: 0.5, y: 0.75), CGPoint(x: 0.1, y: 0.8),
        CGPoint(x: 0.9, y: 0.8), CGPoint(x: 0.5, y: 0.15), CGPoint(x: 0.3, y: 0.5), CGPoint(x: 0.7, y: 0.55),
    ]
    /// A cover stays at least this long once it arrives, so a flick can't churn the set.
    private static let hold: TimeInterval = 1.2

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.ground
                if enabled {
                    let active = shown.filter { $0.weight > 0 }
                    // With few covers, mirrored copies fill the rest of the screen.
                    let echoes = max(0, 4 - active.count)
                    ForEach(shown) { item in
                        BackdropBlob(
                            url: item.url,
                            weight: item.weight,
                            home: Self.slots[item.slot],
                            echoes: echoes,
                            size: max(geometry.size.width, geometry.size.height) * 1.05,
                            bounds: geometry.size,
                            moving: moving && !reduceMotion,
                            saturation: vivid ? 2 : 0.7,
                            seed: item.slot
                        )
                    }
                    Color.veil
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: blobs, initial: true) { reconcile() }
    }

    private func reconcile() {
        let now = Date.now
        let incoming = Dictionary(blobs.map { ($0.url, $0.weight) }, uniquingKeysWith: max)
        var wake: Date?
        var next = shown.map { item -> Shown in
            var item = item
            if let weight = incoming[item.url] {
                if item.weight == 0 { item.since = now }
                item.weight = weight
            } else if item.weight > 0, now.timeIntervalSince(item.since) < Self.hold {
                wake = min(wake ?? .distantFuture, item.since.addingTimeInterval(Self.hold))
            } else {
                item.weight = 0
            }
            return item
        }
        for blob in blobs where !shown.contains(where: { $0.url == blob.url }) {
            let crowd = Self.slots.indices.map { slot in next.filter { $0.slot == slot }.count }
            let slot = crowd.firstIndex(of: crowd.min() ?? 0) ?? 0
            next.append(Shown(url: blob.url, weight: blob.weight, slot: slot, since: now))
        }
        shown = next
        if let wake {
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(max(0.05, wake.timeIntervalSinceNow)))
                reconcile()
            }
        }
        // Covers that have faded out leave once their fade finishes.
        let gone = next.filter { $0.weight == 0 }.map(\.url)
        if !gone.isEmpty {
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(BackdropBlob.fadeOut + 0.3))
                shown.removeAll { gone.contains($0.url) && $0.weight == 0 }
            }
        }
    }
}

private struct BackdropBlob: View {
    var url: URL
    var weight: Double
    var home: CGPoint
    var echoes: Int
    var size: CGFloat
    var bounds: CGSize
    var moving: Bool
    var saturation: Double
    var seed: Int

    static let fadeIn: TimeInterval = 2.4
    static let fadeOut: TimeInterval = 3.6

    @State private var image: UIImage?
    @State private var shownOpacity = 0.0

    private var target: Double { image == nil ? 0 : pow(weight, 0.7) }

    private var spots: [CGPoint] {
        [home, CGPoint(x: 1 - home.x, y: 1 - home.y), CGPoint(x: 1 - home.x, y: home.y), CGPoint(x: home.x, y: 1 - home.y)]
    }

    var body: some View {
        ZStack {
            if let image {
                ForEach(Array(spots.enumerated()), id: \.offset) { copy, spot in
                    DriftingCover(image: image, size: size, saturation: saturation, moving: moving, seed: seed * 4 + copy)
                        .position(x: spot.x * bounds.width, y: spot.y * bounds.height)
                        .opacity(copy <= echoes ? 1 : 0)
                        .animation(.easeInOut(duration: Self.fadeIn), value: echoes)
                }
            }
        }
        .opacity(shownOpacity)
        .onChange(of: target, initial: true) { _, next in
            withAnimation(.easeInOut(duration: next >= shownOpacity ? Self.fadeIn : Self.fadeOut)) { shownOpacity = next }
        }
        .task(id: url) {
            image = ImageStore.shared.cached(url)
            if image == nil { image = await ImageStore.shared.image(url) }
        }
    }
}

/// One blurred copy of a cover that wanders and turns slowly, each at its own pace.
private struct DriftingCover: View {
    var image: UIImage
    var size: CGFloat
    var saturation: Double
    var moving: Bool
    var seed: Int

    @State private var phase = false

    private static let wander: [Double] = [31, 43, 37, 53, 29, 47, 41, 59]
    private static let spin: [Double] = [67, 89, 73, 97, 61, 83, 79, 103]

    var body: some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(Circle())
            .saturation(saturation)
            .blur(radius: 56, opaque: false)
            .rotationEffect(.degrees(phase ? (seed.isMultiple(of: 2) ? 360 : -360) : 0))
            .animation(moving ? .linear(duration: Self.spin[seed % 8]).repeatForever(autoreverses: false) : .default, value: phase)
            .offset(x: phase ? size * 0.09 : -size * 0.07, y: phase ? -size * 0.07 : size * 0.08)
            .scaleEffect(phase ? 1.1 : 0.94)
            .animation(moving ? .easeInOut(duration: Self.wander[seed % 8] / 2).repeatForever(autoreverses: true) : .default, value: phase)
            .onAppear { if moving { phase = true } }
            .onChange(of: moving) { _, now in
                var transaction = Transaction()
                transaction.disablesAnimations = !now
                withTransaction(transaction) { phase = now }
            }
    }
}
