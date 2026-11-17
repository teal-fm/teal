import SwiftUI

/// Toggles the viewer's reaction on a post or listen, updating the counts straight
/// away and settling them once the record is written or removed.
@MainActor
func toggleReaction(
    _ emoji: String,
    subject: (uri: String, cid: String?),
    reactions: Binding<[ReactionSummary]>,
    session: Session
) {
    guard let pds = session.pds else { return }
    let existing = reactions.wrappedValue.first { $0.emoji == emoji }?.viewerReaction
    // While a reaction is still saving there's no record to remove yet, and a second add would duplicate it.
    if existing == "pending" { return }
    let before = reactions.wrappedValue
    reactions.wrappedValue = Social.withViewerReaction(before, emoji: emoji, viewerReaction: existing == nil ? "pending" : nil)
    Task {
        do {
            if let existing {
                try await Social.removeReaction(pds, uri: existing)
            } else {
                let uri = try await Social.addReaction(pds, subject: subject, emoji: emoji)
                reactions.wrappedValue = Social.withViewerReaction(reactions.wrappedValue, emoji: emoji, viewerReaction: uri)
            }
        } catch {
            reactions.wrappedValue = before
        }
    }
}

/// Reaction counts on a post; tapping a pill toggles your reaction.
struct ReactionBar: View {
    var subject: (uri: String, cid: String?)
    @Binding var reactions: [ReactionSummary]

    @Environment(Session.self) private var session
    @State private var picking = false

    var body: some View {
        FlowRow(spacing: 6) {
            ForEach(reactions, id: \.emoji) { r in
                let mine = r.viewerReaction != nil
                Button {
                    toggleReaction(r.emoji, subject: subject, reactions: $reactions, session: session)
                } label: {
                    HStack(spacing: 5) {
                        Text(r.emoji).font(.system(size: 15))
                        Text("\(r.count)").font(.subheadline.weight(.semibold)).monospacedDigit()
                            .foregroundStyle(mine ? Color.tint : Color.ink)
                    }
                    .padding(.horizontal, 10)
                    .frame(height: 32)
                    .background(mine ? Color.tintSoft : Color.fill, in: Capsule())
                    .overlay { if mine { Capsule().strokeBorder(Color.tint.opacity(0.4)) } }
                }
                .buttonStyle(.plain)
                .disabled(session.viewer == nil || r.viewerReaction == "pending")
                .accessibilityLabel("\(r.emoji) \(r.count)\(mine ? ", yours" : "")")
            }
            if session.viewer != nil {
                Button { picking = true } label: {
                    Image(systemName: "face.smiling")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.ink2)
                        .frame(width: 36, height: 32)
                        .background(Color.fill, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add reaction")
                .sheet(isPresented: $picking) {
                    ReactionPicker { emoji in
                        toggleReaction(emoji, subject: subject, reactions: $reactions, session: session)
                    }
                }
            }
        }
    }
}

/// Any emoji: the quick set, a broader palette, and a field for anything else.
struct ReactionPicker: View {
    var onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""

    private static let palette = [
        "🔥", "😭", "🫶", "🔁", "🤯", "❤️", "😍", "🥹", "😮‍💨", "💀",
        "🙏", "👏", "🎉", "✨", "💯", "😌", "🥲", "😤", "🤘", "🎧",
        "🕺", "💃", "🌊", "🌙", "☀️", "🌸", "🍒", "🦋", "🫠", "👀",
        "😳", "🤔", "😴", "🤍", "💔", "🖤", "💜", "💙", "💚", "🧡",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 10) {
                        ForEach(Self.palette, id: \.self) { emoji in
                            Button { pick(emoji) } label: {
                                Text(emoji).font(.system(size: 32)).frame(width: 48, height: 48)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("React \(emoji)")
                        }
                    }
                    TextField("Or type any emoji", text: $typed)
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: typed) { _, value in
                            if let emoji = value.last(where: { $0.unicodeScalars.contains { $0.properties.isEmojiPresentation } || $0.unicodeScalars.count > 1 }) {
                                pick(String(emoji))
                            }
                        }
                }
                .padding()
            }
            .navigationTitle("React")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }

    private func pick(_ emoji: String) {
        onPick(emoji)
        dismiss()
    }
}

/// Lays children out in rows, wrapping when a row is full.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            widest = max(widest, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(widest, width), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
