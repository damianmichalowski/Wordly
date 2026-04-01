import SwiftUI
import WidgetKit

private let appGroupId = "group.com.wordly.mobile"
private let snapshotKey = "wordly.widget.snapshot.v1"

/// Zgodne z `StitchColors.primary` w aplikacji (#4456BA).
private let wordlyBrandPrimary = Color(red: 68 / 255, green: 86 / 255, blue: 186 / 255)

/// `StitchColors.secondary`, puchar jak na ekranie ukończenia Daily Word (#286C34).
private let wordlyCelebrateGreen = Color(red: 40 / 255, green: 108 / 255, blue: 52 / 255)

/// Odstęp treści od krawędzi, bazowo jak w RN `SettingsScreen` / `widgetPreviewMetrics` (skalowane przez `s`).
private enum WordlyWidgetContentPadding {
  static let small: CGFloat = 16
  static let medium: CGFloat = 18
}

/// Hierarchia: marka → **słowo (bohater)** → tłumaczenie (drugi plan, do przeczytania).
private enum WordlyWidgetLayout {
  static let brandToHeroSmall: CGFloat = 8
  static let brandToHeroMedium: CGFloat = 10
  static let heroToTranslationSmall: CGFloat = 12
  static let heroToTranslationMedium: CGFloat = 14
}

/// Typowy bok `systemSmall` na Home Screen (~155 pt), jak `WIDGET_SMALL_REFERENCE_PT` w RN; skalowanie treści i blobów.
private let wordlyWidgetSmallReferencePt: CGFloat = 155

/// Skala jak w podglądzie ustawień: `min(bok) / 155`.
private func wordlyWidgetScale(_ size: CGSize) -> CGFloat {
  min(size.width, size.height) / wordlyWidgetSmallReferencePt
}

private struct SnapshotPayload: Codable {
  let deepLink: String
  let knownDeepLink: String?
  let stateVersion: Int
  let updatedAt: String
  let sourceLanguage: String
  let targetLanguage: String
  let displayLevel: String
  let wordId: String?
  let sourceText: String?
  let targetText: String?
  /// Do 3 linii (sensy), preferowane nad pojedynczym `targetText`.
  let targetTranslationLines: [String]?
  let emptyReason: String?
  let uiState: String?
  let celebrationTitle: String?
  let celebrationSubtitle: String?
}

struct WordlyDailyWidget: Widget {
  let kind: String = "WordlyDailyWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WordlyDailyWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Wordly")
    .description("Słowo i tłumaczenie.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryInline,
      .accessoryRectangular,
    ])
    .contentMarginsDisabled()
  }
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(
      date: Date(),
      learningWord: "resilient",
      translationLines: ["odporny"],
      deepLink: "wordly://home",
      knownDeepLink: nil,
      isPlaceholder: true,
      isLoading: false,
      isCelebration: false,
      celebrationTitle: "",
      celebrationSubtitle: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = loadEntry()
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    let timeline = Timeline(entries: [entry], policy: .after(next))
    completion(timeline)
  }

  private func loadEntry() -> Entry {
    guard let defaults = UserDefaults(suiteName: appGroupId),
          let json = defaults.string(forKey: snapshotKey),
          let data = json.data(using: .utf8),
          let payload = try? JSONDecoder().decode(SnapshotPayload.self, from: data)
    else {
      return Entry(
        date: Date(),
        learningWord: "",
        translationLines: nil,
        deepLink: "wordly://home",
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: false,
        isCelebration: false,
        celebrationTitle: "",
        celebrationSubtitle: nil
      )
    }

    if payload.uiState == "loading" {
      return Entry(
        date: Date(),
        learningWord: "",
        translationLines: nil,
        deepLink: payload.deepLink,
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: true,
        isCelebration: false,
        celebrationTitle: "",
        celebrationSubtitle: nil
      )
    }

    if payload.emptyReason == "all-words-completed" {
      let trimmed = payload.celebrationTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      let rawTitle = trimmed.isEmpty ? "Mega robota!" : trimmed
      let sub = payload.celebrationSubtitle?.trimmingCharacters(in: .whitespacesAndNewlines)
      return Entry(
        date: Date(),
        learningWord: "",
        translationLines: nil,
        deepLink: payload.deepLink,
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: false,
        isCelebration: true,
        celebrationTitle: rawTitle,
        celebrationSubtitle: (sub?.isEmpty == false) ? sub : nil
      )
    }

    if payload.emptyReason != nil {
      return Entry(
        date: Date(),
        learningWord: "",
        translationLines: nil,
        deepLink: payload.deepLink,
        knownDeepLink: nil,
        isPlaceholder: false,
        isLoading: false,
        isCelebration: false,
        celebrationTitle: "",
        celebrationSubtitle: nil
      )
    }

    let learning = payload.sourceText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let translationLines: [String]?
    if let arr = payload.targetTranslationLines, !arr.isEmpty {
      translationLines = Array(arr.prefix(3).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
    } else {
      let t = payload.targetText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      translationLines = t.isEmpty ? nil : [t]
    }

    return Entry(
      date: Date(),
      learningWord: learning,
      translationLines: translationLines.flatMap { $0.isEmpty ? nil : $0 },
      deepLink: payload.deepLink,
      knownDeepLink: payload.knownDeepLink,
      isPlaceholder: false,
      isLoading: false,
      isCelebration: false,
      celebrationTitle: "",
      celebrationSubtitle: nil
    )
  }
}

struct Entry: TimelineEntry {
  let date: Date
  let learningWord: String
  let translationLines: [String]?
  let deepLink: String
  let knownDeepLink: String?
  let isPlaceholder: Bool
  let isLoading: Bool
  let isCelebration: Bool
  let celebrationTitle: String
  let celebrationSubtitle: String?
}

struct WordlyDailyWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: Entry

  /// Nazwa aplikacji, zawsze widoczna w widżecie (jak w `homeContentSmall`).
  private func wordlyBrandText(s: CGFloat) -> some View {
    Text("Wordly")
      .font(.system(size: max(9, 11 * s), weight: .semibold))
      .foregroundStyle(wordlyBrandPrimary.opacity(0.9))
      .kerning(0.35 * s)
  }

  var body: some View {
    if entry.isLoading {
      switch family {
      case .accessoryInline:
        ViewThatFits(in: .horizontal) {
          HStack(spacing: 6) {
            Text("Wordly")
              .font(.caption)
              .fontWeight(.semibold)
              .foregroundStyle(wordlyBrandPrimary.opacity(0.95))
            ProgressView()
          }
          .widgetURL(URL(string: entry.deepLink))
          Text("Wordly")
            .font(.caption2)
            .fontWeight(.semibold)
            .widgetURL(URL(string: entry.deepLink))
        }
      case .accessoryRectangular:
        HStack(alignment: .center, spacing: 8) {
          Text("Wordly")
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(wordlyBrandPrimary.opacity(0.95))
          ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: entry.deepLink))
      case .systemMedium:
        mediumLoading
      default:
        smallLoading
      }
    } else if entry.isCelebration {
      switch family {
      case .accessoryInline:
        accessoryCelebrationInline
      case .accessoryRectangular:
        accessoryCelebrationRectangular
      case .systemMedium:
        mediumCelebration
      default:
        smallCelebration
      }
    } else {
      switch family {
      case .accessoryInline:
        accessoryInline
      case .accessoryRectangular:
        accessoryRectangular
      case .systemMedium:
        mediumHome
      default:
        smallHome
      }
    }
  }

  private var smallLoading: some View {
    Group {
      if #available(iOS 17.0, *) {
        GeometryReader { geo in
          let s = wordlyWidgetScale(geo.size)
          VStack(alignment: .leading, spacing: 0) {
            wordlyBrandText(s: s)
            Spacer(minLength: 0)
            ProgressView()
              .frame(maxWidth: .infinity)
            Spacer(minLength: 0)
          }
          .padding(WordlyWidgetContentPadding.small * s)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      } else {
        ZStack {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          GeometryReader { geo in
            let s = wordlyWidgetScale(geo.size)
            VStack(alignment: .leading, spacing: 0) {
              wordlyBrandText(s: s)
              Spacer(minLength: 0)
              ProgressView()
                .frame(maxWidth: .infinity)
              Spacer(minLength: 0)
            }
            .padding(WordlyWidgetContentPadding.small * s)
          }
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var mediumLoading: some View {
    Group {
      if #available(iOS 17.0, *) {
        GeometryReader { geo in
          let s = wordlyWidgetScale(geo.size)
          VStack(alignment: .leading, spacing: 0) {
            wordlyBrandText(s: s)
            Spacer(minLength: 0)
            ProgressView()
              .scaleEffect(1.15)
              .frame(maxWidth: .infinity)
            Spacer(minLength: 0)
          }
          .padding(WordlyWidgetContentPadding.medium * s)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      } else {
        ZStack {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          GeometryReader { geo in
            let s = wordlyWidgetScale(geo.size)
            VStack(alignment: .leading, spacing: 0) {
              wordlyBrandText(s: s)
              Spacer(minLength: 0)
              ProgressView()
                .scaleEffect(1.15)
                .frame(maxWidth: .infinity)
              Spacer(minLength: 0)
            }
            .padding(WordlyWidgetContentPadding.medium * s)
          }
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  /// Mini ekran ukończenia toru (puchar + „Mega robota!” jak Daily Word).
  private var smallCelebration: some View {
    Group {
      if #available(iOS 17.0, *) {
        celebrationContentSmall
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          celebrationContentSmall
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var celebrationContentSmall: some View {
    GeometryReader { geo in
      let s = wordlyWidgetScale(geo.size)
      VStack(alignment: .leading, spacing: 0) {
        wordlyBrandText(s: s)
        Image(systemName: "trophy.fill")
          .font(.system(size: max(22, 34 * s)))
          .foregroundStyle(wordlyCelebrateGreen)
          .symbolRenderingMode(.monochrome)
          .padding(.top, WordlyWidgetLayout.brandToHeroSmall * s)
        Text(entry.celebrationTitle)
          .font(.system(size: max(13, 17 * s), weight: .bold, design: .default))
          .foregroundStyle(.primary)
          .minimumScaleFactor(0.75)
          .lineLimit(2)
          .padding(.top, 4 * s)
        if let sub = entry.celebrationSubtitle, !sub.isEmpty {
          Text(sub)
            .font(.system(size: max(10, 12 * s), weight: .regular))
            .foregroundStyle(.secondary)
            .minimumScaleFactor(0.78)
            .lineLimit(3)
            .padding(.top, 4 * s)
        }
      }
      .padding(WordlyWidgetContentPadding.small * s)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var mediumCelebration: some View {
    Group {
      if #available(iOS 17.0, *) {
        celebrationContentMedium
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          celebrationContentMedium
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var celebrationContentMedium: some View {
    GeometryReader { geo in
      let s = wordlyWidgetScale(geo.size)
      VStack(alignment: .leading, spacing: 0) {
        wordlyBrandText(s: s)
        Image(systemName: "trophy.fill")
          .font(.system(size: max(28, 40 * s)))
          .foregroundStyle(wordlyCelebrateGreen)
          .symbolRenderingMode(.monochrome)
          .padding(.top, WordlyWidgetLayout.brandToHeroMedium * s)
        Text(entry.celebrationTitle)
          .font(.system(size: max(16, 22 * s), weight: .bold, design: .default))
          .foregroundStyle(.primary)
          .minimumScaleFactor(0.72)
          .lineLimit(2)
          .padding(.top, 6 * s)
        if let sub = entry.celebrationSubtitle, !sub.isEmpty {
          Text(sub)
            .font(.system(size: max(12, 15 * s), weight: .regular))
            .foregroundStyle(.secondary)
            .minimumScaleFactor(0.78)
            .lineLimit(4)
            .padding(.top, 4 * s)
        }
      }
      .padding(WordlyWidgetContentPadding.medium * s)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var accessoryCelebrationInline: some View {
    ViewThatFits(in: .horizontal) {
      Text("Wordly · \(entry.celebrationTitle)")
        .font(.caption)
        .fontWeight(.semibold)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .widgetURL(URL(string: entry.deepLink))
      Text("Wordly")
        .font(.caption2)
        .fontWeight(.semibold)
        .widgetURL(URL(string: entry.deepLink))
    }
  }

  private var accessoryCelebrationRectangular: some View {
    HStack(alignment: .center, spacing: 6) {
      Image(systemName: "trophy.fill")
        .font(.title3)
        .foregroundStyle(wordlyCelebrateGreen)
      VStack(alignment: .leading, spacing: 2) {
        Text("Wordly")
          .font(.caption2)
          .fontWeight(.semibold)
          .foregroundStyle(wordlyBrandPrimary.opacity(0.95))
        Text(entry.celebrationTitle)
          .font(.headline)
          .fontWeight(.bold)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        if let sub = entry.celebrationSubtitle, !sub.isEmpty {
          Text(sub)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .minimumScaleFactor(0.75)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(URL(string: entry.deepLink))
  }

  /// Tło jak w RN `SettingsScreen` (preview): `systemBackground` + dwa bloby (skala `min/155`), bez gradientu.
  private var wordlyWidgetDecorativeBackdrop: some View {
    GeometryReader { geo in
      let s = wordlyWidgetScale(geo.size)
      Color(.systemBackground)
        .overlay(alignment: .topTrailing) {
          Circle()
            .fill(wordlyBrandPrimary.opacity(0.10))
            .frame(width: 140 * s, height: 140 * s)
            .offset(x: 16 * s, y: -20 * s)
        }
        .overlay(alignment: .bottomLeading) {
          Circle()
            .fill(wordlyBrandPrimary.opacity(0.03))
            .frame(width: 160 * s, height: 160 * s)
            .offset(x: -24 * s, y: 32 * s)
        }
    }
  }

  /// Treść małego widżetu, fonty i odstępy skalowane jak `widgetPreviewMetrics` w RN.
  private var homeContentSmall: some View {
    GeometryReader { geo in
      let s = wordlyWidgetScale(geo.size)
      VStack(alignment: .leading, spacing: 0) {
        wordlyBrandText(s: s)

        Text(entry.learningWord)
          .font(.system(size: max(14, 26 * s), weight: .bold, design: .default))
          .foregroundStyle(.primary)
          .minimumScaleFactor(0.66)
          .lineLimit(3)
          .padding(.top, WordlyWidgetLayout.brandToHeroSmall * s)

        if let lines = entry.translationLines, !lines.isEmpty {
          VStack(alignment: .leading, spacing: 3 * s) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
              Text(line)
                .font(.system(size: max(10, 13 * s), weight: .regular))
                .foregroundStyle(.secondary)
                .lineSpacing(2 * s)
                .minimumScaleFactor(0.8)
                .lineLimit(3)
            }
          }
          .padding(.top, WordlyWidgetLayout.heroToTranslationSmall * s)
        }
      }
      .padding(WordlyWidgetContentPadding.small * s)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var homeContentMedium: some View {
    GeometryReader { geo in
      let s = wordlyWidgetScale(geo.size)
      VStack(alignment: .leading, spacing: 0) {
        wordlyBrandText(s: s)

        Text(entry.learningWord)
          .font(.system(size: max(16, 32 * s), weight: .bold, design: .default))
          .foregroundStyle(.primary)
          .minimumScaleFactor(0.64)
          .lineLimit(2)
          .lineSpacing(2 * s)
          .padding(.top, WordlyWidgetLayout.brandToHeroMedium * s)

        if let lines = entry.translationLines, !lines.isEmpty {
          VStack(alignment: .leading, spacing: 4 * s) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
              Text(line)
                .font(.system(size: max(12, 16 * s), weight: .regular))
                .foregroundStyle(.secondary)
                .lineSpacing(2 * s)
                .minimumScaleFactor(0.78)
                .lineLimit(3)
            }
          }
          .padding(.top, WordlyWidgetLayout.heroToTranslationMedium * s)
        }
      }
      .padding(WordlyWidgetContentPadding.medium * s)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  /// iOS 17+: `containerBackground` maluje tło pod całą komórką; `contentMarginsDisabled` usuwa domyślny „padding” systemowy (biała obwódka).
  private var smallHome: some View {
    Group {
      if #available(iOS 17.0, *) {
        homeContentSmall
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          homeContentSmall
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var mediumHome: some View {
    Group {
      if #available(iOS 17.0, *) {
        homeContentMedium
          .containerBackground(for: .widget) {
            wordlyWidgetDecorativeBackdrop
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
      } else {
        ZStack(alignment: .topLeading) {
          wordlyWidgetDecorativeBackdrop
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          homeContentMedium
        }
      }
    }
    .widgetURL(URL(string: entry.deepLink))
  }

  private var accessoryInline: some View {
    ViewThatFits(in: .horizontal) {
      Text("Wordly · \(entry.learningWord)")
        .font(.caption)
        .fontWeight(.semibold)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .widgetURL(URL(string: entry.deepLink))
      Text("Wordly")
        .font(.caption2)
        .fontWeight(.semibold)
        .widgetURL(URL(string: entry.deepLink))
    }
  }

  private var accessoryRectangular: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("Wordly")
        .font(.caption2)
        .fontWeight(.semibold)
        .foregroundStyle(wordlyBrandPrimary.opacity(0.95))
      Text(entry.learningWord)
        .font(.headline)
        .fontWeight(.bold)
        .minimumScaleFactor(0.8)
        .lineLimit(1)
        .padding(.top, 2)
      if let lines = entry.translationLines, !lines.isEmpty {
        VStack(alignment: .leading, spacing: 2) {
          ForEach(Array(lines.prefix(3).enumerated()), id: \.offset) { _, line in
            Text(line)
              .font(.caption2)
              .fontWeight(.regular)
              .foregroundStyle(.secondary)
              .lineLimit(1)
              .minimumScaleFactor(0.75)
          }
        }
        .padding(.top, 4)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(URL(string: entry.deepLink))
  }
}
