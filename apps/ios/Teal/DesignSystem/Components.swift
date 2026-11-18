import SwiftUI

extension View {
    /// A Liquid Glass panel, the surface every grouped block of content sits on.
    func panel(radius: CGFloat = 22, padding: CGFloat = 16) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: .rect(cornerRadius: radius))
    }

    /// The standard column for a page: a readable width, centred on wide screens.
    func pageColumn(maxWidth: CGFloat = 680) -> some View {
        frame(maxWidth: maxWidth).frame(maxWidth: .infinity)
    }
}

/// A titled block of a page. Titles sit on the backdrop; content can sit in a panel.
struct PageSection<Content: View, Accessory: View>: View {
    var title: String
    var detail: String?
    var panel = false
    @ViewBuilder var accessory: Accessory
    @ViewBuilder var content: Content

    init(_ title: String, detail: String? = nil, panel: Bool = false, @ViewBuilder accessory: () -> Accessory = { EmptyView() }, @ViewBuilder content: () -> Content) {
        self.title = title
        self.detail = detail
        self.panel = panel
        self.accessory = accessory()
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Color.ink)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                if let detail {
                    Text(detail).font(.subheadline).monospacedDigit().foregroundStyle(Color.ink2)
                }
                accessory
            }
            .halo()
            .padding(.horizontal, 4)
            if panel {
                VStack(alignment: .leading, spacing: 0) { content }.panel()
            } else {
                content
            }
        }
    }
}

/// A calm empty or informational state, with an optional action.
struct Notice<Action: View>: View {
    var systemImage: String?
    var title: String
    var message: String?
    @ViewBuilder var action: Action

    init(_ title: String, message: String? = nil, systemImage: String? = nil, @ViewBuilder action: () -> Action = { EmptyView() }) {
        self.title = title
        self.message = message
        self.systemImage = systemImage
        self.action = action()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let systemImage {
                Image(systemName: systemImage).font(.title).foregroundStyle(Color.ink2)
            }
            Text(title).font(.headline).foregroundStyle(Color.ink)
            if let message {
                Text(message).font(.subheadline).foregroundStyle(Color.ink2)
            }
            action
        }
        .panel()
    }
}

/// Something didn't load. Always offers a retry when there's something to retry.
struct ErrorNotice: View {
    var title: String
    var message: String = "Check your connection, or try again in a moment."
    var retry: (() -> Void)?

    var body: some View {
        Notice(title, message: message, systemImage: "exclamationmark.triangle") {
            if let retry {
                Button("Try again", action: retry)
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
            }
        }
    }
}

struct LoadingView: View {
    var body: some View {
        ProgressView()
            .controlSize(.large)
            .frame(maxWidth: .infinity, minHeight: 160)
            .accessibilityLabel("Loading")
    }
}

/// A row with leading art, two lines of text, and trailing detail.
struct ItemRow<Leading: View>: View {
    var title: String
    var subtitle: String?
    var meta: String?
    var chevron = false
    @ViewBuilder var leading: Leading

    var body: some View {
        HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(2)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            if let meta {
                Text(meta).font(.footnote).monospacedDigit().foregroundStyle(Color.ink2)
            }
            if chevron {
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Color.ink3)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A hairline between rows in a panel.
struct RowDivider: View {
    var body: some View {
        Rectangle().fill(Color.hair).frame(height: 1 / UIScreen.main.scale)
    }
}

/// Loads one value for a page, with loading, error, and retry states.
@Observable
final class Loader<Value> {
    enum Phase {
        case idle, loading, loaded(Value), failed(Error)
    }

    private(set) var phase: Phase = .idle
    @ObservationIgnored private let fetch: () async throws -> Value

    init(_ fetch: @escaping () async throws -> Value) {
        self.fetch = fetch
    }

    var value: Value? {
        if case let .loaded(value) = phase { return value }
        return nil
    }

    func load() async {
        if case .loaded = phase { return }
        await reload()
    }

    func reload() async {
        if value == nil { phase = .loading }
        do {
            phase = .loaded(try await fetch())
        } catch is CancellationError {
            // A newer load replaced this one.
        } catch {
            if value == nil { phase = .failed(error) }
        }
    }

    func set(_ value: Value) {
        phase = .loaded(value)
    }
}

/// Renders a loader's phases: a spinner, the error with a retry, or the content.
struct LoaderView<Value, Content: View>: View {
    var loader: Loader<Value>
    var errorTitle: String
    @ViewBuilder var content: (Value) -> Content

    var body: some View {
        switch loader.phase {
        case .idle, .loading:
            LoadingView()
        case .failed:
            ErrorNotice(title: errorTitle) { Task { await loader.reload() } }
        case let .loaded(value):
            content(value)
        }
    }
}
