import SwiftUI
import UIKit

/// Loads and caches remote images. Decoded images stay in memory; the bytes stay
/// in the shared URL cache, so a cover shown in a list is instant on its page.
final class ImageStore {
    static let shared = ImageStore()

    private let memory = NSCache<NSURL, UIImage>()
    private var inFlight: [URL: Task<UIImage?, Never>] = [:]

    init() {
        memory.countLimit = 400
    }

    func cached(_ url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    func image(_ url: URL) async -> UIImage? {
        if let hit = memory.object(forKey: url as NSURL) { return hit }
        if let task = inFlight[url] { return await task.value }
        let task = Task<UIImage?, Never> {
            var request = URLRequest(url: url)
            request.setValue(TealConfig.userAgent, forHTTPHeaderField: "User-Agent")
            guard let (data, response) = try? await Aqua.session.data(for: request),
                  let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status),
                  let image = UIImage(data: data) else { return nil }
            return await image.byPreparingForDisplay() ?? image
        }
        inFlight[url] = task
        let image = await task.value
        inFlight[url] = nil
        if let image { memory.setObject(image, forKey: url as NSURL) }
        return image
    }
}

/// Square release artwork with a quiet disc placeholder. A missing release cover
/// tries its release group, then the other thumbnail size.
struct Cover: View {
    var releaseMbId: String?
    var url: URL?
    var size: CGFloat?
    var radius: CGFloat = 12
    var label: String?

    @State private var image: UIImage?

    private var pixelSize: Int { Artwork.size(for: (size ?? 300) * 2) }

    private var candidates: [URL] {
        if let url { return [url] }
        return [Artwork.releaseCover(releaseMbId, size: pixelSize)].compactMap { $0 }
    }

    var body: some View {
        ZStack {
            Rectangle().fill(Color.fill)
            Image(systemName: "opticaldisc")
                .font(.system(size: (size ?? 80) * 0.36, weight: .light))
                .foregroundStyle(Color.ink3)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            }
        }
        .frame(width: size, height: size)
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel(label ?? "")
        .accessibilityHidden(label == nil)
        .task(id: candidates.first) { await load() }
    }

    private func load() async {
        guard let first = candidates.first else { image = nil; return }
        if let hit = ImageStore.shared.cached(first) { image = hit; return }
        image = nil
        if let loaded = await ImageStore.shared.image(first) {
            withAnimation(.easeOut(duration: 0.2)) { image = loaded }
            return
        }
        guard url == nil, let releaseMbId else { return }
        var fallbacks: [URL] = []
        if let group = await Artwork.shared.releaseGroupCover(forRelease: releaseMbId, size: pixelSize) { fallbacks.append(group) }
        if let other = Artwork.releaseCover(releaseMbId, size: pixelSize == 250 ? 500 : 250) { fallbacks.append(other) }
        for candidate in fallbacks {
            if Task.isCancelled { return }
            if let loaded = await ImageStore.shared.image(candidate) {
                withAnimation(.easeOut(duration: 0.2)) { image = loaded }
                return
            }
        }
    }
}

/// A round face, with the person's initial while it loads or when there is none.
struct Avatar: View {
    var actor: DisplayActor
    var size: CGFloat
    var listeningNow = false

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Circle().fill(Color.tintSoft)
            Text(String(actor.name.first(where: { $0.isLetter || $0.isNumber }) ?? "?").uppercased())
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(Color.tint)
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay {
            if listeningNow {
                Circle().strokeBorder(Color.now, lineWidth: max(2, size / 14)).padding(-max(2, size / 14) - 1)
            }
        }
        .accessibilityHidden(true)
        .task(id: actor.avatarURL) {
            guard let url = actor.avatarURL else { image = nil; return }
            image = ImageStore.shared.cached(url)
            if image == nil { image = await ImageStore.shared.image(url) }
        }
    }
}

/// Any remote image, filling its frame.
struct RemoteImage: View {
    var url: URL?

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Rectangle().fill(Color.fill)
            }
        }
        .task(id: url) {
            guard let url else { image = nil; return }
            image = ImageStore.shared.cached(url)
            if image == nil { image = await ImageStore.shared.image(url) }
        }
    }
}
